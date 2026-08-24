import { prisma } from "../db.js";
import { Codes, Msg, bad, notFound } from "../errors.js";
import { ensureContact, findTemplate, getContact } from "./catalog.js";
import { normalizeEmail } from "./auth.js";
import { sendAdminEmail } from "./emails.js";
import type { AuthUser } from "../auth.js";

type CampaignContactInput = {
  contactId?: number;
  email?: string;
  name?: string;
};

type CampaignContactRow = {
  id: number;
  contactId: number;
  contact: { email: string; name: string | null };
};

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined;
}

function mapCampaign(
  c: {
    id: number;
    name: string;
    description: string | null;
    defaultSubject: string | null;
    defaultHtmlBody: string | null;
    templateId: number | null;
    createdAt: Date;
    updatedAt: Date;
    contacts: CampaignContactRow[];
  },
  includeContacts: boolean,
) {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? undefined,
    defaultSubject: c.defaultSubject ?? undefined,
    defaultHtmlBody: c.defaultHtmlBody ?? undefined,
    templateId: c.templateId,
    contactCount: c.contacts.length,
    contacts: includeContacts
      ? c.contacts.map((x) => ({
          id: x.id,
          contactId: x.contactId,
          email: x.contact.email,
          name: x.contact.name ?? undefined,
        }))
      : undefined,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

const campaignContactInclude = {
  contacts: {
    orderBy: { id: "asc" as const },
    include: { contact: true },
  },
};

async function ensureUniqueName(name: string, excludeId?: number) {
  const found = await prisma.emailCampaign.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (found) throw bad(Codes.EMAIL_CAMPAIGN, Msg.CAMPAIGN_NAME_EXISTS, name);
}

export async function findCampaign(id: number) {
  const c = await prisma.emailCampaign.findUnique({
    where: { id },
    include: campaignContactInclude,
  });
  if (!c) throw notFound(Codes.EMAIL_CAMPAIGN, Msg.NOT_FOUND, Msg.ENTITY_EMAIL_CAMPAIGN);
  return c;
}

export async function searchCampaigns(search?: string, page?: number, limit?: number) {
  const p = !page || page < 1 ? 1 : page;
  const l = !limit || limit < 1 ? 20 : Math.min(limit, 100);
  const where = search?.trim()
    ? { name: { contains: search.trim(), mode: "insensitive" as const } }
    : {};
  const [items, total] = await Promise.all([
    prisma.emailCampaign.findMany({
      where,
      include: campaignContactInclude,
      orderBy: { updatedAt: "desc" },
      skip: (p - 1) * l,
      take: l,
    }),
    prisma.emailCampaign.count({ where }),
  ]);
  return { items: items.map((c) => mapCampaign(c, false)), total, page: p, limit: l };
}

export async function getCampaign(id: number) {
  return mapCampaign(await findCampaign(id), true);
}

async function resolveContactIds(contacts: CampaignContactInput[]): Promise<number[]> {
  const ids = new Set<number>();
  for (const c of contacts ?? []) {
    if (c.contactId != null && Number.isFinite(c.contactId)) {
      await getContact(c.contactId);
      ids.add(c.contactId);
      continue;
    }
    if (!c.email?.trim()) continue;
    const ensured = await ensureContact({ email: c.email, name: c.name });
    ids.add(ensured.id);
  }
  return [...ids];
}

async function replaceContacts(campaignId: number, contacts: CampaignContactInput[]) {
  const contactIds = await resolveContactIds(contacts);
  await prisma.emailCampaignContact.deleteMany({ where: { campaignId } });
  if (contactIds.length) {
    await prisma.emailCampaignContact.createMany({
      data: contactIds.map((contactId) => ({ campaignId, contactId })),
    });
  }
}

async function resolveTemplateId(templateId?: number | null) {
  if (!templateId) return null;
  await findTemplate(templateId);
  return templateId;
}

export async function createCampaign(body: {
  name: string;
  description?: string;
  defaultSubject?: string;
  defaultHtmlBody?: string;
  templateId?: number | null;
  contacts: CampaignContactInput[];
}) {
  const name = body.name.trim();
  await ensureUniqueName(name);
  const campaign = await prisma.emailCampaign.create({
    data: {
      name,
      description: body.description?.trim() || null,
      defaultSubject: body.defaultSubject?.trim() || null,
      defaultHtmlBody: body.defaultHtmlBody?.trim() || null,
      templateId: await resolveTemplateId(body.templateId),
    },
  });
  await replaceContacts(campaign.id, body.contacts ?? []);
  return getCampaign(campaign.id);
}

export async function updateCampaign(
  id: number,
  body: {
    name: string;
    description?: string;
    defaultSubject?: string;
    defaultHtmlBody?: string;
    templateId?: number | null;
    contacts: CampaignContactInput[];
  },
) {
  await findCampaign(id);
  const name = body.name.trim();
  await ensureUniqueName(name, id);
  await prisma.emailCampaign.update({
    where: { id },
    data: {
      name,
      description: body.description?.trim() || null,
      defaultSubject: body.defaultSubject?.trim() || null,
      defaultHtmlBody: body.defaultHtmlBody?.trim() || null,
      templateId: await resolveTemplateId(body.templateId),
    },
  });
  await replaceContacts(id, body.contacts ?? []);
  return getCampaign(id);
}

export async function deleteCampaign(id: number) {
  await findCampaign(id);
  await prisma.emailCampaign.delete({ where: { id } });
}

export async function sendCampaign(
  id: number,
  actor: AuthUser,
  overrides?: {
    subject?: string;
    bodyHtml?: string;
    cc?: string[];
    bcc?: string[];
    scheduledAt?: string;
    senderIdentityId?: number;
    includeUnsubscribe?: boolean;
    greetWithName?: boolean;
    attachments?: { fileName: string; contentType: string; contentBase64: string }[];
  },
) {
  const campaign = await findCampaign(id);
  if (!campaign.contacts.length) throw bad(Codes.EMAIL_CAMPAIGN, Msg.CAMPAIGN_NO_CONTACTS);

  let subject = "";
  let bodyHtml = "";
  if (campaign.templateId) {
    const template = await findTemplate(campaign.templateId);
    subject = overrides?.subject?.trim() || template.subject || "";
    bodyHtml = overrides?.bodyHtml?.trim() || template.htmlBody || "";
  } else {
    subject = overrides?.subject?.trim() || campaign.defaultSubject || "";
    bodyHtml = overrides?.bodyHtml?.trim() || campaign.defaultHtmlBody || "";
  }
  if (!subject.trim()) throw bad(Codes.EMAIL_CAMPAIGN, Msg.CAMPAIGN_MISSING_SUBJECT);
  if (!bodyHtml.trim()) throw bad(Codes.EMAIL_CAMPAIGN, Msg.CAMPAIGN_MISSING_BODY);

  const recipientNames = Object.fromEntries(
    campaign.contacts.map((c) => [normalizeEmail(c.contact.email), c.contact.name]),
  );

  return sendAdminEmail(actor, {
    to: campaign.contacts.map((c) => c.contact.email),
    cc: overrides?.cc,
    bcc: overrides?.bcc,
    subject,
    bodyHtml,
    campaignId: id,
    scheduledAt: overrides?.scheduledAt,
    senderIdentityId: overrides?.senderIdentityId,
    includeUnsubscribe: overrides?.includeUnsubscribe ?? true,
    greetWithName: overrides?.greetWithName !== false,
    recipientNames,
    attachments: overrides?.attachments,
  });
}
