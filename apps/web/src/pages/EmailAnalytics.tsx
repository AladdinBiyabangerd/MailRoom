import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, CheckCircle2, Eye, Loader2, Mail, XCircle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { fetchEmailAnalyticsRequest, formatRate, type EmailCampaignAnalytics } from "@/api/email-analytics";
import { queryKeys } from "@/lib/query-keys";
import { useQueryErrorToast } from "@/hooks/use-query-error-toast";

const ANALYTICS_PARAMS = { page: 1 };

export default function EmailAnalytics() {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.emailAnalytics.summary(ANALYTICS_PARAMS),
    queryFn: () => fetchEmailAnalyticsRequest(),
  });

  useQueryErrorToast(isError, "emailAnalytics.loadError");

  const summary = data?.summary;
  const campaignRows = data?.byCampaign ?? [];

  const columns: Column<EmailCampaignAnalytics>[] = useMemo(
    () => [
      {
        key: "name",
        header: t("campaigns.name"),
        render: (row) => <span className="font-medium">{row.campaignName}</span>,
      },
      {
        key: "recipients",
        header: t("campaigns.contacts"),
        render: (row) => row.recipientsTotal,
      },
      {
        key: "deliveryRate",
        header: t("emailAnalytics.deliveryRate"),
        render: (row) => formatRate(row.deliveryRate),
      },
      {
        key: "openRate",
        header: t("emailAnalytics.openRate"),
        render: (row) => formatRate(row.openRate),
      },
      {
        key: "delivered",
        header: t("emailHistory.kpiDelivered"),
        render: (row) => row.delivered,
      },
      {
        key: "opened",
        header: t("emailHistory.kpiOpened"),
        render: (row) => row.opened,
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t("emailAnalytics.title")}
        subtitle={t("emailAnalytics.subtitle")}
        actions={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to="/emails/history">
              <Mail className="h-4 w-4" />
              {t("emailHistory.title")}
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="mt-6 flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t("emailAnalytics.emailsSent")}
              value={String(summary?.emailsSent ?? 0)}
              icon={Mail}
              accent="primary"
            />
            <StatCard
              label={t("emailAnalytics.deliveryRate")}
              value={formatRate(summary?.deliveryRate ?? 0)}
              icon={CheckCircle2}
              accent="success"
            />
            <StatCard
              label={t("emailAnalytics.openRate")}
              value={formatRate(summary?.openRate ?? 0)}
              icon={Eye}
              accent="info"
            />
            <StatCard
              label={t("emailHistory.kpiFailed")}
              value={String(summary?.failed ?? 0)}
              icon={XCircle}
              accent="accent"
            />
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{t("emailAnalytics.byCampaign")}</h2>
            </div>
            {campaignRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("emailAnalytics.noCampaignData")}</p>
            ) : (
              <DataTable
                columns={columns}
                rows={campaignRows}
                rowKey={(row) => String(row.campaignId)}
                searchAccessor={(row) => row.campaignName}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
