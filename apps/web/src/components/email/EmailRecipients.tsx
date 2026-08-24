import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, Users, X } from "lucide-react";
import {
  adminUserDisplayName,
  fetchSystemUsers,
  type AdminAccount,
} from "@/api/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { BulkEmailPasteButton } from "@/components/email/BulkEmailPasteDialog";
import { SavedContactPicker } from "@/components/email/SavedContactPicker";
import { queryKeys } from "@/lib/query-keys";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RecipientChip {
  email: string;
  label?: string;
}

interface EmailRecipientsProps {
  value: RecipientChip[];
  onChange: (recipients: RecipientChip[]) => void;
  label: string;
  id: string;
  showSavedContacts?: boolean;
}

export function EmailRecipients({
  value,
  onChange,
  label,
  id,
  showSavedContacts = false,
}: EmailRecipientsProps) {
  const { t } = useTranslation();
  const [systemUsersOpen, setSystemUsersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [customEmail, setCustomEmail] = useState("");

  const { data: users = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.systemUsers.list({ limit: 200 }),
    queryFn: () => fetchSystemUsers({ limit: 200 }),
    enabled: systemUsersOpen,
    staleTime: 60_000,
  });

  const tenantOptions = useMemo(
    () => Array.from(new Set(users.map((u) => u.tenant).filter(Boolean))).sort(),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (tenantFilter !== "all" && u.tenant !== tenantFilter) return false;
      if (!q) return true;
      return (
        adminUserDisplayName(u).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.tenant.toLowerCase().includes(q)
      );
    });
  }, [users, search, tenantFilter]);

  const selectedEmails = useMemo(
    () => new Set(value.map((r) => r.email.toLowerCase())),
    [value],
  );

  const addRecipient = (email: string, chipLabel?: string) => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized) || selectedEmails.has(normalized)) return;
    onChange([...value, { email: normalized, label: chipLabel }]);
  };

  const removeRecipient = (email: string) => {
    onChange(value.filter((r) => r.email !== email));
  };

  const toggleUser = (user: AdminAccount) => {
    if (selectedEmails.has(user.email.toLowerCase())) {
      removeRecipient(user.email);
    } else {
      addRecipient(user.email, adminUserDisplayName(user));
    }
  };

  const selectAllActive = () => {
    const active = filteredUsers.filter((u) => u.status === "active");
    const next = [...value];
    const existing = new Set(next.map((r) => r.email.toLowerCase()));
    for (const user of active) {
      const email = user.email.toLowerCase();
      if (!existing.has(email)) {
        next.push({ email, label: adminUserDisplayName(user) });
        existing.add(email);
      }
    }
    onChange(next);
  };

  const handleCustomAdd = () => {
    if (!EMAIL_RE.test(customEmail.trim())) return;
    addRecipient(customEmail);
    setCustomEmail("");
  };

  const importRecipients = (imported: { email: string; name?: string }[]) => {
    const next = [...value];
    const existing = new Set(next.map((r) => r.email.toLowerCase()));
    for (const contact of imported) {
      const email = contact.email.toLowerCase();
      if (existing.has(email)) continue;
      existing.add(email);
      next.push({ email, label: contact.name });
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {value.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => onChange([])}
          >
            {t("emails.recipients.clearAll")}
          </Button>
        )}
      </div>

      <div
        id={id}
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 shadow-sm",
        )}
      >
        {value.map((recipient) => (
          <Badge key={recipient.email} variant="secondary" className="gap-1 pr-1">
            <span className="max-w-[200px] truncate text-xs">
              {recipient.label ? `${recipient.label} <${recipient.email}>` : recipient.email}
            </span>
            <button
              type="button"
              className="rounded-sm p-0.5 hover:bg-muted"
              onClick={() => removeRecipient(recipient.email)}
              aria-label={t("emails.recipients.remove")}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {value.length === 0 && (
          <span className="px-1 text-xs text-muted-foreground">{t("emails.recipients.empty")}</span>
        )}
      </div>

      {showSavedContacts && (
        <SavedContactPicker
          selectedEmails={selectedEmails}
          onAdd={(contact) => importRecipients([contact])}
          onAddMany={importRecipients}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <BulkEmailPasteButton
          existingEmails={value.map((r) => r.email)}
          onImport={importRecipients}
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
        />

        <Popover open={systemUsersOpen} onOpenChange={setSystemUsersOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs">
              <Users className="h-3.5 w-3.5" />
              {t("emails.recipients.systemUsers")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0" align="start" side="bottom">
            <div className="space-y-3 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("emails.recipients.systemUsers")}</p>
                <p className="text-xs text-muted-foreground">{t("emails.recipients.systemUsersHint")}</p>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("emails.recipients.systemUsersSearchPlaceholder")}
                  className="pl-8"
                />
              </div>

              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("emails.recipients.filterTenant")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  {tenantOptions.map((tenant) => (
                    <SelectItem key={tenant} value={tenant}>
                      {tenant}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Input
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder={t("emails.recipients.customEmail")}
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCustomAdd();
                    }
                  }}
                />
                <Button type="button" size="sm" className="h-8 shrink-0" onClick={handleCustomAdd}>
                  {t("emails.recipients.addEmail")}
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full gap-1.5 text-xs"
                onClick={selectAllActive}
              >
                <Users className="h-3.5 w-3.5" />
                {t("emails.recipients.selectAllActive")}
              </Button>
            </div>

            <ScrollArea className="h-[220px] border-t">
              <div className="p-2">
                {loading ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    {t("common.loading")}
                  </p>
                ) : filteredUsers.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    {t("common.noResults")}
                  </p>
                ) : (
                  filteredUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={selectedEmails.has(user.email.toLowerCase())}
                        onCheckedChange={() => toggleUser(user)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{adminUserDisplayName(user)}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        <p className="text-[11px] text-muted-foreground">{user.tenant}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
