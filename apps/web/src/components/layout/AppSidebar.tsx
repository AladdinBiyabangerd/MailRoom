import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { navSections } from "@/config/navigation";
import { BrandLogo } from "@/components/common/BrandLogo";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";

export function AppSidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { can } = usePermission();

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border/60 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <BrandLogo collapsed={collapsed} />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navSections
          .map((section) => ({
            ...section,
            items: section.items.filter((item) => !item.permission || can(item.permission)),
          }))
          .filter((section) => section.items.length > 0)
          .map((section, index) => (
          <div
            key={section.titleKey}
            className={cn(collapsed && index > 0 && "border-t border-sidebar-border/60 pt-3")}
          >
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {t(section.titleKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )
                    }
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
          ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-sidebar-border/60 p-4">
          <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
            <p className="text-xs font-medium text-sidebar-foreground/90">
              {t("app.name")}
            </p>
            <p className="mt-0.5 text-[11px] text-sidebar-foreground/55">
              v0.1.0 · {t("status.operational")}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
