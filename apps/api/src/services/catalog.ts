import { prisma } from "../db.js";
import { config } from "../config.js";
import { Codes, Msg, bad, notFound } from "../errors.js";
import { formatFromLabel } from "../mail/html.js";
import { assertAttachmentCount, assertAttachmentSize, decodeAttachmentBase64 } from "../mail/attachments.js";
import { normalizeEmail } from "./auth.js";

function pageParams(page?: number, limit?: number, maxLimit = 100) {
  const p = !page || page < 1 ? 1 : page;
  const l = !limit || limit < 1 ? 20 : Math.min(limit, maxLimit);
  return { page: p, limit: l, skip: (p - 1) * l };
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined;
}

const attachmentMetaSelect = {
  id: true,
  fileName: true,
  contentType: true,
  size: true,
} as const;

export async function searchTemplates(search?: string, page?: number, limit?: number) {
  const p = pageParams(page, limit);
  const where = search?.trim()
    ? {
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" as const } },
          { subject: { contains: search.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.emailTemplate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: p.skip,
      take: p.limit,
      include: { attachments: { select: attachmentMetaSelect, orderBy: { id: "asc" } } },
    }),
    prisma.emailTemplate.count({ where }),
  ]);
  return {
    items: items.map(mapTemplate),
    total,
    page: p.page,
    limit: p.limit,
  };
}

export type TemplateAttachmentInput = {
  id?: number;
  fileName: string;
  contentType: string;
  contentBase64?: string;
};

function mapAttachmentMeta(a: { id: number; fileName: string; contentType: string; size: number }) {
  return {
    id: a.id,
    fileName: a.fileName,
    contentType: a.contentType,
    size: a.size,
  };
}

function mapTemplate(t: {
  id: number;
  name: string;
  description: string | null;
  subject: string | null;
  htmlBody: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments?: { id: number; fileName: string; contentType: string; size: number }[];
}) {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? undefined,
    subject: t.subject ?? undefined,
    htmlBody: t.htmlBody ?? undefined,
    attachments: (t.attachments ?? []).map(mapAttachmentMeta),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  };
}

async function loadTemplateWithAttachments(id: number) {
  const t = await prisma.emailTemplate.findUnique({
    where: { id },
    include: { attachments: { select: attachmentMetaSelect, orderBy: { id: "asc" } } },
  });
  if (!t) throw notFound(Codes.EMAIL_TEMPLATE, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_TEMPLATE);
  return t;
}

export async function getTemplate(id: number) {
  return mapTemplate(await loadTemplateWithAttachments(id));
}

export async function findTemplate(id: number) {
  const t = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!t) throw notFound(Codes.EMAIL_TEMPLATE, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_TEMPLATE);
  return t;
}

export async function loadTemplateAttachmentFiles(templateId: number) {
  const rows = await prisma.emailTemplateAttachment.findMany({
    where: { templateId },
    orderBy: { id: "asc" },
  });
  return rows.map((a) => ({
    fileName: a.fileName,
    contentType: a.contentType,
    content: Buffer.from(a.content),
  }));
}

async function replaceTemplateAttachments(templateId: number, incoming?: TemplateAttachmentInput[]) {
  if (incoming === undefined) {
    return;
  }
  assertAttachmentCount(incoming.length);
  const existing = await prisma.emailTemplateAttachment.findMany({
    where: { templateId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));
  const keepIds: number[] = [];

  for (const item of incoming) {
    if (!item.id) continue;
    if (!existingIds.has(item.id)) {
      throw bad(Codes.EMAIL_TEMPLATE, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_TEMPLATE);
    }
    keepIds.push(item.id);
  }

  if (keepIds.length) {
    await prisma.emailTemplateAttachment.deleteMany({
      where: { templateId, id: { notIn: keepIds } },
    });
  } else {
    await prisma.emailTemplateAttachment.deleteMany({ where: { templateId } });
  }

  for (const item of incoming) {
    if (item.id) continue;
    if (!item.contentBase64) {
      throw bad(Codes.SENT_EMAIL, Msg.EMAIL_ATTACHMENT_INVALID);
    }
    const content = decodeAttachmentBase64(item.contentBase64);
    assertAttachmentSize(content);
    await prisma.emailTemplateAttachment.create({
      data: {
        templateId,
        fileName: item.fileName.trim() || "attachment",
        contentType: item.contentType.trim() || "application/octet-stream",
        size: content.length,
        content: new Uint8Array(content),
      },
    });
  }
}

async function ensureUniqueTemplateName(name: string, excludeId?: number) {
  const found = await prisma.emailTemplate.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (found) throw bad(Codes.EMAIL_TEMPLATE, Msg.TEMPLATE_NAME_EXISTS, name);
}

export async function createTemplate(body: {
  name: string;
  description?: string;
  subject?: string;
  htmlBody?: string;
  attachments?: TemplateAttachmentInput[];
}) {
  const name = body.name.trim();
  await ensureUniqueTemplateName(name);
  const t = await prisma.emailTemplate.create({
    data: {
      name,
      description: body.description?.trim() || null,
      subject: body.subject?.trim() || null,
      htmlBody: body.htmlBody?.trim() || null,
    },
  });
  await replaceTemplateAttachments(t.id, body.attachments ?? []);
  return getTemplate(t.id);
}

export async function updateTemplate(
  id: number,
  body: {
    name: string;
    description?: string;
    subject?: string;
    htmlBody?: string;
    attachments?: TemplateAttachmentInput[];
  },
) {
  await findTemplate(id);
  const name = body.name.trim();
  await ensureUniqueTemplateName(name, id);
  await prisma.emailTemplate.update({
    where: { id },
    data: {
      name,
      description: body.description?.trim() || null,
      subject: body.subject?.trim() || null,
      htmlBody: body.htmlBody?.trim() || null,
    },
  });
  await replaceTemplateAttachments(id, body.attachments);
  return getTemplate(id);
}

export async function deleteTemplate(id: number) {
  await findTemplate(id);
  const used = await prisma.emailCampaign.count({ where: { templateId: id } });
  if (used) throw bad(Codes.EMAIL_TEMPLATE, Msg.TEMPLATE_IN_USE);
  await prisma.emailTemplate.delete({ where: { id } });
}

const contactLabelInclude = {
  labelLinks: {
    include: { label: true },
    orderBy: { label: { name: "asc" as const } },
  },
} as const;

type ContactWithLabels = {
  id: number;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  labelLinks?: { label: { id: number; name: string } }[];
};

function mapContact(c: ContactWithLabels) {
  const labels = (c.labelLinks ?? []).map((link) => ({
    id: link.label.id,
    name: link.label.name,
  }));
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? undefined,
    labels,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

function normalizeLabelNames(labels?: string[] | null): string[] {
  if (!labels?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const name = raw?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name.slice(0, 120));
  }
  return out;
}

async function ensureLabelIds(names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names) {
    const existing = await prisma.emailLabel.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const created = await prisma.emailLabel.create({ data: { name } });
    ids.push(created.id);
  }
  return ids;
}

async function replaceContactLabels(contactId: number, labels?: string[] | null) {
  if (labels === undefined) return;
  const names = normalizeLabelNames(labels);
  const labelIds = await ensureLabelIds(names);
  await prisma.emailContactLabel.deleteMany({ where: { contactId } });
  if (!labelIds.length) return;
  await prisma.emailContactLabel.createMany({
    data: labelIds.map((labelId) => ({ contactId, labelId })),
    skipDuplicates: true,
  });
}

async function loadContact(id: number) {
  const c = await prisma.emailAddressBookContact.findUnique({
    where: { id },
    include: contactLabelInclude,
  });
  if (!c) throw notFound(Codes.EMAIL_ADDRESS_BOOK_CONTACT, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_CONTACT);
  return c;
}

export async function listLabels(search?: string) {
  const where = search?.trim()
    ? { name: { contains: search.trim(), mode: "insensitive" as const } }
    : {};
  const items = await prisma.emailLabel.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });
  return items.map((l) => ({
    id: l.id,
    name: l.name,
    contactCount: l._count.contacts,
    createdAt: iso(l.createdAt),
    updatedAt: iso(l.updatedAt),
  }));
}

async function findLabel(id: number) {
  const label = await prisma.emailLabel.findUnique({
    where: { id },
    include: { _count: { select: { contacts: true } } },
  });
  if (!label) throw notFound(Codes.EMAIL_LABEL, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_LABEL);
  return label;
}

function mapLabel(l: {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { contacts: number };
}) {
  return {
    id: l.id,
    name: l.name,
    contactCount: l._count?.contacts ?? 0,
    createdAt: iso(l.createdAt),
    updatedAt: iso(l.updatedAt),
  };
}

export async function createLabel(body: { name: string }) {
  const name = body.name.trim().slice(0, 120);
  if (!name) throw bad(Codes.EMAIL_LABEL, Msg.VALIDATION_FAILED);
  const exists = await prisma.emailLabel.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (exists) throw bad(Codes.EMAIL_LABEL, Msg.EMAIL_LABEL_EXISTS, name);
  const created = await prisma.emailLabel.create({ data: { name } });
  return mapLabel({ ...created, _count: { contacts: 0 } });
}

export async function updateLabel(id: number, body: { name: string }) {
  await findLabel(id);
  const name = body.name.trim().slice(0, 120);
  if (!name) throw bad(Codes.EMAIL_LABEL, Msg.VALIDATION_FAILED);
  const clash = await prisma.emailLabel.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
  });
  if (clash) throw bad(Codes.EMAIL_LABEL, Msg.EMAIL_LABEL_EXISTS, name);
  const updated = await prisma.emailLabel.update({
    where: { id },
    data: { name },
    include: { _count: { select: { contacts: true } } },
  });
  return mapLabel(updated);
}

export async function deleteLabel(id: number) {
  await findLabel(id);
  await prisma.emailLabel.delete({ where: { id } });
}

export async function searchContacts(search?: string, page?: number, limit?: number, label?: string) {
  const p = pageParams(page, limit, 100);
  const labelName = label?.trim();
  const where = {
    ...(search?.trim()
      ? {
          OR: [
            { email: { contains: search.trim(), mode: "insensitive" as const } },
            { name: { contains: search.trim(), mode: "insensitive" as const } },
            {
              labelLinks: {
                some: { label: { name: { contains: search.trim(), mode: "insensitive" as const } } },
              },
            },
          ],
        }
      : {}),
    ...(labelName
      ? {
          labelLinks: {
            some: { label: { name: { equals: labelName, mode: "insensitive" as const } } },
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.emailAddressBookContact.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: p.skip,
      take: p.limit,
      include: contactLabelInclude,
    }),
    prisma.emailAddressBookContact.count({ where }),
  ]);
  return { items: items.map(mapContact), total, page: p.page, limit: p.limit };
}

export async function getContact(id: number) {
  return mapContact(await loadContact(id));
}

export async function createContact(body: { email: string; name?: string; labels?: string[] }) {
  const email = normalizeEmail(body.email);
  const exists = await prisma.emailAddressBookContact.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (exists) throw bad(Codes.EMAIL_ADDRESS_BOOK_CONTACT, Msg.EMAIL_CONTACT_EXISTS, email);
  const c = await prisma.emailAddressBookContact.create({
    data: { email, name: body.name?.trim() || null },
  });
  await replaceContactLabels(c.id, body.labels ?? []);
  return getContact(c.id);
}

export async function updateContact(id: number, body: { email: string; name?: string; labels?: string[] }) {
  await loadContact(id);
  const email = normalizeEmail(body.email);
  const clash = await prisma.emailAddressBookContact.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, NOT: { id } },
  });
  if (clash) throw bad(Codes.EMAIL_ADDRESS_BOOK_CONTACT, Msg.EMAIL_CONTACT_EXISTS, email);
  await prisma.emailAddressBookContact.update({
    where: { id },
    data: { email, name: body.name?.trim() || null },
  });
  await replaceContactLabels(id, body.labels);
  return getContact(id);
}

export async function ensureContact(body: { email: string; name?: string; labels?: string[] }) {
  const email = normalizeEmail(body.email);
  if (!email) throw bad(Codes.EMAIL_ADDRESS_BOOK_CONTACT, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_CONTACT);
  const name = body.name?.trim() || null;
  const existing = await prisma.emailAddressBookContact.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) {
    if (name && name !== (existing.name ?? null)) {
      await prisma.emailAddressBookContact.update({
        where: { id: existing.id },
        data: { name },
      });
    }
    if (body.labels !== undefined) {
      await replaceContactLabels(existing.id, body.labels);
    }
    return getContact(existing.id);
  }
  const created = await prisma.emailAddressBookContact.create({
    data: { email, name },
  });
  await replaceContactLabels(created.id, body.labels ?? []);
  return getContact(created.id);
}

export async function deleteContact(id: number) {
  await loadContact(id);
  const inUse = await prisma.emailCampaignContact.count({ where: { contactId: id } });
  if (inUse > 0) {
    throw bad(Codes.EMAIL_ADDRESS_BOOK_CONTACT, Msg.EMAIL_CONTACT_IN_USE);
  }
  await prisma.emailAddressBookContact.delete({ where: { id } });
}


type DraftRecipient = { email: string; name?: string | null };

function mapDraft(d: {
  id: number;
  subject: string | null;
  bodyHtml: string | null;
  campaignId: number | null;
  showCc: boolean;
  showBcc: boolean;
  updatedAt: Date;
  recipients: { email: string; name: string | null; recipientType: string }[];
}) {
  const of = (type: string) =>
    d.recipients
      .filter((r) => r.recipientType === type)
      .map((r) => ({ email: r.email, name: r.name ?? undefined }));
  return {
    id: d.id,
    subject: d.subject ?? undefined,
    bodyHtml: d.bodyHtml ?? undefined,
    campaignId: d.campaignId,
    showCc: d.showCc,
    showBcc: d.showBcc,
    to: of("TO"),
    cc: of("CC"),
    bcc: of("BCC"),
    updatedAt: iso(d.updatedAt),
  };
}

export async function getCurrentDraft(userId: number) {
  const d = await prisma.emailDraft.findUnique({
    where: { userId },
    include: { recipients: { orderBy: { id: "asc" } } },
  });
  return d ? mapDraft(d) : null;
}

function hasDraftContent(body: {
  subject?: string;
  bodyHtml?: string;
  to?: DraftRecipient[];
  cc?: DraftRecipient[];
  bcc?: DraftRecipient[];
}) {
  if (body.subject?.trim() || body.bodyHtml?.trim()) return true;
  const any = (list?: DraftRecipient[]) => list?.some((r) => r?.email?.trim());
  return Boolean(any(body.to) || any(body.cc) || any(body.bcc));
}

export async function saveCurrentDraft(
  userId: number,
  body: {
    subject?: string;
    bodyHtml?: string;
    campaignId?: number | null;
    showCc?: boolean;
    showBcc?: boolean;
    to?: DraftRecipient[];
    cc?: DraftRecipient[];
    bcc?: DraftRecipient[];
  },
) {
  if (!hasDraftContent(body)) {
    await deleteCurrentDraft(userId);
    return null;
  }
  const existing = await prisma.emailDraft.findUnique({ where: { userId } });
  const data = {
    subject: body.subject?.trim() || null,
    bodyHtml: body.bodyHtml?.trim() || null,
    campaignId: body.campaignId ?? null,
    showCc: body.showCc ?? false,
    showBcc: body.showBcc ?? false,
  };
  const draft = existing
    ? await prisma.emailDraft.update({ where: { id: existing.id }, data })
    : await prisma.emailDraft.create({ data: { userId, ...data } });

  await prisma.emailDraftRecipient.deleteMany({ where: { draftId: draft.id } });
  const rows: { draftId: number; email: string; name: string | null; recipientType: string }[] = [];
  const push = (list: DraftRecipient[] | undefined, type: string) => {
    const seen = new Set<string>();
    for (const r of list ?? []) {
      if (!r?.email?.trim()) continue;
      const email = normalizeEmail(r.email);
      if (seen.has(email)) continue;
      seen.add(email);
      rows.push({ draftId: draft.id, email, name: r.name?.trim() || null, recipientType: type });
    }
  };
  push(body.to, "TO");
  push(body.cc, "CC");
  push(body.bcc, "BCC");
  if (rows.length) await prisma.emailDraftRecipient.createMany({ data: rows });
  return getCurrentDraft(userId);
}

export async function deleteCurrentDraft(userId: number) {
  await prisma.emailDraft.deleteMany({ where: { userId } });
}

function mapSender(s: {
  id: number;
  email: string;
  displayName: string;
  defaultSender: boolean;
  active: boolean;
}) {
  return {
    id: String(s.id),
    email: s.email,
    displayName: s.displayName,
    defaultSender: s.defaultSender,
    active: s.active,
    label: formatFromLabel(s.displayName, s.email),
  };
}

export async function listActiveSenders() {
  const items = await prisma.emailSenderIdentity.findMany({
    where: { active: true },
    orderBy: { displayName: "asc" },
  });
  return items.map(mapSender);
}

export async function listAllSenders() {
  const items = await prisma.emailSenderIdentity.findMany({ orderBy: { displayName: "asc" } });
  return items.map(mapSender);
}

async function clearDefaultSender(exceptId?: number) {
  await prisma.emailSenderIdentity.updateMany({
    where: exceptId ? { NOT: { id: exceptId } } : {},
    data: { defaultSender: false },
  });
}

export async function createSender(body: {
  email: string;
  displayName: string;
  defaultSender?: boolean;
  active?: boolean;
}) {
  const email = normalizeEmail(body.email);
  const exists = await prisma.emailSenderIdentity.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (exists) throw bad(Codes.EMAIL_SENDER_IDENTITY, Msg.EMAIL_SENDER_EXISTS);
  if (body.defaultSender) await clearDefaultSender();
  const s = await prisma.emailSenderIdentity.create({
    data: {
      email,
      displayName: body.displayName.trim(),
      defaultSender: Boolean(body.defaultSender),
      active: body.active ?? true,
    },
  });
  return mapSender(s);
}

export async function updateSender(
  id: number,
  body: { email: string; displayName: string; defaultSender?: boolean; active?: boolean },
) {
  const identity = await prisma.emailSenderIdentity.findUnique({ where: { id } });
  if (!identity) throw notFound(Codes.EMAIL_SENDER_IDENTITY, Msg.NOT_FOUND, id);
  const email = normalizeEmail(body.email);
  const clash = await prisma.emailSenderIdentity.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, NOT: { id } },
  });
  if (clash) throw bad(Codes.EMAIL_SENDER_IDENTITY, Msg.EMAIL_SENDER_EXISTS);
  if (body.defaultSender) await clearDefaultSender(id);
  const s = await prisma.emailSenderIdentity.update({
    where: { id },
    data: {
      email,
      displayName: body.displayName.trim(),
      active: body.active ?? identity.active,
      defaultSender: body.defaultSender ?? identity.defaultSender,
    },
  });
  return mapSender(s);
}

export async function deleteSender(id: number) {
  const identity = await prisma.emailSenderIdentity.findUnique({ where: { id } });
  if (!identity) throw notFound(Codes.EMAIL_SENDER_IDENTITY, Msg.NOT_FOUND, id);
  await prisma.emailSenderIdentity.delete({ where: { id } });
}

export async function resolveFromAddress(senderIdentityId?: number | null) {
  if (senderIdentityId) {
    const identity = await prisma.emailSenderIdentity.findFirst({
      where: { id: senderIdentityId, active: true },
    });
    if (!identity) throw notFound(Codes.EMAIL_SENDER_IDENTITY, Msg.NOT_FOUND, senderIdentityId);
    return { email: identity.email, displayName: identity.displayName };
  }
  const def = await prisma.emailSenderIdentity.findFirst({
    where: { defaultSender: true, active: true },
  });
  if (def) return { email: def.email, displayName: def.displayName };
  const mail = await prisma.adminMailConfig.findFirst({ orderBy: { id: "asc" } });
  if (mail?.username) return { email: mail.username.trim(), displayName: null };
  if (config.mail.from) return { email: config.mail.from, displayName: null };
  if (config.mail.username) return { email: config.mail.username, displayName: null };
  throw bad(Codes.MAIL_CONFIG, Msg.MAIL_NOT_CONFIGURED);
}
