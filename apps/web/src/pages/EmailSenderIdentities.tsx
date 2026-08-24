import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  createEmailSenderIdentityRequest,
  deleteEmailSenderIdentityRequest,
  fetchAllEmailSenderIdentitiesRequest,
  updateEmailSenderIdentityRequest,
  type EmailSenderIdentity,
} from "@/api/email-sender-identities";
import { getApiErrorMessage } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";
import { useQueryErrorToast } from "@/hooks/use-query-error-toast";

export default function EmailSenderIdentities() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailSenderIdentity | null>(null);
  const [deleting, setDeleting] = useState<EmailSenderIdentity | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [defaultSender, setDefaultSender] = useState(false);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: senders = [], isLoading, isError } = useQuery({
    queryKey: queryKeys.emailSenderIdentities.all,
    queryFn: fetchAllEmailSenderIdentitiesRequest,
  });

  useQueryErrorToast(isError, "emailSenders.loadError");

  const openCreate = () => {
    setEditing(null);
    setEmail("");
    setDisplayName("");
    setDefaultSender(senders.length === 0);
    setActive(true);
    setDialogOpen(true);
  };

  const openEdit = (row: EmailSenderIdentity) => {
    setEditing(row);
    setEmail(row.email);
    setDisplayName(row.displayName);
    setDefaultSender(row.defaultSender);
    setActive(row.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!email.trim() || !displayName.trim()) {
      toast.error(t("emailSenders.validation"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        email: email.trim(),
        displayName: displayName.trim(),
        defaultSender,
        active,
      };
      if (editing) {
        await updateEmailSenderIdentityRequest(editing.id, payload);
        toast.success(t("emailSenders.updated"));
      } else {
        await createEmailSenderIdentityRequest(payload);
        toast.success(t("emailSenders.created"));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.emailSenderIdentities.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.emailSenderIdentities.list() });
      setDialogOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailSenders.saveError")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteEmailSenderIdentityRequest(deleting.id);
      toast.success(t("emailSenders.deleted"));
      await queryClient.invalidateQueries({ queryKey: queryKeys.emailSenderIdentities.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.emailSenderIdentities.list() });
      setDeleting(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailSenders.deleteError")));
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<EmailSenderIdentity>[] = useMemo(
    () => [
      {
        key: "displayName",
        header: t("emailSenders.displayName"),
        render: (row) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.displayName}</span>
            {row.defaultSender && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <Star className="h-3 w-3" />
                {t("emailSenders.default")}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "email",
        header: t("emailSenders.email"),
        render: (row) => <span className="font-mono text-sm">{row.email}</span>,
      },
      {
        key: "active",
        header: t("common.status"),
        render: (row) => (
          <Badge variant={row.active ? "default" : "outline"}>
            {row.active ? t("common.active") : t("common.inactive")}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: t("common.actions"),
        align: "right",
        render: (row) => (
          <PermissionGate permission="mail-config:write">
            <div className="flex justify-end gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleting(row)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </PermissionGate>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t("emailSenders.title")}
        subtitle={t("emailSenders.subtitle")}
        actions={
          <PermissionGate permission="mail-config:write">
            <Button type="button" size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              {t("emailSenders.add")}
            </Button>
          </PermissionGate>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable columns={columns} rows={senders} rowKey={(r) => r.id} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("emailSenders.editTitle") : t("emailSenders.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sender-display-name">{t("emailSenders.displayName")}</Label>
              <Input
                id="sender-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("emailSenders.displayNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-email">{t("emailSenders.email")}</Label>
              <Input
                id="sender-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@company.az"
              />
              <p className="text-xs text-muted-foreground">{t("emailSenders.emailHint")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sender-default" checked={defaultSender} onCheckedChange={setDefaultSender} />
              <Label htmlFor="sender-default" className="font-normal">
                {t("emailSenders.setDefault")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sender-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="sender-active" className="font-normal">
                {t("common.active")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("emailSenders.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("emailSenders.deleteBody", { name: deleting?.label })}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
