import { adminApi, isDemoMode } from "./client";
import { fetchEmailTemplateRequest } from "./email-templates";
import type { SendEmailResponse } from "./emails";

export interface EmailCampaignContact {
  id?: number;
  email: string;
  name?: string;
}

export interface EmailCampaign {
  id: number;
  name: string;
  description?: string;
  defaultSubject?: string;
  defaultHtmlBody?: string;
  templateId?: number | null;
  contactCount: number;
  contacts?: EmailCampaignContact[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailCampaignPage {
  items: EmailCampaign[];
  total: number;
  page: number;
  limit: number;
}

export interface UpsertEmailCampaignPayload {
  name: string;
  description?: string;
  defaultSubject?: string;
  defaultHtmlBody?: string;
  templateId?: number | null;
  contacts: EmailCampaignContact[];
}

export interface SendCampaignPayload {
  subject?: string;
  bodyHtml?: string;
  cc?: string[];
  bcc?: string[];
  scheduledAt?: string;
  senderIdentityId?: number;
  includeUnsubscribe?: boolean;
  attachments?: { fileName: string; contentType: string; contentBase64: string }[];
}

const demoCampaigns: EmailCampaign[] = [
  {
    id: 1,
    name: "Hotel Outreach — Baku",
    description: "Potential hotel partners in Baku region",
    defaultSubject: "MailRoom — Demo invitation",
    defaultHtmlBody:
      "<p>Hello,</p><p>We would like to invite you to try <strong>MailRoom</strong>.</p>",
    templateId: 1,
    contactCount: 3,
    contacts: [
      { id: 1, email: "info@caspian.az", name: "Caspian Resort" },
      { id: 2, email: "contact@oldcity.az", name: "Old City Boutique" },
      { id: 3, email: "sales@heritage.az", name: "Heritage Stays" },
    ],
  },
  {
    id: 2,
    name: "Trial follow-up",
    description: "Hotels currently on trial",
    defaultSubject: "How is your MailRoom trial going?",
    contactCount: 2,
    contacts: [
      { id: 4, email: "manager@sheki.az", name: "Sheki Silk Inn" },
      { id: 5, email: "front@gabala.az", name: "Gabala Mountain Lodge" },
    ],
  },
];

export async function fetchCampaignsRequest(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<EmailCampaignPage> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    const search = params?.search?.trim().toLowerCase();
    const filtered = search
      ? demoCampaigns.filter(
          (c) =>
            c.name.toLowerCase().includes(search) ||
            (c.description ?? "").toLowerCase().includes(search),
        )
      : demoCampaigns;
    return {
      items: filtered,
      total: filtered.length,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
    };
  }

  const { data } = await adminApi.get<EmailCampaignPage>("/campaigns", { params });
  return data;
}

export async function fetchCampaignRequest(id: number): Promise<EmailCampaign> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    const campaign = demoCampaigns.find((c) => c.id === id);
    if (!campaign) throw new Error("Campaign not found");
    return campaign;
  }

  const { data } = await adminApi.get<EmailCampaign>(`/campaigns/${id}`);
  return data;
}

export async function createCampaignRequest(
  payload: UpsertEmailCampaignPayload,
): Promise<EmailCampaign> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      id: Date.now(),
      ...payload,
      contactCount: payload.contacts.length,
      contacts: payload.contacts,
    };
  }

  const { data } = await adminApi.post<EmailCampaign>("/campaigns", payload);
  return data;
}

export async function updateCampaignRequest(
  id: number,
  payload: UpsertEmailCampaignPayload,
): Promise<EmailCampaign> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      id,
      ...payload,
      contactCount: payload.contacts.length,
      contacts: payload.contacts,
    };
  }

  const { data } = await adminApi.put<EmailCampaign>(`/campaigns/${id}`, payload);
  return data;
}

export async function deleteCampaignRequest(id: number): Promise<void> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    return;
  }

  await adminApi.delete(`/campaigns/${id}`);
}

export async function sendCampaignRequest(
  id: number,
  payload?: SendCampaignPayload,
): Promise<SendEmailResponse> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 700));
    const campaign = demoCampaigns.find((item) => item.id === id);
    return {
      id: `demo-campaign-send-${Date.now()}`,
      sentAt: new Date().toISOString(),
      recipientCount: campaign?.contactCount ?? 0,
    };
  }

  const { data } = await adminApi.post<SendEmailResponse>(`/campaigns/${id}/send`, payload ?? {});
  return data;
}

export async function resolveCampaignContent(
  campaign: EmailCampaign,
): Promise<{ subject?: string; bodyHtml?: string }> {
  if (campaign.templateId) {
    const template = await fetchEmailTemplateRequest(campaign.templateId);
    return {
      subject: template.subject?.trim() || undefined,
      bodyHtml: template.htmlBody?.trim() || undefined,
    };
  }

  return {
    subject: campaign.defaultSubject?.trim() || undefined,
    bodyHtml: campaign.defaultHtmlBody?.trim() || undefined,
  };
}

export function campaignToDraft(campaign: EmailCampaign): UpsertEmailCampaignPayload {
  return {
    name: campaign.name,
    description: campaign.description ?? "",
    defaultSubject: campaign.defaultSubject ?? "",
    defaultHtmlBody: campaign.defaultHtmlBody ?? "",
    templateId: campaign.templateId ?? null,
    contacts: (campaign.contacts ?? []).map((c) => ({
      email: c.email,
      name: c.name ?? "",
    })),
  };
}

export const emptyCampaignDraft = (): UpsertEmailCampaignPayload => ({
  name: "",
  description: "",
  defaultSubject: "",
  defaultHtmlBody: "",
  templateId: null,
  contacts: [],
});
