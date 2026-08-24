import { adminApi, isDemoMode } from "./client";

export type EmailSuppressionSource = "ONE_CLICK" | "ADMIN" | "IMPORT";

export interface EmailSuppression {
  id: number;
  email: string;
  unsubscribedAt?: string;
  source: EmailSuppressionSource;
  campaignId?: number;
  sentEmailId?: number;
}

export interface EmailSuppressionPage {
  items: EmailSuppression[];
  total: number;
  page: number;
  limit: number;
}

const demoSuppressions: EmailSuppression[] = [
  {
    id: 1,
    email: "unsubscribed@example.com",
    source: "ONE_CLICK",
    unsubscribedAt: new Date().toISOString(),
    campaignId: 1,
  },
];

export async function fetchEmailSuppressionsRequest(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<EmailSuppressionPage> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    return {
      items: demoSuppressions,
      total: demoSuppressions.length,
      page: 1,
      limit: 20,
    };
  }

  const { data } = await adminApi.get<EmailSuppressionPage>("/email-suppressions", { params });
  return data;
}

export async function deleteEmailSuppressionRequest(id: number): Promise<void> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    return;
  }

  await adminApi.delete(`/email-suppressions/${id}`);
}
