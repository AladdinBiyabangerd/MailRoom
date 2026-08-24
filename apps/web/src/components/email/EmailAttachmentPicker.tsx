import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  filesToAttachments,
  formatFileSize,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  type EmailAttachmentItem,
} from "@/lib/attachments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function EmailAttachmentPicker({
  items,
  onChange,
  disabled,
  hint,
  extra,
  max = MAX_ATTACHMENTS,
}: {
  items: EmailAttachmentItem[];
  onChange: (items: EmailAttachmentItem[]) => void;
  disabled?: boolean;
  hint?: string;
  extra?: ReactNode;
  max?: number;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    if (items.length + files.length > max) {
      toast.error(t("emails.validation.tooManyAttachments", { max }));
      return;
    }

    const accepted: File[] = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(t("emails.validation.attachmentTooLarge", { name: file.name }));
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) return;

    try {
      const added = await filesToAttachments(accepted);
      onChange([...items, ...added]);
    } catch {
      toast.error(t("emails.validation.attachmentReadFailed", { name: accepted[0]?.name ?? "file" }));
    }
  };

  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleFileSelect(event)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || items.length >= max}
        >
          <Paperclip className="h-3.5 w-3.5" />
          {t("emails.addAttachment")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {hint ?? t("emails.attachmentsHint", { max: MAX_ATTACHMENTS })}
        </span>
      </div>

      {extra ? <div className="mt-3">{extra}</div> : null}

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((attachment) => (
            <Badge key={attachment.key} variant="secondary" className="gap-1 pr-1">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[180px] truncate text-xs">
                {attachment.fileName} ({formatFileSize(attachment.size)})
              </span>
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                onClick={() => onChange(items.filter((item) => item.key !== attachment.key))}
                disabled={disabled}
                aria-label={t("emails.removeAttachment")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
