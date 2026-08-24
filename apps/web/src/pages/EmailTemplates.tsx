import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Eye, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { EmailPreviewDialog } from "@/components/email/EmailPreview";
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
  deleteEmailTemplateRequest,
  fetchEmailTemplatesRequest,
  type EmailTemplate,
} from "@/api/email-templates";
import { getApiErrorMessage } from "@/lib/api-error";
import { useQueryErrorToast } from "@/hooks/use-query-error-toast";
import { queryKeys } from "@/lib/query-keys";

const TEMPLATE_LIST_PARAMS = { page: 1, limit: 100 };

export default function EmailTemplates() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);
  const [previewing, setPreviewing] = useState<EmailTemplate | null>(null);

  const {
    data: templatesPage,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.emailTemplates.list(TEMPLATE_LIST_PARAMS),
    queryFn: () => fetchEmailTemplatesRequest(TEMPLATE_LIST_PARAMS),
  });

  const rows = templatesPage?.items ?? [];
  useQueryErrorToast(isError, "emailTemplates.loadError");

  const columns: Column<EmailTemplate>[] = useMemo(
    () => [
      {
        key: "name",
        header: t("emailTemplates.name"),
        render: (row) => (
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">{row.name}</p>
              {row.description && (
                <p className="max-w-md truncate text-xs text-muted-foreground">{row.description}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "subject",
        header: t("emailTemplates.subject"),
        render: (row) => (
          <span className="max-w-[220px] truncate text-sm text-muted-foreground">
            {row.subject || "—"}
          </span>
        ),
      },
      {
        key: "actions",
        header: t("common.actions"),
        align: "right",
        render: (row) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={t("emails.preview")}
              aria-label={t("emails.preview")}
              onClick={() => setPreviewing(row)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <PermissionGate permission="emails:write">
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to={`/emails/templates/${row.id}/edit`}>
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

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(deleting.id);
    try {
      await deleteEmailTemplateRequest(deleting.id);
      toast.success(t("emailTemplates.deleted"));
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailTemplates.deleteError")));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t("emailTemplates.title")}
        subtitle={t("emailTemplates.subtitle")}
        actions={
          <PermissionGate permission="emails:write">
            <Button type="button" size="sm" className="gap-1.5" asChild>
              <Link to="/emails/templates/new">
                <Plus className="h-4 w-4" />
                {t("emailTemplates.add")}
              </Link>
            </Button>
          </PermissionGate>
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
              `${row.name} ${row.description ?? ""} ${row.subject ?? ""}`
            }
          />
        </div>
      )}

      <EmailPreviewDialog
        open={!!previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
        subject={previewing?.subject}
        html={previewing?.htmlBody ?? ""}
        attachments={
          previewing?.attachments?.length
            ? previewing.attachments.map((a) => a.fileName).join(", ")
            : undefined
        }
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("emailTemplates.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("emailTemplates.deleteBody", { name: deleting?.name })}
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
              {deletingId !== null ? t("emailTemplates.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
