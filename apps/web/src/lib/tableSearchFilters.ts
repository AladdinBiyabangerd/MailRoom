import type { TFunction } from "i18next";
import type { SentEmailRecord, EmailDeliveryStatus } from "@/api/emails";
import type { SearchFilterDef } from "@/lib/advancedSearch";

const EMAIL_STATUSES: EmailDeliveryStatus[] = [
  "scheduled",
  "queued",
  "sent",
  "delivered",
  "opened",
  "failed",
  "bounced",
];

export function emailHistorySearchFilters(t: TFunction): SearchFilterDef<SentEmailRecord>[] {
  return [
    {
      id: "status",
      label: t("common.status"),
      type: "select",
      options: EMAIL_STATUSES.map((status) => ({
        value: status,
        label: t(`status.${status}`),
      })),
      getValue: (r) => r.status,
    },
    {
      id: "sentBy",
      label: t("emailHistory.sentBy"),
      type: "text",
      placeholder: t("common.email"),
      getValue: (r) => `${r.sentByName} ${r.sentBy}`,
    },
  ];
}
