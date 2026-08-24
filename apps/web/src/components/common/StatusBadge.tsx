import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  operational: "success",
  confirmed: "success",
  approved: "success",
  paid: "success",
  connected: "success",
  enabled: "success",
  pending: "warning",
  rejected: "danger",
  trial: "warning",
  degraded: "warning",
  inactive: "neutral",
  disabled: "neutral",
  suspended: "danger",
  cancelled: "danger",
  overdue: "danger",
  down: "danger",
  disconnected: "danger",
  archived: "neutral",
  sent: "info",
  delivered: "success",
  opened: "success",
  failed: "danger",
  bounced: "danger",
  queued: "warning",
  scheduled: "info",
};

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success/12 text-success ring-success/25",
  warning: "bg-warning/15 text-warning ring-warning/30",
  danger: "bg-destructive/12 text-destructive ring-destructive/25",
  info: "bg-info/12 text-info ring-info/25",
  neutral: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const tone = STATUS_TONE[status] ?? "neutral";
  const key = `status.${status}`;
  const translated = i18n.exists(key) ? t(key) : status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-success": tone === "success",
          "bg-warning": tone === "warning",
          "bg-destructive": tone === "danger",
          "bg-info": tone === "info",
          "bg-muted-foreground": tone === "neutral",
        })}
      />
      {label ?? translated}
    </span>
  );
}
