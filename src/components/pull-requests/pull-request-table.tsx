"use client";

import { memo, useMemo } from "react";
import { AnimatePresence, LayoutGroup, motion, type Variants } from "motion/react";
import { flexRender, type Row } from "@tanstack/react-table";
import { useDataGrid, type DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import {
  DataGridTableBase,
  DataGridTableEmpty,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableViewport,
  getDataGridTableMergedHeaderGroups,
  renderDataGridTableHeadCellContent,
} from "@/components/reui/data-grid/data-grid-table";
import { Skeleton } from "@/components/ui/skeleton";
import { DURATION, EASE_IN_OUT, EASE_OUT } from "@/components/motion/tokens";
import type { PullRequestItem } from "@/hooks/use-pull-requests";

const SKELETON_ROWS = 6;

const ROW_TRANSITION = {
  default: { duration: DURATION.base, ease: EASE_OUT },
  layout: { duration: DURATION.slow, ease: EASE_IN_OUT },
};

/**
 * The queue body. Replaces DataGridTable's body so rows can animate in, out
 * and between positions, and so an unchanged poll re-renders no row: each row
 * is memoized on its pull request object, which TanStack Query keeps
 * referentially stable while the data does not change.
 */
export function PullRequestTable({
  arrivals,
  departures,
  presenceKey,
}: {
  arrivals: ReadonlySet<string>;
  departures: ReadonlySet<string>;
  /** Changes on team, filter or page switches: rows swap without exit animations. */
  presenceKey: string;
}) {
  const { table, isLoading } = useDataGrid<PullRequestItem>();
  const headerGroups = getDataGridTableMergedHeaderGroups(table);
  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();

  return (
    <DataGridTableViewport>
      <DataGridTableBase>
        <DataGridTableHead>
          {headerGroups.map((group) => (
            <DataGridTableHeadRow key={group.id} rowId={group.id}>
              {[...group.startHeaders, ...group.centerHeaders, ...group.endHeaders].map(
                (header) => (
                  <DataGridTableHeadRowCell
                    key={header.id}
                    header={header}
                    coveredHeaders={group.coveredHeaders.get(header.id)}
                  >
                    {renderDataGridTableHeadCellContent(header)}
                  </DataGridTableHeadRowCell>
                ),
              )}
            </DataGridTableHeadRow>
          ))}
        </DataGridTableHead>
        <tbody data-slot="data-grid-table-body">
          {isLoading ? (
            Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <tr key={i} className="[&:not(:last-child)>td]:border-b">
                {columns.map((column) => (
                  <td key={column.id} className="px-2 py-1.5 align-middle">
                    <Skeleton className="h-4 w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <LayoutGroup key={presenceKey}>
              <AnimatePresence initial={false} custom={departures}>
                {rows.map((row, index) => (
                  <PullRequestRow
                    key={row.id}
                    row={row}
                    pullRequest={row.original}
                    index={index}
                    arrived={arrivals.has(row.id)}
                  />
                ))}
              </AnimatePresence>
            </LayoutGroup>
          )}
          {!isLoading && rows.length === 0 ? <DataGridTableEmpty /> : null}
        </tbody>
      </DataGridTableBase>
    </DataGridTableViewport>
  );
}

type PullRequestRowProps = {
  row: Row<DataGridFeatures, PullRequestItem>;
  /** Memo key: the row object is rebuilt on every data change, the pull request is not. */
  pullRequest: PullRequestItem;
  /** Re-renders rows whose position changed, which is what lets them measure and slide. */
  index: number;
  arrived: boolean;
};

const PullRequestRow = memo(
  function PullRequestRow({ row, arrived }: PullRequestRowProps) {
    const variants = useMemo<Variants>(
      () => ({
        arriving: { opacity: 0, y: 6 },
        present: { opacity: 1, y: 0 },
        // Only rows that left the data fade out; rows leaving the page because
        // of a re-sort disappear at once.
        exit: (departed: ReadonlySet<string>) =>
          departed.has(row.id)
            ? { opacity: 0, transition: { duration: DURATION.base, ease: EASE_OUT } }
            : { opacity: 0, transition: { duration: 0 } },
      }),
      [row.id],
    );

    return (
      <motion.tr
        layout="position"
        variants={variants}
        initial={arrived ? "arriving" : false}
        animate="present"
        exit="exit"
        transition={ROW_TRANSITION}
        data-row-id={row.id}
        data-arrived={arrived || undefined}
        className="hover:bg-muted/40 data-arrived:animate-row-arrive [&:not(:last-child)>td]:border-b"
      >
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id} className="px-2 py-1.5 align-middle">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </motion.tr>
    );
  },
  (prev, next) =>
    prev.pullRequest === next.pullRequest &&
    prev.index === next.index &&
    prev.arrived === next.arrived,
);
