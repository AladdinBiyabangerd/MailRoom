import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Search, UserPlus } from "lucide-react";
import {
  emailContactDisplayName,
  fetchEmailContactsRequest,
  type EmailAddressBookContact,
} from "@/api/email-contacts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryKeys } from "@/lib/query-keys";

export interface CampaignContactDraft {
  email: string;
  name?: string;
}

interface SavedContactPickerProps {
  selectedEmails: Set<string>;
  onAdd: (contact: CampaignContactDraft) => void;
  onAddMany: (contacts: CampaignContactDraft[]) => void;
}

export function SavedContactPicker({
  selectedEmails,
  onAdd,
  onAddMany,
}: SavedContactPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
  });

  const contacts = contactsPage?.items ?? [];

  const availableContacts = useMemo(
    () => contacts.filter((c) => !selectedEmails.has(c.email.toLowerCase())),
    [contacts, selectedEmails],
  );

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

  return (
    <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
      <div className="space-y-1">
        <Label>{t("emailContacts.searchSaved")}</Label>
        <p className="text-xs text-muted-foreground">{t("emailContacts.searchSavedHint")}</p>
      </div>

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

      <ScrollArea className="h-[220px] rounded-md border bg-background">
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
                    <p className="truncate text-sm font-medium">{emailContactDisplayName(contact)}</p>
                    <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
