import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { isFullHtmlDocument } from "@/lib/html-source";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

function toPreviewDocument(html: string, emptyLabel: string): string {
  const source = html.trim();
  if (!source) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>${emptyLabel}</p></body></html>`;
  }
  if (isFullHtmlDocument(source)) {
    return source;
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 16px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #222; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>${source}</body>
</html>`;
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="font-medium text-muted-foreground">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

export function EmailPreviewFrame({
  html,
  emptyLabel,
  heightClassName = "h-[min(60vh,560px)]",
}: {
  html: string;
  emptyLabel: string;
  heightClassName?: string;
}) {
  const srcDoc = useMemo(() => toPreviewDocument(html, emptyLabel), [html, emptyLabel]);

  return (
    <iframe
      title="email-preview"
      sandbox=""
      srcDoc={srcDoc}
      className={`w-full rounded-md border bg-white ${heightClassName}`}
    />
  );
}

export function EmailPreviewDialog({
  open,
  onOpenChange,
  subject,
  html,
  to,
  cc,
  bcc,
  from,
  attachments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: string;
  html: string;
  to?: string;
  cc?: string;
  bcc?: string;
  from?: string;
  attachments?: string;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,56rem)] max-w-4xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("emails.previewTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t("emails.previewHint")}</p>
        <div className="space-y-2">
          <MetaRow label={t("emails.fromSender")} value={from} />
          <MetaRow label={t("emails.to")} value={to} />
          <MetaRow label={t("emails.cc")} value={cc} />
          <MetaRow label={t("emails.bcc")} value={bcc} />
          <MetaRow label={t("emails.subject")} value={subject || "—"} />
          <MetaRow label={t("emails.attachments")} value={attachments} />
        </div>
        <Separator />
        <EmailPreviewFrame html={html} emptyLabel={t("emails.emptyBody")} />
      </DialogContent>
    </Dialog>
  );
}

export function EmailPreviewButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onClick} disabled={disabled}>
      <Eye className="h-4 w-4" />
      {t("emails.preview")}
    </Button>
  );
}
