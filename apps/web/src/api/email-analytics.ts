import { adminApi, isDemoMode } from "./client";

export interface EmailAnalyticsSummary {
  emailsSent: number;
  recipientsTotal: number;
  delivered: number;
  opened: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
}

export interface EmailCampaignAnalytics {
  campaignId: number;
  campaignName: string;
  recipientsTotal: number;
  delivered: number;
  opened: number;
  deliveryRate: number;
  openRate: number;
}

export interface EmailAnalytics {
  summary: EmailAnalyticsSummary;
  byCampaign: EmailCampaignAnalytics[];
}

const demoAnalytics: EmailAnalytics = {
  summary: {
    emailsSent: 12,
    recipientsTotal: 380,
    delivered: 350,
    opened: 120,
    failed: 25,
    deliveryRate: 0.933,
    openRate: 0.343,
  },
  byCampaign: [
    {
      campaignId: 1,
      campaignName: "Hotel Outreach — Baku",
      recipientsTotal: 150,
      delivered: 142,
      opened: 58,
      deliveryRate: 0.947,
      openRate: 0.408,
    },
  ],
};

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export async function fetchEmailAnalyticsRequest(params?: {
  from?: string;
  to?: string;
  campaignId?: number;
}): Promise<EmailAnalytics> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 250));
    return demoAnalytics;
  }

  const { data } = await adminApi.get<EmailAnalytics>("/emails/analytics", { params });
  return data;
}
