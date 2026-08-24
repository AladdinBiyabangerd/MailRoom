import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { Codes, Msg, bad, notFound } from "../errors.js";
import type { AuthUser } from "../auth.js";
import {
  formatFromLabel,
  resolveGreetingName,
  unsubscribeUrl,
  withPersonalizedGreeting,
  withTrackingPixel,
  withUnsubscribeFooter,
} from "../mail/html.js";
import { assertAttachmentCount, assertAttachmentSize, decodeAttachmentBase64 } from "../mail/attachments.js";
import { fallbackFrom, loadSmtpSettings, sendHtmlEmail } from "../mail/sender.js";
import { deleteCurrentDraft, loadTemplateAttachmentFiles, resolveFromAddress } from "./catalog.js";
import { normalizeEmail } from "./auth.js";

const FAILED = new Set(["FAILED", "BOUNCED"]);

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function isSuppressed(email: string) {
  const found = await prisma.emailSuppression.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
  });
  return Boolean(found);
}

export async function filterSuppressed(emails: string[]) {
  if (!emails.length) return [];
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  const suppressed = await prisma.emailSuppression.findMany({
    where: { email: { in: normalized } },
  });
  const blocked = new Set(suppressed.map((s) => s.email.toLowerCase()));
  return normalized.filter((e) => !blocked.has(e));
}

function decodeRequestAttachments(
  incoming?: { fileName: string; contentType: string; contentBase64: string }[],
) {
  return (incoming ?? []).map((a) => {
    const content = decodeAttachmentBase64(a.contentBase64);
    assertAttachmentSize(content);
    return { fileName: a.fileName.trim() || "attachment", contentType: a.contentType.trim() || "application/octet-stream", content };
  });
}

export interface SendPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  campaignId?: number;
  scheduledAt?: string;
  senderIdentityId?: number;
  includeUnsubscribe?: boolean;
  greetWithName?: boolean;
  resendOfEmailId?: number;
  fromOverride?: { email: string; displayName?: string | null };
  recipientNames?: Record<string, string | null>;
  attachments?: { fileName: string; contentType: string; contentBase64: string }[];
}

function computeAggregateStatus(statuses: string[]) {
  if (!statuses.length) return "QUEUED";
  if (statuses.every((s) => s === "QUEUED")) return "QUEUED";
  if (statuses.every((s) => FAILED.has(s))) return "FAILED";
  if (statuses.every((s) => s === "OPENED")) return "OPENED";
  if (statuses.some((s) => s === "OPENED")) return "OPENED";
  if (statuses.some((s) => FAILED.has(s))) return "FAILED";
  if (statuses.every((s) => s === "DELIVERED" || s === "OPENED" || s === "SENT")) return "DELIVERED";
  return "SENT";
}

export async function sendAdminEmail(actor: AuthUser, request: SendPayload) {
  const now = new Date();
  if (!request?.to?.length || !request.subject?.trim() || !request.bodyHtml?.trim()) {
    throw bad(Codes.BAD_REQUEST, Msg.VALIDATION_FAILED);
  }
  const smtp = await loadSmtpSettings();
  if (!smtp) {
    throw bad(Codes.MAIL_CONFIG, Msg.MAIL_NOT_CONFIGURED);
  }
  const toAll = (request.to ?? []).map(normalizeEmail).filter(Boolean);
  const ccAll = (request.cc ?? []).map(normalizeEmail).filter(Boolean);
  const bccAll = (request.bcc ?? []).map(normalizeEmail).filter(Boolean);
  const to = await filterSuppressed([...new Set(toAll)]);
  const cc = await filterSuppressed([...new Set(ccAll)]);
  const bcc = await filterSuppressed([...new Set(bccAll)]);
  const suppressedCount = Math.max(0, new Set([...toAll, ...ccAll, ...bccAll]).size - (to.length + cc.length + bcc.length));

  if (!to.length) throw bad(Codes.SENT_EMAIL, Msg.EMAIL_ALL_RECIPIENTS_SUPPRESSED);

  const total = to.length + cc.length + bcc.length;
  if (total > config.limits.maxRecipients) {
    throw bad(Codes.SENT_EMAIL, Msg.EMAIL_RECIPIENT_LIMIT, config.limits.maxRecipients);
  }
  if (request.subject.length > config.limits.maxSubjectLength) {
    throw bad(Codes.SENT_EMAIL, Msg.EMAIL_SUBJECT_TOO_LONG, config.limits.maxSubjectLength);
  }
  if (request.bodyHtml.length > config.limits.maxHtmlBodyLength) {
    throw bad(Codes.SENT_EMAIL, Msg.EMAIL_BODY_TOO_LONG, config.limits.maxHtmlBodyLength);
  }

  let campaignId = request.campaignId ?? undefined;
  let campaignTemplateId: number | null = null;
  if (campaignId) {
    const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      if (request.resendOfEmailId) {
        campaignId = undefined;
      } else {
        throw notFound(Codes.EMAIL_CAMPAIGN, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_CAMPAIGN);
      }
    } else {
      campaignTemplateId = campaign.templateId;
    }
  }

  const scheduledAt = request.scheduledAt ? new Date(request.scheduledAt) : null;
  const isScheduled = Boolean(scheduledAt && scheduledAt > now);
  if (scheduledAt && !isScheduled) throw bad(Codes.SENT_EMAIL, Msg.EMAIL_SCHEDULE_IN_PAST);

  const includeUnsubscribe =
    request.includeUnsubscribe === true || (request.includeUnsubscribe == null && campaignId != null);
  const greetWithName = request.greetWithName !== false;
  const from =
    request.fromOverride ?? (await resolveFromAddress(request.senderIdentityId ?? null));

  const extraAttachments = decodeRequestAttachments(request.attachments);
  const templateAttachments =
    !request.resendOfEmailId && campaignTemplateId
      ? await loadTemplateAttachmentFiles(campaignTemplateId)
      : [];
  const attachments = [...templateAttachments, ...extraAttachments];
  assertAttachmentCount(attachments.length);

  const email = await prisma.sentEmail.create({
    data: {
      subject: request.subject.trim(),
      bodyHtml: request.bodyHtml.trim(),
      sentByUserId: actor.userId,
      sentByEmail: actor.email,
      sentByName: `${actor.firstName} ${actor.lastName}`.trim(),
      senderIdentityId: request.senderIdentityId ?? null,
      fromEmail: from.email,
      fromName: from.displayName ?? null,
      sentAt: isScheduled ? scheduledAt! : now,
      scheduledAt: isScheduled ? scheduledAt : null,
      status: isScheduled ? "SCHEDULED" : "QUEUED",
      campaignId: campaignId ?? null,
      resendOfEmailId: request.resendOfEmailId ?? null,
      includeUnsubscribe,
      greetWithName,
      recipients: {
        create: [
          ...to.map((e) => ({
            email: e,
            name: resolveGreetingName(request.recipientNames?.[e], e),
            recipientType: "TO",
            status: "QUEUED",
            openTrackingToken: randomUUID(),
            unsubscribeToken: includeUnsubscribe ? randomUUID() : null,
          })),
          ...cc.map((e) => ({
            email: e,
            name: resolveGreetingName(request.recipientNames?.[e], e),
            recipientType: "CC",
            status: "QUEUED",
            openTrackingToken: randomUUID(),
            unsubscribeToken: includeUnsubscribe ? randomUUID() : null,
          })),
          ...bcc.map((e) => ({
            email: e,
            name: resolveGreetingName(request.recipientNames?.[e], e),
            recipientType: "BCC",
            status: "QUEUED",
            openTrackingToken: randomUUID(),
            unsubscribeToken: includeUnsubscribe ? randomUUID() : null,
          })),
        ],
      },
      attachments: attachments.length
        ? {
            create: attachments.map((a) => ({
              fileName: a.fileName,
              contentType: a.contentType,
              content: new Uint8Array(a.content),
            })),
          }
        : undefined,
    },
  });

  if (!isScheduled) {
    setImmediate(() => {
      void dispatchEmail(email.id);
    });
  }
  if (!request.resendOfEmailId) {
    await deleteCurrentDraft(actor.userId);
  }

  return {
    id: String(email.id),
    sentAt: email.sentAt.toISOString(),
    scheduledAt: isScheduled ? iso(scheduledAt) : null,
    status: email.status.toLowerCase(),
    recipientCount: total,
    suppressedCount,
  };
}

export async function dispatchEmail(sentEmailId: number) {
  const email = await prisma.sentEmail.findUnique({
    where: { id: sentEmailId },
    include: { recipients: true, attachments: true },
  });
  if (!email) return;

  const settings = await loadSmtpSettings();
  const from = {
    email: email.fromEmail || (settings ? fallbackFrom(settings).email : "noreply@localhost"),
    displayName: email.fromName,
  };
  const attachments = email.attachments.map((a) => ({
    filename: a.fileName,
    contentType: a.contentType,
    content: Buffer.from(a.content),
  }));

  for (const recipient of email.recipients) {
    if (await isSuppressed(recipient.email)) {
      await prisma.sentEmailRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", errorMessage: "Recipient unsubscribed" },
      });
      continue;
    }

    let htmlBody = email.bodyHtml;
    if (email.greetWithName) {
      htmlBody = withPersonalizedGreeting(
        htmlBody,
        resolveGreetingName(recipient.name, recipient.email),
      );
    }
    if (email.includeUnsubscribe && recipient.unsubscribeToken) {
      htmlBody = withUnsubscribeFooter(htmlBody, recipient.unsubscribeToken, config.publicBaseUrl);
    }
    if (recipient.openTrackingToken) {
      htmlBody = withTrackingPixel(htmlBody, recipient.openTrackingToken, config.publicBaseUrl);
    }
    const listUnsubscribeUrl =
      email.includeUnsubscribe && recipient.unsubscribeToken
        ? unsubscribeUrl(recipient.unsubscribeToken, config.publicBaseUrl)
        : null;

    if (!settings) {
      await prisma.sentEmailRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", errorMessage: "SMTP is not configured" },
      });
      continue;
    }

    try {
      await sendHtmlEmail({
        settings,
        from,
        to: [recipient.email],
        subject: email.subject,
        html: htmlBody,
        attachments,
        listUnsubscribeUrl,
      });
      await prisma.sentEmailRecipient.update({
        where: { id: recipient.id },
        data: { status: "DELIVERED", deliveredAt: new Date(), errorMessage: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.sentEmailRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", errorMessage: message.slice(0, 500) },
      });
    }
  }

  const refreshed = await prisma.sentEmail.findUnique({
    where: { id: sentEmailId },
    include: { recipients: true },
  });
  if (!refreshed) return;
  const aggregate = computeAggregateStatus(refreshed.recipients.map((r) => r.status));
  await prisma.sentEmail.update({ where: { id: sentEmailId }, data: { status: aggregate } });

  if (refreshed.resendOfEmailId) {
    await syncOriginalAfterResend(refreshed.resendOfEmailId, refreshed.recipients);
  }
}

async function syncOriginalAfterResend(
  originalId: number,
  resent: { email: string; recipientType: string; status: string; deliveredAt: Date | null }[],
) {
  const original = await prisma.sentEmail.findUnique({
    where: { id: originalId },
    include: { recipients: true },
  });
  if (!original) return;
  let changed = false;
  for (const r of resent) {
    if (r.status !== "DELIVERED" && r.status !== "OPENED") continue;
    for (const o of original.recipients) {
      if (o.email.toLowerCase() !== r.email.toLowerCase() || o.recipientType !== r.recipientType) continue;
      if (o.status !== "FAILED" && o.status !== "BOUNCED") continue;
      await prisma.sentEmailRecipient.update({
        where: { id: o.id },
        data: { status: "DELIVERED", deliveredAt: r.deliveredAt ?? new Date(), errorMessage: null },
      });
      changed = true;
    }
  }
  if (changed) {
    const updated = await prisma.sentEmail.findUnique({
      where: { id: originalId },
      include: { recipients: true },
    });
    if (updated) {
      await prisma.sentEmail.update({
        where: { id: originalId },
        data: { status: computeAggregateStatus(updated.recipients.map((r) => r.status)) },
      });
    }
  }
}

function mapSentEmail(email: {
  id: number;
  subject: string;
  bodyHtml: string;
  sentByEmail: string;
  sentByName: string;
  fromEmail: string | null;
  fromName: string | null;
  sentAt: Date;
  scheduledAt: Date | null;
  status: string;
  recipients: {
    email: string;
    name: string | null;
    recipientType: string;
    status: string;
    deliveredAt: Date | null;
    openedAt: Date | null;
    errorMessage: string | null;
  }[];
}) {
  const of = (type: string) =>
    email.recipients
      .filter((r) => r.recipientType === type)
      .map((r) => ({
        email: r.email,
        name: r.name ?? undefined,
        status: r.status.toLowerCase(),
        deliveredAt: iso(r.deliveredAt) ?? undefined,
        openedAt: iso(r.openedAt) ?? undefined,
        errorMessage: r.errorMessage ?? undefined,
      }));
  return {
    id: String(email.id),
    subject: email.subject,
    bodyHtml: email.bodyHtml,
    sentBy: email.sentByEmail,
    sentByName: email.sentByName,
    fromEmail: email.fromEmail,
    fromName: email.fromName,
    fromLabel: email.fromEmail ? formatFromLabel(email.fromName, email.fromEmail) : null,
    sentAt: email.sentAt.toISOString(),
    scheduledAt: iso(email.scheduledAt),
    status: email.status.toLowerCase(),
    to: of("TO"),
    cc: of("CC"),
    bcc: of("BCC"),
  };
}

export async function history() {
  const emails = await prisma.sentEmail.findMany({
    include: { recipients: { orderBy: { id: "asc" } } },
    orderBy: { sentAt: "desc" },
  });
  return emails.map(mapSentEmail);
}

export async function updateSchedule(id: number, scheduledAtRaw: string) {
  const email = await prisma.sentEmail.findUnique({
    where: { id },
    include: { recipients: true },
  });
  if (!email) throw notFound(Codes.SENT_EMAIL, Msg.NOT_FOUND, id);
  if (email.status !== "SCHEDULED") throw bad(Codes.SENT_EMAIL, Msg.EMAIL_NOT_SCHEDULED);
  const scheduledAt = new Date(scheduledAtRaw);
  if (!(scheduledAt > new Date())) throw bad(Codes.SENT_EMAIL, Msg.EMAIL_SCHEDULE_IN_PAST);
  const saved = await prisma.sentEmail.update({
    where: { id },
    data: { scheduledAt, sentAt: scheduledAt },
    include: { recipients: true },
  });
  return mapSentEmail(saved);
}

export async function resendEmail(id: number, actor: AuthUser, modeRaw?: string) {
  const original = await prisma.sentEmail.findUnique({
    where: { id },
    include: { recipients: true, attachments: true },
  });
  if (!original) throw notFound(Codes.SENT_EMAIL, Msg.NOT_FOUND, id);
  const mode = (modeRaw ?? "ALL").toUpperCase();
  const source = original.recipients.filter((r) => (mode === "FAILED" ? FAILED.has(r.status) : true));
  const to = source.filter((r) => r.recipientType === "TO").map((r) => r.email);
  const cc = source.filter((r) => r.recipientType === "CC").map((r) => r.email);
  const bcc = source.filter((r) => r.recipientType === "BCC").map((r) => r.email);
  if (!to.length) throw bad(Codes.SENT_EMAIL, Msg.EMAIL_RESEND_NO_RECIPIENTS);

  let senderIdentityId = original.senderIdentityId ?? undefined;
  if (senderIdentityId) {
    const identity = await prisma.emailSenderIdentity.findFirst({
      where: { id: senderIdentityId, active: true },
    });
    if (!identity) senderIdentityId = undefined;
  }

  const recipientNames = Object.fromEntries(
    original.recipients.map((r) => [normalizeEmail(r.email), r.name]),
  );

  return sendAdminEmail(actor, {
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject: original.subject,
    bodyHtml: original.bodyHtml,
    campaignId: original.campaignId ?? undefined,
    resendOfEmailId: original.id,
    includeUnsubscribe: original.includeUnsubscribe,
    greetWithName: original.greetWithName,
    senderIdentityId,
    fromOverride: original.fromEmail
      ? { email: original.fromEmail, displayName: original.fromName }
      : undefined,
    recipientNames,
    attachments: original.attachments.map((a) => ({
      fileName: a.fileName,
      contentType: a.contentType,
      contentBase64: Buffer.from(a.content).toString("base64"),
    })),
  });
}

export async function dispatchDueScheduled() {
  const due = await prisma.sentEmail.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
  });
  for (const email of due) {
    await prisma.sentEmail.update({
      where: { id: email.id },
      data: { status: "QUEUED", sentAt: new Date(), scheduledAt: null },
    });
    void dispatchEmail(email.id);
  }
}

function rate(num: number, den: number) {
  return den === 0 ? 0 : num / den;
}

export function uniqueRecipientCount(recipients: { email: string }[]): number {
  return new Set(recipients.map((r) => normalizeEmail(r.email)).filter(Boolean)).size;
}

export async function getAnalytics(fromRaw?: string, toRaw?: string, campaignId?: number) {
  let from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let to = toRaw ? new Date(toRaw) : new Date();
  if (from > to) [from, to] = [to, from];

  const where = {
    sentEmail: {
      sentAt: { gte: from, lte: to },
      ...(campaignId ? { campaignId } : {}),
    },
  };

  const [recipients, emailsSent] = await Promise.all([
    prisma.sentEmailRecipient.findMany({ where, include: { sentEmail: true } }),
    prisma.sentEmail.count({
      where: { sentAt: { gte: from, lte: to }, ...(campaignId ? { campaignId } : {}) },
    }),
  ]);

  const delivered = recipients.filter((r) => r.status === "DELIVERED" || r.status === "OPENED").length;
  const opened = recipients.filter((r) => r.status === "OPENED").length;
  const failed = recipients.filter((r) => FAILED.has(r.status)).length;
  const attempted = delivered + failed;

  const summary = {
    emailsSent,
    recipientsTotal: uniqueRecipientCount(recipients),
    delivered,
    opened,
    failed,
    deliveryRate: rate(delivered, attempted),
    openRate: rate(opened, delivered),
  };

  if (campaignId) return { summary, byCampaign: [] };

  const campaigns = await prisma.emailCampaign.findMany();
  const byCampaign = [];
  for (const campaign of campaigns) {
    const subset = recipients.filter((r) => r.sentEmail.campaignId === campaign.id);
    if (!subset.length) continue;
    const d = subset.filter((r) => r.status === "DELIVERED" || r.status === "OPENED").length;
    const o = subset.filter((r) => r.status === "OPENED").length;
    const f = subset.filter((r) => FAILED.has(r.status)).length;
    byCampaign.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      recipientsTotal: uniqueRecipientCount(subset),
      delivered: d,
      opened: o,
      deliveryRate: rate(d, d + f),
      openRate: rate(o, d),
    });
  }
  return { summary, byCampaign };
}

export async function recordOpen(token: string) {
  const recipient = await prisma.sentEmailRecipient.findUnique({
    where: { openTrackingToken: token },
  });
  if (!recipient || recipient.openedAt) return;
  const now = new Date();
  await prisma.sentEmailRecipient.update({
    where: { id: recipient.id },
    data: {
      status: "OPENED",
      openedAt: now,
      deliveredAt: recipient.deliveredAt ?? now,
    },
  });
  const email = await prisma.sentEmail.findUnique({
    where: { id: recipient.sentEmailId },
    include: { recipients: true },
  });
  if (email) {
    await prisma.sentEmail.update({
      where: { id: email.id },
      data: { status: computeAggregateStatus(email.recipients.map((r) => (r.id === recipient.id ? "OPENED" : r.status))) },
    });
  }
}

export async function unsubscribe(token: string) {
  const recipient = await prisma.sentEmailRecipient.findUnique({
    where: { unsubscribeToken: token },
    include: { sentEmail: true },
  });
  if (!recipient) return false;
  const email = normalizeEmail(recipient.email);
  const now = new Date();
  const existing = await prisma.emailSuppression.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (!existing) {
    await prisma.emailSuppression.create({
      data: {
        email,
        unsubscribedAt: now,
        source: "ONE_CLICK",
        campaignId: recipient.sentEmail.campaignId,
        sentEmailId: recipient.sentEmailId,
      },
    });
  }
  if (!recipient.unsubscribedAt) {
    await prisma.sentEmailRecipient.update({
      where: { id: recipient.id },
      data: { unsubscribedAt: now },
    });
  }
  return true;
}

export async function listSuppressions(search?: string, page?: number, limit?: number) {
  const p = !page || page < 1 ? 1 : page;
  const l = !limit || limit < 1 ? 20 : Math.min(limit, 100);
  const where = search?.trim()
    ? { email: { contains: search.trim(), mode: "insensitive" as const } }
    : {};
  const [items, total] = await Promise.all([
    prisma.emailSuppression.findMany({
      where,
      orderBy: { unsubscribedAt: "desc" },
      skip: (p - 1) * l,
      take: l,
    }),
    prisma.emailSuppression.count({ where }),
  ]);
  return {
    items: items.map((s) => ({
      id: s.id,
      email: s.email,
      unsubscribedAt: s.unsubscribedAt.toISOString(),
      source: s.source,
      campaignId: s.campaignId ?? undefined,
      sentEmailId: s.sentEmailId ?? undefined,
    })),
    total,
    page: p,
    limit: l,
  };
}

export async function deleteSuppression(id: number) {
  const s = await prisma.emailSuppression.findUnique({ where: { id } });
  if (!s) throw notFound(Codes.EMAIL_SUPPRESSION, Msg.NOT_FOUND, id);
  await prisma.emailSuppression.delete({ where: { id } });
}
