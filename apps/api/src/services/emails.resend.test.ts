import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import type { AuthUser } from "../auth.js";
import { prisma } from "../db.js";
import { AppError, Codes, Msg } from "../errors.js";
import { setSmtpSettingsForTests, setTransportFactoryForTests, type MailTransport } from "../mail/sender.js";
import { resendEmail } from "./emails.js";

const PIXEL_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const DOMAIN = "resendcase.test";

type SentMail = {
  to?: string[];
  from?: string;
  subject?: string;
  html?: string;
  attachments?: { filename?: string; contentType?: string; content?: Buffer; cid?: string }[];
  headers?: Record<string, string>;
};

let actor: AuthUser;
const createdUserIds: number[] = [];
const createdEmailIds: number[] = [];
const createdCampaignIds: number[] = [];
const createdIdentityIds: number[] = [];
const createdSuppressionIds: number[] = [];
let sentMail: SentMail[] = [];
let failAddresses = new Set<string>();

function addr(local: string) {
  return `${local}@${DOMAIN}`;
}

function assertAppError(err: unknown, code: string, messageKey: string) {
  assert.ok(err instanceof AppError, `expected AppError, got ${err}`);
  assert.equal(err.code, code);
  assert.equal(err.messageKey, messageKey);
}

function mockTransport(): MailTransport {
  return {
    async sendMail(mail) {
      const to = (mail.to as string[]) ?? [];
      if (to.some((e) => failAddresses.has(e.toLowerCase()))) {
        throw new Error("smtp-rejected");
      }
      sentMail.push(mail as SentMail);
      return { messageId: randomUUID() };
    },
  };
}

async function waitUntilSettled(id: number) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const latest = await prisma.sentEmail.findUnique({
      where: { id },
      include: { recipients: true, attachments: true },
    });
    if (
      latest &&
      latest.status !== "QUEUED" &&
      latest.recipients.every((r) => r.status !== "QUEUED")
    ) {
      if (!latest.resendOfEmailId) return latest;
      const original = await prisma.sentEmail.findUnique({
        where: { id: latest.resendOfEmailId },
        include: { recipients: true },
      });
      const deliveredResend = latest.recipients.filter(
        (r) => r.status === "DELIVERED" || r.status === "OPENED",
      );
      const originalStillFailed = original?.recipients.filter(
        (o) =>
          (o.status === "FAILED" || o.status === "BOUNCED") &&
          deliveredResend.some(
            (r) =>
              r.email.toLowerCase() === o.email.toLowerCase() && r.recipientType === o.recipientType,
          ),
      );
      if (!originalStillFailed?.length) return latest;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`email ${id} did not leave QUEUED`);
}

async function seedOriginal(opts: {
  subject?: string;
  bodyHtml?: string;
  status?: string;
  campaignId?: number | null;
  senderIdentityId?: number | null;
  fromEmail?: string;
  fromName?: string | null;
  includeUnsubscribe?: boolean;
  scheduledAt?: Date | null;
  recipients: { email: string; type: string; status: string; name?: string }[];
  attachments?: { fileName: string; contentType: string; content: Buffer }[];
}) {
  const email = await prisma.sentEmail.create({
    data: {
      subject: opts.subject ?? "Original subject",
      bodyHtml: opts.bodyHtml ?? "<p>Hello</p>",
      sentByUserId: actor.userId,
      sentByEmail: actor.email,
      sentByName: "Resend Tester",
      senderIdentityId: opts.senderIdentityId ?? null,
      fromEmail: opts.fromEmail ?? "from@mailroom.test",
      fromName: opts.fromName ?? "From Name",
      sentAt: opts.scheduledAt ?? new Date(),
      scheduledAt: opts.scheduledAt ?? null,
      status: opts.status ?? "FAILED",
      campaignId: opts.campaignId ?? null,
      includeUnsubscribe: opts.includeUnsubscribe ?? false,
      recipients: {
        create: opts.recipients.map((r) => ({
          email: r.email,
          name: r.name ?? null,
          recipientType: r.type,
          status: r.status,
          openTrackingToken: randomUUID(),
          unsubscribeToken: opts.includeUnsubscribe ? randomUUID() : null,
          errorMessage: r.status === "FAILED" || r.status === "BOUNCED" ? "smtp failed" : null,
          deliveredAt: r.status === "DELIVERED" || r.status === "OPENED" ? new Date() : null,
          openedAt: r.status === "OPENED" ? new Date() : null,
        })),
      },
      attachments: opts.attachments?.length
        ? {
            create: opts.attachments.map((a) => ({
              fileName: a.fileName,
              contentType: a.contentType,
              content: a.content,
            })),
          }
        : undefined,
    },
    include: { recipients: true, attachments: true },
  });
  createdEmailIds.push(email.id);
  return email;
}

describe("resendEmail", () => {
  before(async () => {
    const user = await prisma.adminUser.create({
      data: {
        email: addr(`actor-${Date.now()}`),
        firstName: "Resend",
        lastName: "Tester",
        password: "not-used",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(user.id);
    actor = {
      userId: user.id,
      email: user.email,
      firstName: "Resend",
      lastName: "Tester",
      roles: ["SUPER_ADMIN"],
      permissions: ["emails:write"],
    };
  });

  beforeEach(() => {
    sentMail = [];
    failAddresses = new Set();
    setTransportFactoryForTests(() => mockTransport());
    setSmtpSettingsForTests({
      host: "smtp.resendcase.test",
      port: 587,
      username: "smtp-user",
      password: "smtp-pass",
    });
  });

  afterEach(async () => {
    setTransportFactoryForTests(null);
    setSmtpSettingsForTests(undefined);
    if (createdEmailIds.length) {
      await prisma.sentEmail.deleteMany({
        where: { OR: [{ id: { in: createdEmailIds } }, { resendOfEmailId: { in: createdEmailIds } }] },
      });
      createdEmailIds.length = 0;
    }
    if (createdSuppressionIds.length) {
      await prisma.emailSuppression.deleteMany({ where: { id: { in: createdSuppressionIds } } });
      createdSuppressionIds.length = 0;
    }
    if (createdIdentityIds.length) {
      await prisma.emailSenderIdentity.deleteMany({ where: { id: { in: createdIdentityIds } } });
      createdIdentityIds.length = 0;
    }
    if (createdCampaignIds.length) {
      await prisma.emailCampaign.deleteMany({ where: { id: { in: createdCampaignIds } } });
      createdCampaignIds.length = 0;
    }
    await prisma.emailDraft.deleteMany({ where: { userId: { in: createdUserIds } } });
  });

  after(async () => {
    if (createdUserIds.length) {
      await prisma.adminUser.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("returns 404 when the original email does not exist", async () => {
    await assert.rejects(
      () => resendEmail(999_999_999, actor, "ALL"),
      (err: unknown) => {
        assertAppError(err, Codes.SENT_EMAIL, Msg.NOT_FOUND);
        return true;
      },
    );
  });

  it("rejects FAILED mode when there is no failed TO recipient", async () => {
    const original = await seedOriginal({
      status: "DELIVERED",
      recipients: [
        { email: addr("ok"), type: "TO", status: "DELIVERED" },
        { email: addr("cc-fail"), type: "CC", status: "FAILED" },
      ],
    });
    await assert.rejects(
      () => resendEmail(original.id, actor, "FAILED"),
      (err: unknown) => {
        assertAppError(err, Codes.SENT_EMAIL, Msg.EMAIL_RESEND_NO_RECIPIENTS);
        return true;
      },
    );
  });

  it("rejects FAILED mode when only bounced CC exists", async () => {
    const original = await seedOriginal({
      recipients: [
        { email: addr("ok"), type: "TO", status: "DELIVERED" },
        { email: addr("bcc-bounce"), type: "BCC", status: "BOUNCED" },
      ],
    });
    await assert.rejects(
      () => resendEmail(original.id, actor, "failed"),
      (err: unknown) => {
        assertAppError(err, Codes.SENT_EMAIL, Msg.EMAIL_RESEND_NO_RECIPIENTS);
        return true;
      },
    );
  });

  it("resends ALL recipients including CC and BCC, copying subject html names and from", async () => {
    const original = await seedOriginal({
      subject: "Quarterly update",
      bodyHtml: "<p>Body copy</p>",
      fromEmail: "news@mailroom.test",
      fromName: "Newsroom",
      includeUnsubscribe: true,
      recipients: [
        { email: addr("to1"), type: "TO", status: "DELIVERED", name: "To One" },
        { email: addr("to2"), type: "TO", status: "FAILED", name: "To Two" },
        { email: addr("cc1"), type: "CC", status: "DELIVERED", name: "Cc One" },
        { email: addr("bcc1"), type: "BCC", status: "FAILED", name: "Bcc One" },
      ],
    });

    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));

    assert.equal(result.recipientCount, 4);
    assert.equal(resent.resendOfEmailId, original.id);
    assert.equal(resent.subject, "Quarterly update");
    assert.equal(resent.bodyHtml, "<p>Body copy</p>");
    assert.equal(resent.includeUnsubscribe, true);
    assert.equal(resent.fromEmail, "news@mailroom.test");
    assert.equal(resent.fromName, "Newsroom");
    assert.equal(resent.status, "DELIVERED");

    const byType = (type: string) => resent.recipients.filter((r) => r.recipientType === type);
    assert.deepEqual(
      byType("TO").map((r) => r.email).sort(),
      [addr("to1"), addr("to2")].sort(),
    );
    assert.equal(byType("CC")[0].email, addr("cc1"));
    assert.equal(byType("BCC")[0].email, addr("bcc1"));
    assert.equal(byType("TO").find((r) => r.email === addr("to1"))?.name, "To One");
    assert.equal(sentMail.length, 4);
    assert.ok(sentMail.every((m) => m.subject === "Quarterly update"));
    assert.ok(sentMail.every((m) => Array.isArray(m.to) && m.to.length === 1));
  });

  it("resends only FAILED and BOUNCED recipients in FAILED mode", async () => {
    const original = await seedOriginal({
      recipients: [
        { email: addr("ok"), type: "TO", status: "DELIVERED" },
        { email: addr("fail"), type: "TO", status: "FAILED" },
        { email: addr("bounce"), type: "TO", status: "BOUNCED" },
        { email: addr("opened"), type: "TO", status: "OPENED" },
        { email: addr("cc-fail"), type: "CC", status: "FAILED" },
      ],
    });

    const result = await resendEmail(original.id, actor, "FAILED");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));

    assert.equal(result.recipientCount, 3);
    assert.deepEqual(
      resent.recipients.map((r) => r.email).sort(),
      [addr("bounce"), addr("cc-fail"), addr("fail")].sort(),
    );
    assert.equal(sentMail.length, 3);
  });

  it("defaults to ALL when mode is omitted", async () => {
    const original = await seedOriginal({
      recipients: [
        { email: addr("a"), type: "TO", status: "DELIVERED" },
        { email: addr("b"), type: "TO", status: "FAILED" },
      ],
    });
    const result = await resendEmail(original.id, actor);
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(resent.recipients.length, 2);
  });

  it("treats unknown mode as ALL", async () => {
    const original = await seedOriginal({
      recipients: [
        { email: addr("a"), type: "TO", status: "DELIVERED" },
        { email: addr("b"), type: "TO", status: "FAILED" },
      ],
    });
    const result = await resendEmail(original.id, actor, "WHATEVER");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(resent.recipients.length, 2);
  });

  it("copies file attachments byte-for-byte", async () => {
    const content = Buffer.from("attachment-bytes-ä");
    const original = await seedOriginal({
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
      attachments: [{ fileName: "note.txt", contentType: "text/plain", content }],
    });
    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(resent.attachments.length, 1);
    assert.equal(resent.attachments[0].fileName, "note.txt");
    assert.equal(resent.attachments[0].contentType, "text/plain");
    assert.deepEqual(Buffer.from(resent.attachments[0].content), content);
    assert.ok(
      sentMail[0].attachments?.some(
        (a) => a.filename === "note.txt" && a.content && Buffer.from(a.content).equals(content),
      ),
    );
  });

  it("embeds inline data images as cid attachments on send", async () => {
    const bodyHtml = `<p>Hi</p><img src="data:image/png;base64,${PIXEL_B64}" alt="logo" />`;
    const original = await seedOriginal({
      bodyHtml,
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
    });
    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    await waitUntilSettled(Number(result.id));

    assert.equal(sentMail.length, 1);
    assert.match(String(sentMail[0].html), /cid:inline-img-1/);
    assert.doesNotMatch(String(sentMail[0].html), /data:image\/png/);
    const inline = sentMail[0].attachments?.find((a) => a.cid === "inline-img-1");
    assert.ok(inline);
    assert.equal(inline?.contentType, "image/png");
    assert.deepEqual(inline?.content, Buffer.from(PIXEL_B64, "base64"));
  });

  it("generates new tracking tokens instead of reusing the original ones", async () => {
    const original = await seedOriginal({
      includeUnsubscribe: true,
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
    });
    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.notEqual(resent.recipients[0].openTrackingToken, original.recipients[0].openTrackingToken);
    assert.notEqual(resent.recipients[0].unsubscribeToken, original.recipients[0].unsubscribeToken);
    assert.ok(resent.recipients[0].openTrackingToken);
    assert.ok(resent.recipients[0].unsubscribeToken);
  });

  it("marks original failed recipients delivered after a successful resend", async () => {
    const original = await seedOriginal({
      recipients: [
        { email: addr("ok"), type: "TO", status: "DELIVERED" },
        { email: addr("fail"), type: "TO", status: "FAILED" },
      ],
    });
    const result = await resendEmail(original.id, actor, "FAILED");
    createdEmailIds.push(Number(result.id));
    await waitUntilSettled(Number(result.id));

    const updated = await prisma.sentEmail.findUnique({
      where: { id: original.id },
      include: { recipients: true },
    });
    assert.equal(updated?.status, "DELIVERED");
    assert.equal(updated?.recipients.find((r) => r.email === addr("fail"))?.status, "DELIVERED");
    assert.equal(updated?.recipients.find((r) => r.email === addr("fail"))?.errorMessage, null);
    assert.equal(updated?.recipients.find((r) => r.email === addr("ok"))?.status, "DELIVERED");
  });

  it("does not change original recipients when the resend also fails", async () => {
    failAddresses.add(addr("fail"));
    const original = await seedOriginal({
      recipients: [{ email: addr("fail"), type: "TO", status: "FAILED" }],
    });
    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(resent.status, "FAILED");
    assert.match(resent.recipients[0].errorMessage ?? "", /smtp-rejected/);

    const updated = await prisma.sentEmail.findUnique({
      where: { id: original.id },
      include: { recipients: true },
    });
    assert.equal(updated?.status, "FAILED");
    assert.equal(updated?.recipients[0].status, "FAILED");
    assert.equal(updated?.recipients[0].errorMessage, "smtp failed");
  });

  it("updates only the failed original recipient when a mixed resend partly fails", async () => {
    failAddresses.add(addr("still-fail"));
    const original = await seedOriginal({
      recipients: [
        { email: addr("recover"), type: "TO", status: "FAILED" },
        { email: addr("still-fail"), type: "TO", status: "FAILED" },
      ],
    });
    const result = await resendEmail(original.id, actor, "FAILED");
    createdEmailIds.push(Number(result.id));
    await waitUntilSettled(Number(result.id));

    const updated = await prisma.sentEmail.findUnique({
      where: { id: original.id },
      include: { recipients: true },
    });
    assert.equal(updated?.recipients.find((r) => r.email === addr("recover"))?.status, "DELIVERED");
    assert.equal(updated?.recipients.find((r) => r.email === addr("still-fail"))?.status, "FAILED");
    assert.equal(updated?.status, "FAILED");
  });

  it("does not overwrite an OPENED original recipient when resending ALL", async () => {
    const original = await seedOriginal({
      status: "OPENED",
      recipients: [{ email: addr("opened"), type: "TO", status: "OPENED" }],
    });
    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    await waitUntilSettled(Number(result.id));
    const updated = await prisma.sentEmail.findUnique({
      where: { id: original.id },
      include: { recipients: true },
    });
    assert.equal(updated?.recipients[0].status, "OPENED");
    assert.equal(updated?.status, "OPENED");
  });

  it("skips suppressed recipients and reports suppressedCount", async () => {
    const blocked = await prisma.emailSuppression.create({
      data: { email: addr("blocked"), unsubscribedAt: new Date(), source: "ONE_CLICK" },
    });
    createdSuppressionIds.push(blocked.id);

    const original = await seedOriginal({
      recipients: [
        { email: addr("ok"), type: "TO", status: "FAILED" },
        { email: addr("blocked"), type: "TO", status: "FAILED" },
      ],
    });
    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(result.recipientCount, 1);
    assert.equal(result.suppressedCount, 1);
    assert.deepEqual(
      resent.recipients.map((r) => r.email),
      [addr("ok")],
    );
    assert.equal(sentMail.length, 1);
  });

  it("fails when every TO recipient is suppressed", async () => {
    const blocked = await prisma.emailSuppression.create({
      data: { email: addr("only"), unsubscribedAt: new Date(), source: "MANUAL" },
    });
    createdSuppressionIds.push(blocked.id);
    const original = await seedOriginal({
      recipients: [{ email: addr("only"), type: "TO", status: "FAILED" }],
    });
    await assert.rejects(
      () => resendEmail(original.id, actor, "ALL"),
      (err: unknown) => {
        assertAppError(err, Codes.SENT_EMAIL, Msg.EMAIL_ALL_RECIPIENTS_SUPPRESSED);
        return true;
      },
    );
  });

  it("keeps the current composer draft instead of deleting it", async () => {
    await prisma.emailDraft.create({
      data: { userId: actor.userId, subject: "Keep me", bodyHtml: "<p>draft</p>" },
    });
    const original = await seedOriginal({
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
    });
    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    await waitUntilSettled(Number(result.id));
    const draft = await prisma.emailDraft.findUnique({ where: { userId: actor.userId } });
    assert.equal(draft?.subject, "Keep me");
  });

  it("still sends when the original sender identity is inactive", async () => {
    const identity = await prisma.emailSenderIdentity.create({
      data: {
        email: "inactive@mailroom.test",
        displayName: "Inactive",
        defaultSender: false,
        active: true,
      },
    });
    createdIdentityIds.push(identity.id);
    const original = await seedOriginal({
      senderIdentityId: identity.id,
      fromEmail: "inactive@mailroom.test",
      fromName: "Inactive",
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
    });
    await prisma.emailSenderIdentity.update({
      where: { id: identity.id },
      data: { active: false },
    });

    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(resent.fromEmail, "inactive@mailroom.test");
    assert.equal(resent.senderIdentityId, null);
    assert.equal(resent.status, "DELIVERED");
  });

  it("still sends when the original sender identity was deleted", async () => {
    const identity = await prisma.emailSenderIdentity.create({
      data: {
        email: "gone@mailroom.test",
        displayName: "Gone",
        defaultSender: false,
        active: true,
      },
    });
    const original = await seedOriginal({
      senderIdentityId: identity.id,
      fromEmail: "gone@mailroom.test",
      fromName: "Gone",
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
    });
    await prisma.emailSenderIdentity.delete({ where: { id: identity.id } });

    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(resent.fromEmail, "gone@mailroom.test");
    assert.equal(resent.fromName, "Gone");
    assert.equal(resent.senderIdentityId, null);
    assert.match(String(sentMail[0].from), /gone@mailroom.test/);
  });

  it("still sends when the original campaign was deleted", async () => {
    const campaign = await prisma.emailCampaign.create({
      data: { name: `resend-campaign-${Date.now()}` },
    });
    const original = await seedOriginal({
      campaignId: campaign.id,
      includeUnsubscribe: true,
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
    });
    await prisma.emailCampaign.delete({ where: { id: campaign.id } });

    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(resent.campaignId, null);
    assert.equal(resent.includeUnsubscribe, true);
    assert.equal(resent.status, "DELIVERED");
  });

  it("copies campaign id when the campaign still exists", async () => {
    const campaign = await prisma.emailCampaign.create({
      data: { name: `resend-campaign-keep-${Date.now()}` },
    });
    createdCampaignIds.push(campaign.id);
    const original = await seedOriginal({
      campaignId: campaign.id,
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
    });
    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(resent.campaignId, campaign.id);
  });

  it("sends immediately even if the original was still scheduled", async () => {
    const later = new Date(Date.now() + 60 * 60 * 1000);
    const original = await seedOriginal({
      status: "SCHEDULED",
      scheduledAt: later,
      recipients: [{ email: addr("to"), type: "TO", status: "QUEUED" }],
    });
    const result = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(result.id));
    const resent = await waitUntilSettled(Number(result.id));
    assert.equal(resent.status, "DELIVERED");
    assert.equal(resent.scheduledAt, null);
  });

  it("chains a resend of a resend to the immediate parent", async () => {
    const original = await seedOriginal({
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
    });
    const first = await resendEmail(original.id, actor, "ALL");
    createdEmailIds.push(Number(first.id));
    await waitUntilSettled(Number(first.id));

    failAddresses.add(addr("to"));
    await prisma.sentEmailRecipient.updateMany({
      where: { sentEmailId: Number(first.id) },
      data: { status: "FAILED", errorMessage: "later-fail" },
    });
    await prisma.sentEmail.update({
      where: { id: Number(first.id) },
      data: { status: "FAILED" },
    });
    failAddresses.delete(addr("to"));

    const second = await resendEmail(Number(first.id), actor, "FAILED");
    createdEmailIds.push(Number(second.id));
    const resent = await waitUntilSettled(Number(second.id));
    assert.equal(resent.resendOfEmailId, Number(first.id));
    assert.equal(resent.status, "DELIVERED");
  });

  it("does not send until SMTP is configured", async () => {
    setSmtpSettingsForTests(null);
    const original = await seedOriginal({
      recipients: [{ email: addr("to"), type: "TO", status: "FAILED" }],
    });
    await assert.rejects(
      () => resendEmail(original.id, actor, "ALL"),
      (err: unknown) => {
        assertAppError(err, Codes.MAIL_CONFIG, Msg.MAIL_NOT_CONFIGURED);
        return true;
      },
    );
    assert.equal(sentMail.length, 0);
  });
});
