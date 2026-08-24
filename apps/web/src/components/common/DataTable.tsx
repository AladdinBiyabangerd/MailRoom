import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdvancedSearchBar } from "@/components/common/AdvancedSearchBar";
import {
  createInitialFilters,
  filterRows,
  type SearchFilterDef,
} from "@/lib/advancedSearch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 20;

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface ControlledTableSearch {
  query: string;
  filters: Record<string, string>;
  expanded: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (id: string, value: string) => void;
  onClear: () => void;
  onToggleExpanded: () => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  searchAccessor?: (row: T) => string;
  searchFilters?: SearchFilterDef<T>[];
  controlledSearch?: ControlledTableSearch;
  disableClientFiltering?: boolean;
  toolbar?: ReactNode;
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  pagination?: ServerPagination;
}

export function DataTable<T>({
  columns,
  rows,
  searchAccessor,
  searchFilters,
  controlledSearch,
  disableClientFiltering = false,
  toolbar,
  rowKey,
  onRowClick,
  pagination,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [internalQuery, setInternalQuery] = useState("");
  const [internalFilters, setInternalFilters] = useState(() =>
    createInitialFilters((searchFilters ?? []) as SearchFilterDef<unknown>[]),
  );
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [clientPage, setClientPage] = useState(1);

  const query = controlledSearch?.query ?? internalQuery;
  const filters = controlledSearch?.filters ?? internalFilters;
  const expanded = controlledSearch?.expanded ?? internalExpanded;

  const filtered = useMemo(() => {
    if (disableClientFiltering) return rows;
    return filterRows(rows, query, filters, searchAccessor, searchFilters);
  }, [disableClientFiltering, rows, query, filters, searchAccessor, searchFilters]);

  useEffect(() => {
    if (!controlledSearch) {
      setClientPage(1);
    }
  }, [controlledSearch, query, filters, rows]);

  const handleQueryChange = (value: string) => {
    if (controlledSearch) {
      controlledSearch.onQueryChange(value);
    } else {
      setInternalQuery(value);
    }
  };

  const handleFilterChange = (id: string, value: string) => {
    if (controlledSearch) {
      controlledSearch.onFilterChange(id, value);
    } else {
      setInternalFilters((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleClear = () => {
    if (controlledSearch) {
      controlledSearch.onClear();
    } else {
      setInternalQuery("");
      setInternalFilters(
        createInitialFilters((searchFilters ?? []) as SearchFilterDef<unknown>[]),
      );
    }
  };

  const handleToggleExpanded = () => {
    if (controlledSearch) {
      controlledSearch.onToggleExpanded();
    } else {
      setInternalExpanded((v) => !v);
    }
  };

  const hasSearch = !!searchAccessor || !!searchFilters?.length;

  const alignClass = (align?: string) =>
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  const isServerPaginated = pagination != null;
  const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
  const activePage = pagination?.page ?? clientPage;
  const listTotal = isServerPaginated ? pagination.total : filtered.length;
  const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));
  const displayedRows = isServerPaginated
    ? filtered
    : filtered.slice((activePage - 1) * pageSize, activePage * pageSize);
  const from = listTotal === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const to = Math.min(activePage * pageSize, listTotal);
  const showPagination = isServerPaginated || totalPages > 1;

  const handlePageChange = (nextPage: number) => {
    if (pagination) {
      pagination.onPageChange(nextPage);
    } else {
      setClientPage(nextPage);
    }
  };

  return (
    <Card className="shadow-card overflow-hidden p-0">
      {hasSearch && (
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-start lg:justify-between">
          <AdvancedSearchBar
            query={query}
            onQueryChange={handleQueryChange}
            filters={filters}
            onFilterChange={handleFilterChange}
            filterDefs={searchFilters}
            expanded={expanded}
            onToggleExpanded={handleToggleExpanded}
            onClear={handleClear}
            className="min-w-0 flex-1"
          />
          {toolbar && (
            <div className="flex shrink-0 items-center gap-2 lg:pt-0.5">{toolbar}</div>
          )}
        </div>
      )}

      {!hasSearch && toolbar && (
        <div className="flex items-center justify-end gap-2 border-b border-border p-4">
          {toolbar}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn("whitespace-nowrap", alignClass(c.align), c.className)}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {t("common.noResults")}
                </TableCell>
              </TableRow>
            ) : (
              displayedRows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  className={cn("hover:bg-muted/50", onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn("whitespace-nowrap", alignClass(c.align), c.className)}
                    >
                      {c.render ? c.render(row) : (row as any)[c.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {t("common.showing", {
            from,
            to,
            total: listTotal,
          })}
        </p>
        {showPagination ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={activePage <= 1}
              onClick={() => handlePageChange(activePage - 1)}
            >
              {t("common.previousPage")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("common.pageOf", { page: activePage, total: totalPages })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={activePage >= totalPages}
              onClick={() => handlePageChange(activePage + 1)}
            >
              {t("common.nextPage")}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
