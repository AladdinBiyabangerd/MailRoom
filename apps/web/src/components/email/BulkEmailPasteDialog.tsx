import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardPaste } from "lucide-react";
import {
  formatInvalidToken,
  parseBulkEmails,
  type ParsedEmailContact,
} from "@/lib/parseBulkEmails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface BulkEmailPasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEmails?: Iterable<string>;
  onImport: (contacts: ParsedEmailContact[]) => void;
}

function normalizePasteInput(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trimEnd();
}

export function BulkEmailPasteDialog({
  open,
  onOpenChange,
  existingEmails = [],
  onImport,
}: BulkEmailPasteDialogProps) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState("");

  const existingSet = useMemo(
    () => new Set(Array.from(existingEmails, (email) => email.toLowerCase())),
    [existingEmails],
  );

  const parsed = useMemo(() => parseBulkEmails(normalizePasteInput(raw)), [raw]);

  const toImport = useMemo(
    () => parsed.contacts.filter((contact) => !existingSet.has(contact.email)),
    [existingSet, parsed.contacts],
  );

  const alreadyInListCount = parsed.contacts.length - toImport.length;
  const hasPreview = raw.trim().length > 0;
  const hasIssues = parsed.duplicates.length > 0 || parsed.invalidTokens.length > 0;

  const handleImport = () => {
    if (toImport.length === 0) return;
    onImport(toImport);
    setRaw("");
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setRaw("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(92vh,860px)] max-h-[92vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl top-[4vh] translate-y-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12">
          <DialogTitle>{t("bulkEmailPaste.title")}</DialogTitle>
          <DialogDescription>{t("bulkEmailPaste.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-email-paste">{t("bulkEmailPaste.inputLabel")}</Label>

            <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
              <Textarea
                id="bulk-email-paste"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={t("bulkEmailPaste.placeholder")}
                rows={5}
                className="min-h-[120px] resize-y border-0 bg-background font-mono text-sm shadow-none focus-visible:ring-1"
              />

              {hasPreview && (
                <>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Badge variant="secondary">
                      {t("bulkEmailPaste.validCount", { count: parsed.contacts.length })}
                    </Badge>
                    {toImport.length > 0 && (
                      <Badge variant="default">
                        {t("bulkEmailPaste.readyCount", { count: toImport.length })}
                      </Badge>
                    )}
                    {parsed.duplicateCount > 0 && (
                      <Badge variant="outline">
                        {t("bulkEmailPaste.duplicateCount", { count: parsed.duplicateCount })}
                      </Badge>
                    )}
                    {alreadyInListCount > 0 && (
                      <Badge variant="outline">
                        {t("bulkEmailPaste.alreadyExistCount", { count: alreadyInListCount })}
                      </Badge>
                    )}
                    {parsed.invalidTokens.length > 0 && (
                      <Badge variant="destructive">
                        {t("bulkEmailPaste.invalidCount", { count: parsed.invalidTokens.length })}
                      </Badge>
                    )}
                  </div>

                  {parsed.duplicates.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
                        {t("bulkEmailPaste.duplicateEntries", { count: parsed.duplicateCount })}
                      </p>
                      <div className="max-h-[160px] overflow-y-auto overscroll-contain rounded-md border border-amber-200/60 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
                        <ul className="divide-y divide-amber-200/40 dark:divide-amber-900/30">
                          {parsed.duplicates.map((contact) => (
                            <li
                              key={contact.email}
                              className="break-all px-3 py-2 text-sm text-foreground"
                            >
                              <span className="font-medium">{contact.email}</span>
                              {contact.name && (
                                <span className="text-muted-foreground"> — {contact.name}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {parsed.invalidTokens.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-destructive">
                        {t("bulkEmailPaste.invalidEntries", { count: parsed.invalidTokens.length })}
                      </p>
                      <div className="max-h-[120px] overflow-y-auto overscroll-contain rounded-md border border-destructive/30 bg-destructive/5">
                        <ul className="divide-y divide-destructive/10">
                          {parsed.invalidTokens.map((token, index) => (
                            <li
                              key={`${index}-${token}`}
                              className="break-all px-3 py-2 text-sm text-foreground"
                            >
                              {formatInvalidToken(token, t("bulkEmailPaste.emptyToken"))}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {!hasIssues && parsed.contacts.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("bulkEmailPaste.noEmailsFound")}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleImport} disabled={toImport.length === 0}>
            {t("bulkEmailPaste.import", { count: toImport.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BulkEmailPasteButtonProps {
  existingEmails?: Iterable<string>;
  onImport: (contacts: ParsedEmailContact[]) => void;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  className?: string;
}

export function BulkEmailPasteButton({
  existingEmails,
  onImport,
  size = "sm",
  variant = "outline",
  className,
}: BulkEmailPasteButtonProps) {
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
        <ClipboardPaste className="h-3.5 w-3.5" />
        {t("bulkEmailPaste.open")}
      </Button>
      <BulkEmailPasteDialog
        open={open}
        onOpenChange={setOpen}
        existingEmails={existingEmails}
        onImport={onImport}
      />
    </>
  );
}
