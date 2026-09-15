import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmailContactRequest,
  deleteEmailContactRequest,
  emailContactDisplayName,
  fetchEmailContactsRequest,
  fetchEmailLabelsRequest,
  parseLabelInput,
  updateEmailContactRequest,
  type EmailAddressBookContact,
} from "@/api/email-contacts";
import { getApiErrorMessage } from "@/lib/api-error";
import { useQueryErrorToast } from "@/hooks/use-query-error-toast";
import { queryKeys } from "@/lib/query-keys";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALL_LABELS = "__all__";

interface ContactDraft {
  email: string;
  name: string;
  labels: string;
}

const emptyDraft = (): ContactDraft => ({ email: "", name: "", labels: "" });

export default function EmailContacts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [labelFilter, setLabelFilter] = useState(ALL_LABELS);
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const [editing, setEditing] = useState<EmailAddressBookContact | null>(null);
  const [deleting, setDeleting] = useState<EmailAddressBookContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const listParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      label: labelFilter === ALL_LABELS ? undefined : labelFilter,
      page: 1,
      limit: 200,
    }),
    [debouncedSearch, labelFilter],
  );

  const {
    data: contactsPage,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.emailContacts.list(listParams),
    queryFn: () => fetchEmailContactsRequest(listParams),
  });

  const { data: labels = [] } = useQuery({
    queryKey: queryKeys.emailContacts.labels,
    queryFn: fetchEmailLabelsRequest,
  });

  const rows = contactsPage?.items ?? [];
  useQueryErrorToast(isError, "emailContacts.loadError");

  const invalidateContacts = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.emailContacts.all });

  const invalidateContactUsages = async () => {
    await invalidateContacts();
    await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
  };

  const columns: Column<EmailAddressBookContact>[] = useMemo(
    () => [
      {
        key: "name",
        header: t("emailContacts.name"),
        render: (row) => (
          <div>
            <p className="font-medium">{emailContactDisplayName(row)}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        ),
      },
      {
        key: "labels",
        header: t("emailContacts.labels"),
        render: (row) =>
          row.labels?.length ? (
            <div className="flex flex-wrap gap-1">
              {row.labels.map((label) => (
                <Badge key={label.id} variant="secondary" className="font-normal">
                  {label.name}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        key: "actions",
        header: t("common.actions"),
        className: "w-[120px] text-right",
        render: (row) => (
          <div className="flex justify-end gap-1">
            <PermissionGate permission="emails:write">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setEditing(row);
                  setDraft({
                    email: row.email,
                    name: row.name ?? "",
                    labels: (row.labels ?? []).map((l) => l.name).join(", "),
                  });
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleting(row)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </PermissionGate>
          </div>
        ),
      },
    ],
    [t],
  );

  const handleSave = async () => {
    if (!draft) return;
    const normalized = draft.email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      toast.error(t("campaigns.invalidEmail"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        email: normalized,
        name: draft.name.trim() || undefined,
        labels: parseLabelInput(draft.labels),
      };
      if (editing) {
        await updateEmailContactRequest(editing.id, payload);
        toast.success(t("emailContacts.updated"));
      } else {
        await createEmailContactRequest(payload);
        toast.success(t("emailContacts.created"));
      }
      setDraft(null);
      setEditing(null);
      await invalidateContactUsages();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailContacts.saveError")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(deleting.id);
    try {
      await deleteEmailContactRequest(deleting.id);
      toast.success(t("emailContacts.deleted"));
      setDeleting(null);
      await invalidateContacts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailContacts.deleteError")));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t("emailContacts.title")}
        subtitle={t("emailContacts.subtitle")}
        actions={
          <PermissionGate permission="emails:write">
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditing(null);
                setDraft(emptyDraft());
              }}
            >
              <Plus className="h-4 w-4" />
              {t("emailContacts.add")}
            </Button>
          </PermissionGate>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Select value={labelFilter} onValueChange={setLabelFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t("emailContacts.filterByLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LABELS}>{t("emailContacts.allLabels")}</SelectItem>
              {labels.map((label) => (
                <SelectItem key={label.id} value={label.name}>
                  {label.name} ({label.contactCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => String(row.id)}
            searchAccessor={(row) =>
              `${row.email} ${row.name ?? ""} ${(row.labels ?? []).map((l) => l.name).join(" ")}`
            }
            controlledSearch={{
              query: searchQuery,
              filters: {},
              expanded: false,
              onQueryChange: setSearchQuery,
              onFilterChange: () => {},
              onClear: () => {
                setSearchQuery("");
                setLabelFilter(ALL_LABELS);
              },
              onToggleExpanded: () => {},
            }}
            disableClientFiltering
          />
        )}
      </div>

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("emailContacts.editTitle") : t("emailContacts.createTitle")}
            </DialogTitle>
            <DialogDescription>{t("emailContacts.formHint")}</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="contact-email">{t("emailContacts.email")}</Label>
                <Input
                  id="contact-email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder={t("campaigns.contactEmailPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-name">{t("emailContacts.name")}</Label>
                <Input
                  id="contact-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={t("campaigns.contactNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-labels">{t("emailContacts.labels")}</Label>
                <Input
                  id="contact-labels"
                  value={draft.labels}
                  onChange={(e) => setDraft({ ...draft, labels: e.target.value })}
                  placeholder={t("emailContacts.labelsPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">{t("emailContacts.labelsHint")}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(null);
                setEditing(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("emailContacts.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("emailContacts.deleteConfirm", {
                email: deleting?.email ?? "",
              })}
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
              {deletingId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("common.delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
