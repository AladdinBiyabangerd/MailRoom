import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Loader2,
  MailPlus,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { SenderIdentitySelect } from "@/components/email/SenderIdentitySelect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteCampaignRequest,
  fetchCampaignsRequest,
  sendCampaignRequest,
  type EmailCampaign,
} from "@/api/campaigns";
import { getApiErrorMessage } from "@/lib/api-error";
import { useQueryErrorToast } from "@/hooks/use-query-error-toast";
import { queryKeys } from "@/lib/query-keys";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatDateTimeLocal,
  getLocalTimezoneLabel,
  localDatetimeToIso,
  minScheduleDatetimeLocal,
} from "@/lib/schedule";

const CAMPAIGN_LIST_PARAMS = { page: 1, limit: 100 };

export default function Campaigns() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<EmailCampaign | null>(null);
  const [sending, setSending] = useState<EmailCampaign | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [scheduleSend, setScheduleSend] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [senderIdentityId, setSenderIdentityId] = useState("");

  const {
    data: campaignsPage,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.campaigns.list(CAMPAIGN_LIST_PARAMS),
    queryFn: () => fetchCampaignsRequest(CAMPAIGN_LIST_PARAMS),
  });

  const rows = campaignsPage?.items ?? [];
  useQueryErrorToast(isError, "campaigns.loadError");

  const columns: Column<EmailCampaign>[] = useMemo(
    () => [
      {
        key: "name",
        header: t("campaigns.name"),
        render: (row) => (
          <div>
            <p className="font-medium">{row.name}</p>
            {row.description && (
              <p className="max-w-xs truncate text-xs text-muted-foreground">{row.description}</p>
            )}
          </div>
        ),
      },
      {
        key: "contacts",
        header: t("campaigns.contacts"),
        render: (row) => (
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {row.contactCount}
          </Badge>
        ),
      },
      {
        key: "subject",
        header: t("campaigns.defaultSubject"),
        render: (row) => (
          <span className="max-w-[200px] truncate text-sm text-muted-foreground">
            {row.defaultSubject || (row.templateId ? t("campaigns.fromTemplate") : "—")}
          </span>
        ),
      },
      {
        key: "actions",
        header: t("common.actions"),
        align: "right",
        render: (row) => (
          <div className="flex justify-end gap-1">
            <PermissionGate permission="emails:write">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => setSending(row)}
              >
                <Send className="h-3.5 w-3.5" />
                {t("campaigns.send")}
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to={`/emails/compose?campaignId=${row.id}`}>
                  {t("campaigns.compose")}
                </Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to={`/emails/campaigns/${row.id}/edit`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleting(row)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </PermissionGate>
          </div>
        ),
      },
    ],
    [t],
  );

  const handleSend = async () => {
    if (!sending) return;

    let scheduledAt: string | undefined;
    if (scheduleSend) {
      scheduledAt = localDatetimeToIso(scheduledAtLocal);
      if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
        toast.error(t("emails.validation.scheduleInPast"));
        return;
      }
    }

    setSendingId(sending.id);
    try {
      const payload = {
        ...(scheduledAt ? { scheduledAt } : {}),
        ...(senderIdentityId ? { senderIdentityId: Number(senderIdentityId) } : {}),
      };
      const result = await sendCampaignRequest(
        sending.id,
        Object.keys(payload).length > 0 ? payload : undefined,
      );
      if (result.status === "scheduled") {
        toast.success(
          t("campaigns.scheduleSuccess", {
            count: result.recipientCount,
            time: formatDateTimeLocal(result.scheduledAt ?? result.sentAt),
          }),
        );
      } else {
        toast.success(t("campaigns.sendSuccess", { count: result.recipientCount }));
      }
      setSending(null);
      setScheduleSend(false);
      setScheduledAtLocal("");
      setSenderIdentityId("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.emailHistory.all });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("campaigns.sendError")));
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(deleting.id);
    try {
      await deleteCampaignRequest(deleting.id);
      toast.success(t("campaigns.deleted"));
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("campaigns.deleteError")));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t("campaigns.title")}
        subtitle={t("campaigns.subtitle")}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/emails/compose">
                <MailPlus className="h-4 w-4" />
                {t("emailHistory.compose")}
              </Link>
            </Button>
            <PermissionGate permission="emails:write">
              <Button type="button" size="sm" className="gap-1.5" asChild>
                <Link to="/emails/campaigns/new">
                  <Plus className="h-4 w-4" />
                  {t("campaigns.add")}
                </Link>
              </Button>
            </PermissionGate>
          </>
        }
      />

      {isLoading ? (
        <div className="mt-6 flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => String(row.id)}
            searchAccessor={(row) =>
              `${row.name} ${row.description ?? ""} ${row.defaultSubject ?? ""}`
            }
          />
        </div>
      )}

      <Dialog
        open={!!sending}
        onOpenChange={(open) => {
          if (!open) {
            setSending(null);
            setScheduleSend(false);
            setScheduledAtLocal("");
            setSenderIdentityId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("campaigns.sendTitle")}</DialogTitle>
            <DialogDescription>
              {t("campaigns.sendBody", {
                name: sending?.name,
                count: sending?.contactCount ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <SenderIdentitySelect
              id="campaign-sender"
              value={senderIdentityId}
              onChange={setSenderIdentityId}
            />
            <div className="flex items-center gap-2">
              <Switch
                id="campaign-schedule-send"
                checked={scheduleSend}
                onCheckedChange={setScheduleSend}
              />
              <Label htmlFor="campaign-schedule-send" className="font-normal">
                {t("emails.sendLater")}
              </Label>
            </div>
            {scheduleSend && (
              <div className="space-y-2">
                <Label htmlFor="campaign-scheduled-at">{t("emails.scheduledAt")}</Label>
                <Input
                  id="campaign-scheduled-at"
                  type="datetime-local"
                  value={scheduledAtLocal}
                  min={minScheduleDatetimeLocal()}
                  onChange={(e) => setScheduledAtLocal(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("emails.scheduleTimezoneHint", {
                    timezone: getLocalTimezoneLabel(),
                  })}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSending(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSend} disabled={sendingId !== null}>
              {sendingId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("campaigns.sendConfirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("campaigns.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("campaigns.deleteBody", { name: deleting?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingId !== null}
            >
              {deletingId !== null ? t("campaigns.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
