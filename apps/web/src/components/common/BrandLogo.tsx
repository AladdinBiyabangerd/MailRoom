import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M5 19V9l7-4 7 4v10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d="M5 13h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="14" r="1.4" fill="currentColor" />
      </svg>
    </div>
  );
}

export function BrandLogo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-sidebar-foreground">
            {t("app.name")}
          </span>
          <span className="text-[11px] font-medium tracking-wide text-sidebar-foreground/55">
            {t("app.tagline")}
          </span>
        </div>
      )}
    </div>
  );
}
