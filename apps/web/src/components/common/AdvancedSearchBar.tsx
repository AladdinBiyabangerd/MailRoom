import { useTranslation } from "react-i18next";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_FILTER_VALUE,
  countActiveFilters,
  type SearchFilterDef,
} from "@/lib/advancedSearch";
import { cn } from "@/lib/utils";

interface AdvancedSearchBarProps<T> {
  query: string;
  onQueryChange: (value: string) => void;
  filters: Record<string, string>;
  onFilterChange: (id: string, value: string) => void;
  filterDefs?: SearchFilterDef<T>[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onClear: () => void;
  className?: string;
}

export function AdvancedSearchBar<T>({
  query,
  onQueryChange,
  filters,
  onFilterChange,
  filterDefs = [],
  expanded,
  onToggleExpanded,
  onClear,
  className,
}: AdvancedSearchBarProps<T>) {
  const { t } = useTranslation();
  const activeCount = countActiveFilters(query, filters);
  const hasFilters = filterDefs.length > 0;

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("common.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasFilters && (
            <Button
              type="button"
              variant={expanded ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={onToggleExpanded}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("common.advancedSearch")}
              {activeCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {activeCount}
                </Badge>
              )}
            </Button>
          )}

          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={onClear}
            >
              <X className="h-3.5 w-3.5" />
              {t("common.clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {hasFilters && expanded && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filterDefs.map((def) => (
            <div key={def.id} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{def.label}</Label>
              {def.type === "select" ? (
                <Select
                  value={filters[def.id] ?? ALL_FILTER_VALUE}
                  onValueChange={(v) => onFilterChange(def.id, v)}
                >
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>{t("common.all")}</SelectItem>
                    {def.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={filters[def.id] === ALL_FILTER_VALUE ? "" : (filters[def.id] ?? "")}
                  onChange={(e) =>
                    onFilterChange(def.id, e.target.value.trim() ? e.target.value : ALL_FILTER_VALUE)
                  }
                  placeholder={def.placeholder ?? t("common.searchPlaceholder")}
                  className="h-9 bg-background"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
