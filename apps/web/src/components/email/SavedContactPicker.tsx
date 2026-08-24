import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BookUser, Loader2, Plus, Search, UserPlus } from "lucide-react";
import {
  createEmailContactRequest,
  emailContactDisplayName,
  fetchEmailContactsRequest,
  type EmailAddressBookContact,
} from "@/api/email-contacts";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { queryKeys } from "@/lib/query-keys";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CampaignContactDraft {
  email: string;
  name?: string;
}

interface SavedContactPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmails: Set<string>;
  onAdd: (contact: CampaignContactDraft) => void;
  onAddMany: (contacts: CampaignContactDraft[]) => void;
}

export function SavedContactPickerDialog({
  open,
  onOpenChange,
  selectedEmails,
  onAdd,
  onAddMany,
}: SavedContactPickerDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setNewEmail("");
      setNewName("");
    }
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const listParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      page: 1,
      limit: 100,
    }),
    [debouncedSearch],
  );

  const { data: contactsPage, isLoading: loading } = useQuery({
    queryKey: queryKeys.emailContacts.list(listParams),
    queryFn: () => fetchEmailContactsRequest(listParams),
    enabled: open,
  });

  const contacts = contactsPage?.items ?? [];

  const availableContacts = useMemo(
    () => contacts.filter((c) => !selectedEmails.has(c.email.toLowerCase())),
    [contacts, selectedEmails],
  );

  const createMutation = useMutation({
    mutationFn: createEmailContactRequest,
    onSuccess: async (created) => {
      toast.success(t("emailContacts.created"));
      await queryClient.invalidateQueries({ queryKey: queryKeys.emailContacts.all });
      const email = created.email.toLowerCase();
      if (!selectedEmails.has(email)) {
        onAdd({ email, name: created.name });
      }
      setNewEmail("");
      setNewName("");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t("emailContacts.saveError")));
    },
  });

  const toggleContact = (contact: EmailAddressBookContact) => {
    const email = contact.email.toLowerCase();
    if (selectedEmails.has(email)) return;
    onAdd({ email, name: contact.name });
  };

  const addAllVisible = () => {
    const toAdd = availableContacts.map((c) => ({
      email: c.email.toLowerCase(),
      name: c.name,
    }));
    if (toAdd.length === 0) return;
    onAddMany(toAdd);
  };

  const handleCreate = () => {
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toast.error(t("emailContacts.invalidEmail"));
      return;
    }
    createMutation.mutate({
      email,
      name: newName.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12">
          <DialogTitle>{t("emailContacts.searchSaved")}</DialogTitle>
          <DialogDescription>{t("emailContacts.searchSavedHint")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
            <p className="text-sm font-medium">{t("emailContacts.createInPicker")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="saved-contact-email">{t("emailContacts.email")}</Label>
                <Input
                  id="saved-contact-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={t("emailContacts.emailPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="saved-contact-name">{t("emailContacts.name")}</Label>
                <Input
                  id="saved-contact-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("emailContacts.namePlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 w-full gap-1.5 text-xs sm:w-auto"
              onClick={handleCreate}
              disabled={createMutation.isPending || !newEmail.trim()}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {t("emailContacts.createAndAdd")}
            </Button>
          </div>

          <Separator />

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("emailContacts.searchPlaceholder")}
              className="pl-8"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5 text-xs"
            onClick={addAllVisible}
            disabled={availableContacts.length === 0}
          >
            <UserPlus className="h-3.5 w-3.5" />
            {t("emailContacts.addAllVisible", { count: availableContacts.length })}
          </Button>

          <ScrollArea className="h-[260px] rounded-md border bg-background">
            <div className="p-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : contacts.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                  {t("emailContacts.noSavedContacts")}
                </p>
              ) : (
                contacts.map((contact) => {
                  const isSelected = selectedEmails.has(contact.email.toLowerCase());
                  return (
                    <label
                      key={contact.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isSelected}
                        onCheckedChange={() => toggleContact(contact)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {emailContactDisplayName(contact)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SavedContactPickerButtonProps {
  selectedEmails: Set<string>;
  onAdd: (contact: CampaignContactDraft) => void;
  onAddMany: (contacts: CampaignContactDraft[]) => void;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  className?: string;
}

export function SavedContactPickerButton({
  selectedEmails,
  onAdd,
  onAddMany,
  size = "sm",
  variant = "outline",
  className,
}: SavedContactPickerButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <BookUser className="h-3.5 w-3.5" />
        {t("emailContacts.searchSaved")}
      </Button>
      <SavedContactPickerDialog
        open={open}
        onOpenChange={setOpen}
        selectedEmails={selectedEmails}
        onAdd={onAdd}
        onAddMany={onAddMany}
      />
    </>
  );
}
