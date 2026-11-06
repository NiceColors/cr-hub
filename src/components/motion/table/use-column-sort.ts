import { useCallback, useMemo, useState } from "react";
import type { SortState, TableColumn, TableRow } from "./types";
import { readSortValue } from "./utils";

/** Sorts rows by a column the same way the table header does. Returns a copy. */
export function sortByColumn<T>(
  data: readonly T[],
  columns: TableColumn<T>[],
  sort: SortState | null,
): T[] {
  const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
  if (!sort || !column) return [...data];
  return sortBy(data, (row) => readSortValue(row, column), sort.direction);
}

function sortBy<R>(
  data: readonly R[],
  read: (row: R) => string | number,
  direction: SortState["direction"],
): R[] {
  return data.toSorted((a, b) => {
    const av = read(a);
    const bv = read(b);
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return direction === "asc" ? cmp : -cmp;
  });
}

export function useColumnSort<T>({
  rows,
  columns,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  manualSort = false,
}: {
  rows: TableRow<T>[];
  columns: TableColumn<T>[];
  sort?: SortState | null;
  defaultSort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  manualSort?: boolean;
}) {
  const [internalSort, setInternalSort] = useState<SortState | null>(
    defaultSort,
  );
  const sort = sortProp !== undefined ? sortProp : internalSort;

  const commit = useCallback(
    (next: SortState | null) => {
      if (sortProp === undefined) setInternalSort(next);
      onSortChange?.(next);
    },
    [sortProp, onSortChange],
  );

  const toggleSort = useCallback(
    (key: string) => {
      if (!sort || sort.key !== key) {
        commit({ key, direction: "asc" });
      } else if (sort.direction === "asc") {
        commit({ key, direction: "desc" });
      } else {
        commit(null);
      }
    },
    [sort, commit],
  );

  const sortedRows = useMemo(() => {
    if (!sort || manualSort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    return sortBy(rows, (entry) => readSortValue(entry.row, column), sort.direction);
  }, [rows, sort, columns, manualSort]);

  return { sort, sortedRows, toggleSort };
}
