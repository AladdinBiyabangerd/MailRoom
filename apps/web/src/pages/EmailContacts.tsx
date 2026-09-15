import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Tags, Trash2, Users } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createEmailContactRequest,
  createEmailLabelRequest,
  deleteEmailContactRequest,
  deleteEmailLabelRequest,
  emailContactDisplayName,
  fetchEmailContactsRequest,
  fetchEmailLabelsRequest,
  parseLabelInput,
  updateEmailContactRequest,
  updateEmailLabelRequest,
  type EmailAddressBookContact,
  type EmailLabel,
} from "@/api/email-contacts";
import { getApiErrorMessage } from "@/lib/api-error";
import { useQueryErrorToast } from "@/hooks/use-query-error-toast";
import { queryKeys } from "@/lib/query-keys";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALL_LABELS = "__all__";
const PAGE_SIZE = 50;

interface ContactDraft {
  email: string;
  name: string;
  labels: string;
}

const emptyDraft = (): ContactDraft => ({ email: "", name: "", labels: "" });

export default function EmailContacts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("contacts");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [labelFilter, setLabelFilter] = useState(ALL_LABELS);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const [editing, setEditing] = useState<EmailAddressBookContact | null>(null);
  const [deleting, setDeleting] = useState<EmailAddressBookContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [labelSearch, setLabelSearch] = useState("");
  const [debouncedLabelSearch, setDebouncedLabelSearch] = useState("");
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<EmailLabel | null>(null);
  const [deletingLabel, setDeletingLabel] = useState<EmailLabel | null>(null);
  const [savingLabel, setSavingLabel] = useState(false);
  const [deletingLabelId, setDeletingLabelId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedLabelSearch(labelSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [labelSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, labelFilter]);

  const listParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      label: labelFilter === ALL_LABELS ? undefined : labelFilter,
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, labelFilter, page],
  );

  const {
    data: contactsPage,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.emailContacts.list(listParams),
    queryFn: () => fetchEmailContactsRequest(listParams),
  });

  const { data: filterLabels = [] } = useQuery({
    queryKey: queryKeys.emailContacts.labels,
    queryFn: () => fetchEmailLabelsRequest(),
  });

  const {
    data: managedLabels = [],
    isLoading: labelsLoading,
    isError: labelsError,
  } = useQuery({
    queryKey: [...queryKeys.emailContacts.labels, debouncedLabelSearch] as const,
    queryFn: () => fetchEmailLabelsRequest({ search: debouncedLabelSearch || undefined }),
  });

  const rows = contactsPage?.items ?? [];
  const total = contactsPage?.total ?? 0;
  useQueryErrorToast(isError, "emailContacts.loadError");
  useQueryErrorToast(labelsError, "emailContacts.labelsLoadError");

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

  const labelColumns: Column<EmailLabel>[] = useMemo(
    () => [
      {
        key: "name",
        header: t("emailContacts.labelName"),
        render: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        key: "count",
        header: t("emailContacts.contactCount"),
        render: (row) => (
          <Badge variant="secondary" className="font-normal">
            {row.contactCount}
          </Badge>
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
                  setEditingLabel(row);
                  setLabelDraft(row.name);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeletingLabel(row)}
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

  const handleSaveLabel = async () => {
    if (labelDraft == null) return;
    const name = labelDraft.trim();
    if (!name) {
      toast.error(t("emailContacts.labelNameRequired"));
      return;
    }
    setSavingLabel(true);
    try {
      if (editingLabel) {
        await updateEmailLabelRequest(editingLabel.id, { name });
        toast.success(t("emailContacts.labelUpdated"));
      } else {
        await createEmailLabelRequest({ name });
        toast.success(t("emailContacts.labelCreated"));
      }
      setLabelDraft(null);
      setEditingLabel(null);
      await invalidateContactUsages();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailContacts.labelSaveError")));
    } finally {
      setSavingLabel(false);
    }
  };

  const handleDeleteLabel = async () => {
    if (!deletingLabel) return;
    setDeletingLabelId(deletingLabel.id);
    try {
      await deleteEmailLabelRequest(deletingLabel.id);
      toast.success(t("emailContacts.labelDeleted"));
      if (labelFilter === deletingLabel.name) setLabelFilter(ALL_LABELS);
      setDeletingLabel(null);
      await invalidateContactUsages();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailContacts.labelDeleteError")));
    } finally {
      setDeletingLabelId(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t("emailContacts.title")}
        subtitle={t("emailContacts.subtitle")}
        actions={
          <PermissionGate permission="emails:write">
            {tab === "contacts" ? (
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
            ) : (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingLabel(null);
                  setLabelDraft("");
                }}
              >
                <Plus className="h-4 w-4" />
                {t("emailContacts.addLabel")}
              </Button>
            )}
          </PermissionGate>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="contacts" className="gap-1.5">
            <Users className="h-4 w-4" />
            {t("emailContacts.tabContacts")}
            {total > 0 ? ` (${total})` : ""}
          </TabsTrigger>
          <TabsTrigger value="labels" className="gap-1.5">
            <Tags className="h-4 w-4" />
            {t("emailContacts.tabLabels")}
            {filterLabels.length > 0 ? ` (${filterLabels.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4 space-y-4">
          <div className="w-full max-w-xs">
            <Select
              value={labelFilter}
              onValueChange={(value) => {
                setLabelFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("emailContacts.filterByLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LABELS}>{t("emailContacts.allLabels")}</SelectItem>
                {filterLabels.map((label) => (
                  <SelectItem key={label.id} value={label.name}>
                    {label.name} ({label.contactCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  setPage(1);
                },
                onToggleExpanded: () => {},
              }}
              disableClientFiltering
              pagination={{
                page,
                pageSize: PAGE_SIZE,
                total,
                onPageChange: setPage,
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="labels" className="mt-4">
          {labelsLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : (
            <DataTable
              columns={labelColumns}
              rows={managedLabels}
              rowKey={(row) => String(row.id)}
              searchAccessor={(row) => row.name}
              controlledSearch={{
                query: labelSearch,
                filters: {},
                expanded: false,
                onQueryChange: setLabelSearch,
                onFilterChange: () => {},
                onClear: () => setLabelSearch(""),
                onToggleExpanded: () => {},
              }}
              disableClientFiltering
            />
          )}
        </TabsContent>
      </Tabs>

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

      <Dialog
        open={labelDraft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLabelDraft(null);
            setEditingLabel(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLabel ? t("emailContacts.editLabelTitle") : t("emailContacts.createLabelTitle")}
            </DialogTitle>
            <DialogDescription>{t("emailContacts.labelFormHint")}</DialogDescription>
          </DialogHeader>
          {labelDraft !== null && (
            <div className="space-y-2 py-2">
              <Label htmlFor="label-name">{t("emailContacts.labelName")}</Label>
              <Input
                id="label-name"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                placeholder={t("emailContacts.labelNamePlaceholder")}
                autoFocus
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLabelDraft(null);
                setEditingLabel(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSaveLabel} disabled={savingLabel}>
              {savingLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingLabel !== null}
        onOpenChange={(open) => !open && setDeletingLabel(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("emailContacts.deleteLabelTitle")}</DialogTitle>
            <DialogDescription>
              {t("emailContacts.deleteLabelConfirm", {
                name: deletingLabel?.name ?? "",
                count: deletingLabel?.contactCount ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingLabel(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteLabel}
              disabled={deletingLabelId !== null}
            >
              {deletingLabelId !== null ? (
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
