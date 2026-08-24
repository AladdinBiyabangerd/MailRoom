import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  MailPlus,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PermissionGate } from "@/components/auth/PermissionGate";
import {
  fetchEmailHistoryRequest,
  resendEmailRequest,
  updateEmailScheduleRequest,
  type EmailRecipientStatus,
  type EmailResendMode,
  type SentEmailRecord,
} from "@/api/emails";
import { fetchEmailAnalyticsRequest, formatRate } from "@/api/email-analytics";
import { getApiErrorMessage } from "@/lib/api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { emailHistorySearchFilters } from "@/lib/tableSearchFilters";
import { queryKeys } from "@/lib/query-keys";
import {
  apiDateTimeToLocalInput,
  formatDateTimeLocal,
  getLocalTimezoneLabel,
  localDatetimeToIso,
  minScheduleDatetimeLocal,
} from "@/lib/schedule";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function countRecipients(email: SentEmailRecord): number {
  return (
    email.to.length + (email.cc?.length ?? 0) + (email.bcc?.length ?? 0)
  );
}

function allRecipients(email: SentEmailRecord): EmailRecipientStatus[] {
  return [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])];
}

function countFailedRecipients(email: SentEmailRecord): number {
  return allRecipients(email).filter(
    (r) => r.status === "failed" || r.status === "bounced",
  ).length;
}

function canResendFailed(email: SentEmailRecord): boolean {
  return countFailedRecipients(email) > 0 && email.to.some(
    (r) => r.status === "failed" || r.status === "bounced",
  );
}

function formatRecipientsPreview(email: SentEmailRecord): string {
  const all = [
    ...email.to.map((r) => r.name ?? r.email),
    ...(email.cc?.map((r) => r.name ?? r.email) ?? []),
    ...(email.bcc?.map((r) => r.name ?? r.email) ?? []),
  ];
  if (all.length <= 2) return all.join(", ");
  return `${all.slice(0, 2).join(", ")} +${all.length - 2}`;
}

function RecipientStatusTable({
  title,
  recipients,
}: {
  title: string;
  recipients: EmailRecipientStatus[];
}) {
  const { t } = useTranslation();

  if (recipients.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("emailHistory.recipient")}</TableHead>
              <TableHead>{t("emailHistory.deliveryStatus")}</TableHead>
              <TableHead>{t("emailHistory.deliveredAt")}</TableHead>
              <TableHead>{t("emailHistory.openedAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.map((r) => (
              <TableRow key={r.email}>
                <TableCell>
                  <div>
                    <p className="font-medium">{r.name ?? r.email}</p>
                    {r.name && (
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                  {r.errorMessage && (
                    <p className="mt-1 text-xs text-destructive">{r.errorMessage}</p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTimeLocal(r.deliveredAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTimeLocal(r.openedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function displaySendTime(email: SentEmailRecord): string {
  const value =
    email.status === "scheduled"
      ? (email.scheduledAt ?? email.sentAt)
      : email.sentAt;
  return formatDateTimeLocal(value);
}

export default function EmailHistory() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SentEmailRecord | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<SentEmailRecord | null>(null);
  const [rescheduleAtLocal, setRescheduleAtLocal] = useState("");
  const searchFilters = useMemo(() => emailHistorySearchFilters(t), [t]);
  const timezoneLabel = getLocalTimezoneLabel();

  const { data: emails = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: queryKeys.emailHistory.all,
    queryFn: fetchEmailHistoryRequest,
    refetchInterval: 10_000,
  });

  const { data: analytics } = useQuery({
    queryKey: queryKeys.emailAnalytics.summary({}),
    queryFn: () => fetchEmailAnalyticsRequest(),
  });

  const resendMutation = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: EmailResendMode }) =>
      resendEmailRequest(id, { mode }),
    onSuccess: (data) => {
      toast.success(t("emailHistory.resendSuccess", { count: data.recipientCount }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.emailHistory.all });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t("emailHistory.resendError")));
    },
    onSettled: () => setResendingId(null),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      updateEmailScheduleRequest(id, { scheduledAt }),
    onSuccess: (updated) => {
      toast.success(
        t("emailHistory.rescheduleSuccess", {
          time: formatDateTimeLocal(updated.scheduledAt ?? updated.sentAt),
        }),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.emailHistory.all });
      setRescheduleTarget(null);
      setSelected((current) => (current?.id === updated.id ? updated : current));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t("emailHistory.rescheduleError")));
    },
  });

  const openRescheduleDialog = (email: SentEmailRecord) => {
    setRescheduleTarget(email);
    setRescheduleAtLocal(
      apiDateTimeToLocalInput(email.scheduledAt ?? email.sentAt),
    );
  };

  const handleRescheduleSubmit = () => {
    if (!rescheduleTarget) return;
    const scheduledAt = localDatetimeToIso(rescheduleAtLocal);
    if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
      toast.error(t("emails.validation.scheduleInPast"));
      return;
    }
    rescheduleMutation.mutate({ id: rescheduleTarget.id, scheduledAt });
  };

  const handleResend = (email: SentEmailRecord, mode: EmailResendMode) => {
    setResendingId(`${email.id}:${mode}`);
    resendMutation.mutate({ id: email.id, mode });
  };

  const stats = useMemo(() => {
    const total = emails.length;
    const delivered = emails.filter(
      (e) => e.status === "delivered" || e.status === "opened",
    ).length;
    const opened = emails.filter((e) => e.status === "opened").length;
    const failed = emails.filter(
      (e) => e.status === "failed" || e.status === "bounced",
    ).length;
    return { total, delivered, opened, failed };
  }, [emails]);

  const summary = analytics?.summary;

  const ResendActions = ({ email, compact = false }: { email: SentEmailRecord; compact?: boolean }) => {
    const isResending = resendingId?.startsWith(`${email.id}:`) ?? false;
    const showFailed = canResendFailed(email);

    return (
      <PermissionGate permission="emails:write">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant={compact ? "ghost" : "outline"}
              size="sm"
              className="gap-1.5"
              disabled={isResending}
              onClick={(e) => e.stopPropagation()}
            >
              {isResending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {compact ? t("emailHistory.resend") : t("emailHistory.resend")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleResend(email, "all")}>
              {t("emailHistory.resendAll")}
            </DropdownMenuItem>
            {showFailed && (
              <DropdownMenuItem onClick={() => handleResend(email, "failed")}>
                {t("emailHistory.resendFailed", {
                  count: countFailedRecipients(email),
                })}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </PermissionGate>
    );
  };

  const columns: Column<SentEmailRecord>[] = [
    {
      key: "subject",
      header: t("emailHistory.subject"),
      render: (r) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-foreground">{r.subject}</p>
          <p className="truncate text-xs text-muted-foreground">{r.id}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: t("emailHistory.status"),
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "recipients",
      header: t("emailHistory.recipients"),
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {formatRecipientsPreview(r)}
          </span>
          <Badge variant="outline" className="text-[11px]">
            {countRecipients(r)}
          </Badge>
        </div>
      ),
    },
    {
      key: "fromLabel",
      header: t("emailHistory.from"),
      render: (r) => (
        <span className="text-sm text-muted-foreground">{r.fromLabel ?? r.fromEmail ?? "—"}</span>
      ),
    },
    {
      key: "sentBy",
      header: t("emailHistory.sentBy"),
      render: (r) => (
        <div>
          <p className="text-sm font-medium">{r.sentByName}</p>
          <p className="text-xs text-muted-foreground">{r.sentBy}</p>
        </div>
      ),
    },
    {
      key: "sentAt",
      header: t("emailHistory.sentAt"),
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {displaySendTime(r)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          {r.status === "scheduled" && (
            <PermissionGate permission="emails:write">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  openRescheduleDialog(r);
                }}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {t("emailHistory.reschedule")}
              </Button>
            </PermissionGate>
          )}
          <ResendActions email={r} compact />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              setSelected(r);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            {t("common.details")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("emailHistory.title")}
        subtitle={t("emailHistory.subtitle")}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t("common.refresh")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/emails/analytics">
                {t("emailAnalytics.title")}
              </Link>
            </Button>
            <Button type="button" size="sm" className="gap-1.5" asChild>
              <Link to="/emails/compose">
                <MailPlus className="h-4 w-4" />
                {t("emailHistory.compose")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("emailHistory.kpiTotal")}
          value={String(stats.total)}
          icon={Mail}
          accent="primary"
        />
        <StatCard
          label={t("emailHistory.kpiDelivered")}
          value={
            summary ? formatRate(summary.deliveryRate) : String(stats.delivered)
          }
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard
          label={t("emailHistory.kpiOpened")}
          value={summary ? formatRate(summary.openRate) : String(stats.opened)}
          icon={Eye}
          accent="info"
        />
        <StatCard
          label={t("emailHistory.kpiFailed")}
          value={String(stats.failed)}
          icon={XCircle}
          accent="accent"
        />
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            rows={emails}
            rowKey={(r) => r.id}
            onRowClick={setSelected}
            searchAccessor={(r) =>
              `${r.subject} ${r.sentBy} ${r.sentByName} ${r.to.map((x) => x.email).join(" ")} ${r.id}`
            }
            searchFilters={searchFilters}
          />
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{selected.subject}</DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <StatusBadge status={selected.status} />
                {selected.fromLabel && (
                  <Badge variant="outline">{selected.fromLabel}</Badge>
                )}
                <span className="text-muted-foreground">
                  <Send className="mr-1 inline h-3.5 w-3.5" />
                  {selected.sentByName} · {displaySendTime(selected)}
                </span>
                <Badge variant="secondary">
                  {countRecipients(selected)} {t("emailHistory.recipients").toLowerCase()}
                </Badge>
                {selected.status === "scheduled" && (
                  <PermissionGate permission="emails:write">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openRescheduleDialog(selected)}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      {t("emailHistory.reschedule")}
                    </Button>
                  </PermissionGate>
                )}
                <ResendActions email={selected} />
              </div>

              <Tabs defaultValue="recipients" className="mt-2">
                <TabsList>
                  <TabsTrigger value="recipients">
                    {t("emailHistory.tabRecipients")}
                  </TabsTrigger>
                  <TabsTrigger value="content">
                    {t("emailHistory.tabContent")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="recipients" className="space-y-4 pt-2">
                  <RecipientStatusTable
                    title={t("emails.to")}
                    recipients={selected.to}
                  />
                  {selected.cc && selected.cc.length > 0 && (
                    <RecipientStatusTable
                      title={t("emails.cc")}
                      recipients={selected.cc}
                    />
                  )}
                  {selected.bcc && selected.bcc.length > 0 && (
                    <RecipientStatusTable
                      title={t("emails.bcc")}
                      recipients={selected.bcc}
                    />
                  )}
                </TabsContent>

                <TabsContent value="content" className="pt-2">
                  <Separator className="mb-4" />
                  <div
                    className="tiptap-preview prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: selected.bodyHtml }}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rescheduleTarget}
        onOpenChange={(open) => !open && setRescheduleTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("emailHistory.rescheduleTitle")}</DialogTitle>
          </DialogHeader>
          {rescheduleTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {rescheduleTarget.subject}
              </p>
              <div className="space-y-2">
                <Label htmlFor="reschedule-at">{t("emails.scheduledAt")}</Label>
                <Input
                  id="reschedule-at"
                  type="datetime-local"
                  min={minScheduleDatetimeLocal()}
                  value={rescheduleAtLocal}
                  onChange={(e) => setRescheduleAtLocal(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("emails.scheduleTimezoneHint", { timezone: timezoneLabel })}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRescheduleTarget(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={rescheduleMutation.isPending}
                  onClick={handleRescheduleSubmit}
                >
                  {rescheduleMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("emailHistory.rescheduleConfirm")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
