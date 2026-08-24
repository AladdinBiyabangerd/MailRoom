export type SearchFilterType = "select" | "text";

export interface SearchFilterDef<T> {
  id: string;
  label: string;
  type: SearchFilterType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  getValue: (row: T) => string;
}

export const ALL_FILTER_VALUE = "all";

export function createInitialFilters(defs: SearchFilterDef<unknown>[]): Record<string, string> {
  return Object.fromEntries(defs.map((d) => [d.id, ALL_FILTER_VALUE]));
}

export function countActiveFilters(
  query: string,
  filters: Record<string, string>,
): number {
  let count = query.trim() ? 1 : 0;
  for (const value of Object.values(filters)) {
    if (value && value !== ALL_FILTER_VALUE) count += 1;
  }
  return count;
}

/** All whitespace-separated tokens must appear in the haystack. */
export function matchesTextSearch(haystack: string, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = haystack.toLowerCase();
  return tokens.every((token) => text.includes(token));
}

export function matchesAdvancedFilters<T>(
  row: T,
  filters: Record<string, string>,
  filterDefs: SearchFilterDef<T>[],
): boolean {
  for (const def of filterDefs) {
    const value = filters[def.id];
    if (!value || value === ALL_FILTER_VALUE) continue;

    const rowValue = def.getValue(row);
    if (def.type === "text") {
      if (!matchesTextSearch(rowValue, value)) return false;
    } else if (rowValue !== value) {
      return false;
    }
  }
  return true;
}

export function filterRows<T>(
  rows: T[],
  query: string,
  filters: Record<string, string>,
  searchAccessor: ((row: T) => string) | undefined,
  filterDefs: SearchFilterDef<T>[] | undefined,
): T[] {
  const hasQuery = !!query.trim();
  const hasFilters = filterDefs?.some(
    (d) => filters[d.id] && filters[d.id] !== ALL_FILTER_VALUE,
  );

  if (!hasQuery && !hasFilters) return rows;

  return rows.filter((row) => {
    if (searchAccessor && hasQuery && !matchesTextSearch(searchAccessor(row), query)) {
      return false;
    }
    if (filterDefs?.length && !matchesAdvancedFilters(row, filters, filterDefs)) {
      return false;
    }
    return true;
  });
}
