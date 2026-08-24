import { adminApi, isDemoMode } from "./client";

export interface EmailDraftRecipient {
  email: string;
  name?: string;
}

export interface EmailDraft {
  id: number;
  subject?: string;
  bodyHtml?: string;
  campaignId?: number | null;
  showCc: boolean;
  showBcc: boolean;
  to: EmailDraftRecipient[];
  cc: EmailDraftRecipient[];
  bcc: EmailDraftRecipient[];
  updatedAt?: string;
}

export interface UpsertEmailDraftPayload {
  subject?: string;
  bodyHtml?: string;
  campaignId?: number | null;
  showCc?: boolean;
  showBcc?: boolean;
  to?: EmailDraftRecipient[];
  cc?: EmailDraftRecipient[];
  bcc?: EmailDraftRecipient[];
}

const demoDraft: EmailDraft = {
  id: 1,
  subject: "Draft: Summer promotion",
  bodyHtml: "<p>Hi,</p><p>This is a saved draft…</p>",
  showCc: false,
  showBcc: false,
  to: [{ email: "info@caspian.az", name: "Caspian Resort" }],
  cc: [],
  bcc: [],
};

export async function fetchCurrentEmailDraftRequest(): Promise<EmailDraft | null> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 150));
    return demoDraft;
  }

  const response = await adminApi.get<EmailDraft>("/email-drafts/current", {
    validateStatus: (status) => status === 200 || status === 204,
  });
  return response.status === 204 ? null : response.data;
}

export async function saveCurrentEmailDraftRequest(
  payload: UpsertEmailDraftPayload,
): Promise<EmailDraft | null> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    return { ...demoDraft, ...payload, id: demoDraft.id };
  }

  const response = await adminApi.put<EmailDraft>("/email-drafts/current", payload, {
    validateStatus: (status) => status === 200 || status === 204,
  });
  return response.status === 204 ? null : response.data;
}

export async function deleteCurrentEmailDraftRequest(): Promise<void> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 150));
    return;
  }

  await adminApi.delete("/email-drafts/current");
}

export function draftToComposeState(draft: EmailDraft) {
  return {
    to: draft.to.map((r) => ({ email: r.email, label: r.name })),
    cc: (draft.cc ?? []).map((r) => ({ email: r.email, label: r.name })),
    bcc: (draft.bcc ?? []).map((r) => ({ email: r.email, label: r.name })),
    subject: draft.subject ?? "",
    bodyHtml: draft.bodyHtml ?? "",
    showCc: draft.showCc,
    showBcc: draft.showBcc,
    selectedCampaignId: draft.campaignId ? String(draft.campaignId) : "none",
  };
}
