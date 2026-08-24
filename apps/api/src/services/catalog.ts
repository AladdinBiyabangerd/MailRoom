import { prisma } from "../db.js";
import { config } from "../config.js";
import { Codes, Msg, bad, notFound } from "../errors.js";
import { formatFromLabel } from "../mail/html.js";
import { normalizeEmail } from "./auth.js";

function pageParams(page?: number, limit?: number) {
  const p = !page || page < 1 ? 1 : page;
  const l = !limit || limit < 1 ? 20 : Math.min(limit, 100);
  return { page: p, limit: l, skip: (p - 1) * l };
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined;
}

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
    prisma.emailTemplate.findMany({ where, orderBy: { updatedAt: "desc" }, skip: p.skip, take: p.limit }),
    prisma.emailTemplate.count({ where }),
  ]);
  return {
    items: items.map(mapTemplate),
    total,
    page: p.page,
    limit: p.limit,
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
}) {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? undefined,
    subject: t.subject ?? undefined,
    htmlBody: t.htmlBody ?? undefined,
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  };
}

export async function getTemplate(id: number) {
  const t = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!t) throw notFound(Codes.EMAIL_TEMPLATE, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_TEMPLATE);
  return mapTemplate(t);
}

export async function findTemplate(id: number) {
  const t = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!t) throw notFound(Codes.EMAIL_TEMPLATE, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_TEMPLATE);
  return t;
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
  return mapTemplate(t);
}

export async function updateTemplate(
  id: number,
  body: { name: string; description?: string; subject?: string; htmlBody?: string },
) {
  await findTemplate(id);
  const name = body.name.trim();
  await ensureUniqueTemplateName(name, id);
  const t = await prisma.emailTemplate.update({
    where: { id },
    data: {
      name,
      description: body.description?.trim() || null,
      subject: body.subject?.trim() || null,
      htmlBody: body.htmlBody?.trim() || null,
    },
  });
  return mapTemplate(t);
}

export async function deleteTemplate(id: number) {
  await findTemplate(id);
  const used = await prisma.emailCampaign.count({ where: { templateId: id } });
  if (used) throw bad(Codes.EMAIL_TEMPLATE, Msg.TEMPLATE_IN_USE);
  await prisma.emailTemplate.delete({ where: { id } });
}

function mapContact(c: { id: number; email: string; name: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? undefined,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

export async function searchContacts(search?: string, page?: number, limit?: number) {
  const p = pageParams(page, limit);
  const where = search?.trim()
    ? {
        OR: [
          { email: { contains: search.trim(), mode: "insensitive" as const } },
          { name: { contains: search.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.emailAddressBookContact.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: p.skip,
      take: p.limit,
    }),
    prisma.emailAddressBookContact.count({ where }),
  ]);
  return { items: items.map(mapContact), total, page: p.page, limit: p.limit };
}

export async function getContact(id: number) {
  const c = await prisma.emailAddressBookContact.findUnique({ where: { id } });
  if (!c) throw notFound(Codes.EMAIL_ADDRESS_BOOK_CONTACT, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_CONTACT);
  return mapContact(c);
}

export async function createContact(body: { email: string; name?: string }) {
  const email = normalizeEmail(body.email);
  const exists = await prisma.emailAddressBookContact.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (exists) throw bad(Codes.EMAIL_ADDRESS_BOOK_CONTACT, Msg.EMAIL_CONTACT_EXISTS, email);
  const c = await prisma.emailAddressBookContact.create({
    data: { email, name: body.name?.trim() || null },
  });
  return mapContact(c);
}

export async function updateContact(id: number, body: { email: string; name?: string }) {
  await getContact(id);
  const email = normalizeEmail(body.email);
  const clash = await prisma.emailAddressBookContact.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, NOT: { id } },
  });
  if (clash) throw bad(Codes.EMAIL_ADDRESS_BOOK_CONTACT, Msg.EMAIL_CONTACT_EXISTS, email);
  const c = await prisma.emailAddressBookContact.update({
    where: { id },
    data: { email, name: body.name?.trim() || null },
  });
  return mapContact(c);
}

export async function deleteContact(id: number) {
  await getContact(id);
  await prisma.emailAddressBookContact.delete({ where: { id } });
}

export async function syncContactsFromCampaign(contacts: { email: string; name?: string }[]) {
  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);
    if (!email) continue;
    await prisma.emailAddressBookContact.upsert({
      where: { email },
      create: { email, name: contact.name?.trim() || null },
      update: contact.name?.trim() ? { name: contact.name.trim() } : {},
    });
  }
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
