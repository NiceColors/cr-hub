import type { ReactNode } from "react";
import type { TableColumn } from "./types";

export const CHECKBOX_PX = 48;
export const CHECKBOX_WIDTH = `${CHECKBOX_PX}px`;

/** Highlights the top edge of the active column's header cell. */
export const COLUMN_ACTIVE_SHADOW = "inset 0 1px 0 var(--color-primary)";

export function alignFlex(align: TableColumn<unknown>["align"]) {
  if (align === "right") return "justify-end";
  if (align === "center") return "justify-center";
  return "justify-start";
}

const HIDE_CELL = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
} as const;
const HIDE_COL = {
  sm: "hidden sm:table-column",
  md: "hidden md:table-column",
  lg: "hidden lg:table-column",
} as const;

/** Classes that drop a column's cells below its `hideBelow` breakpoint. */
export function hideCell(hideBelow: TableColumn<unknown>["hideBelow"]) {
  return hideBelow ? HIDE_CELL[hideBelow] : undefined;
}

/** Same as `hideCell`, for the column's <col>. */
export function hideCol(hideBelow: TableColumn<unknown>["hideBelow"]) {
  return hideBelow ? HIDE_COL[hideBelow] : undefined;
}

export function alignText(align: TableColumn<unknown>["align"]) {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function readCell<T>(row: T, column: TableColumn<T>): ReactNode {
  if (column.cell) return column.cell(row);
  return (row as Record<string, ReactNode>)[column.key];
}

export function readSortValue<T>(
  row: T,
  column: TableColumn<T>,
): string | number {
  if (column.sortValue) return column.sortValue(row);
  return (row as Record<string, string | number>)[column.key];
}
