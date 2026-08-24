import { adminApi, isDemoMode } from "./client";
import { sentEmails } from "@/data/mock";

export type EmailDeliveryStatus =
  | "scheduled"
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "failed"
  | "bounced";

export interface EmailRecipientStatus {
  email: string;
  name?: string;
  status: EmailDeliveryStatus;
  deliveredAt?: string;
  openedAt?: string;
  errorMessage?: string;
}

export interface SentEmailRecord {
  id: string;
  subject: string;
  bodyHtml: string;
  sentBy: string;
  sentByName: string;
  fromEmail?: string | null;
  fromName?: string | null;
  fromLabel?: string | null;
  sentAt: string;
  scheduledAt?: string | null;
  status: EmailDeliveryStatus;
  to: EmailRecipientStatus[];
  cc?: EmailRecipientStatus[];
  bcc?: EmailRecipientStatus[];
}

export interface SendEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  campaignId?: number;
  scheduledAt?: string;
  senderIdentityId?: number;
  includeUnsubscribe?: boolean;
  attachments?: EmailAttachmentPayload[];
}

export interface EmailAttachmentPayload {
  fileName: string;
  contentType: string;
  contentBase64: string;
}

export type EmailResendMode = "all" | "failed";

export interface ResendEmailRequest {
  mode?: EmailResendMode;
}

export interface SendEmailResponse {
  id: string;
  sentAt: string;
  scheduledAt?: string | null;
  status?: string;
  recipientCount: number;
  suppressedCount?: number;
}

export async function sendEmailRequest(
  payload: SendEmailRequest,
): Promise<SendEmailResponse> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 900));
    const total =
      payload.to.length + (payload.cc?.length ?? 0) + (payload.bcc?.length ?? 0);
    return {
      id: `demo-${Date.now()}`,
      sentAt: new Date().toISOString(),
      recipientCount: total,
    };
  }

  const { data } = await adminApi.post<SendEmailResponse>("/emails/send", payload);
  return data;
}

export async function resendEmailRequest(
  id: string,
  payload: ResendEmailRequest = { mode: "all" },
): Promise<SendEmailResponse> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 700));
    return {
      id: `demo-resend-${Date.now()}`,
      sentAt: new Date().toISOString(),
      recipientCount: 1,
    };
  }

  const { data } = await adminApi.post<SendEmailResponse>(`/emails/${id}/resend`, {
    mode: payload.mode === "failed" ? "FAILED" : "ALL",
  });
  return data;
}

export async function fetchEmailHistoryRequest(): Promise<SentEmailRecord[]> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 350));
    return sentEmails;
  }

  const { data } = await adminApi.get<SentEmailRecord[]>("/emails/history");
  return data;
}

export interface UpdateEmailScheduleRequest {
  scheduledAt: string;
}

export async function updateEmailScheduleRequest(
  id: string,
  payload: UpdateEmailScheduleRequest,
): Promise<SentEmailRecord> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 400));
    const existing = sentEmails.find((e) => e.id === id);
    if (!existing) throw new Error("Not found");
    const updated = {
      ...existing,
      scheduledAt: payload.scheduledAt,
      sentAt: payload.scheduledAt,
    };
    return updated;
  }

  const { data } = await adminApi.patch<SentEmailRecord>(`/emails/${id}/schedule`, payload);
  return data;
}
