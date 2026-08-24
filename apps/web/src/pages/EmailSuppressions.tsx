import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Trash2, UserX } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteEmailSuppressionRequest,
  fetchEmailSuppressionsRequest,
  type EmailSuppression,
} from "@/api/email-suppressions";
import { getApiErrorMessage } from "@/lib/api-error";
import { useQueryErrorToast } from "@/hooks/use-query-error-toast";
import { queryKeys } from "@/lib/query-keys";

const LIST_PARAMS = { page: 1, limit: 100 };

export default function EmailSuppressions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<EmailSuppression | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.emailSuppressions.list(LIST_PARAMS),
    queryFn: () => fetchEmailSuppressionsRequest(LIST_PARAMS),
  });

  const rows = data?.items ?? [];
  useQueryErrorToast(isError, "emailSuppressions.loadError");

  const columns: Column<EmailSuppression>[] = useMemo(
    () => [
      {
        key: "email",
        header: t("emailContacts.email"),
        render: (row) => (
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.email}</span>
          </div>
        ),
      },
      {
        key: "source",
        header: t("emailSuppressions.source"),
        render: (row) => t(`emailSuppressions.source.${row.source.toLowerCase()}`),
      },
      {
        key: "unsubscribedAt",
        header: t("emailSuppressions.unsubscribedAt"),
        render: (row) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.unsubscribedAt ? new Date(row.unsubscribedAt).toLocaleString() : "—"}
          </span>
        ),
      },
      {
        key: "actions",
        header: t("common.actions"),
        align: "right",
        render: (row) => (
          <PermissionGate permission="emails:write">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDeleting(row)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </PermissionGate>
        ),
      },
    ],
    [t],
  );

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(deleting.id);
    try {
      await deleteEmailSuppressionRequest(deleting.id);
      toast.success(t("emailSuppressions.resubscribed"));
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.emailSuppressions.all });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailSuppressions.deleteError")));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t("emailSuppressions.title")}
        subtitle={t("emailSuppressions.subtitle")}
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
            searchAccessor={(row) => row.email}
          />
        </div>
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("emailSuppressions.resubscribeTitle")}</DialogTitle>
            <DialogDescription>
              {t("emailSuppressions.resubscribeBody", { email: deleting?.email })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleDelete} disabled={deletingId !== null}>
              {deletingId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("emailSuppressions.resubscribeConfirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
