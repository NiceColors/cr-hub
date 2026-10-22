"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
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
  const rows = table.getRowModel().rows;
  const columnIds = table.getVisibleLeafColumns().map((column) => column.id);

  // Rows fade in only when they replace the skeleton, not when cached data
  // is already there on mount.
  const [sawSkeleton, setSawSkeleton] = useState(isLoading);
  if (isLoading && !sawSkeleton) setSawSkeleton(true);

  return (
    <DataGridTableViewport>
      <DataGridTableBase>
        <QueueHead />
        {isLoading ? (
          // Invisible spacers hold the skeleton's height in the flow; the
          // visible skeleton is the overlay below, so it can fade out over the
          // rows that replace it.
          <tbody key="skeleton" aria-hidden className="invisible">
            <SkeletonRows columnIds={columnIds} />
          </tbody>
        ) : (
          <motion.tbody
            key="rows"
            data-slot="data-grid-table-body"
            initial={sawSkeleton ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
          >
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
            {rows.length === 0 ? <DataGridTableEmpty /> : null}
          </motion.tbody>
        )}
      </DataGridTableBase>
      <AnimatePresence initial={false}>
        {isLoading ? (
          <motion.div
            key="skeleton"
            aria-hidden
            inert
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-0 [&_thead]:invisible"
          >
            {/* Same colgroup and an invisible header copy: columns and rows
                line up with the real table without measuring anything. */}
            <DataGridTableBase>
              <QueueHead />
              <tbody>
                <SkeletonRows columnIds={columnIds} />
              </tbody>
            </DataGridTableBase>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </DataGridTableViewport>
  );
}

function QueueHead() {
  const { table } = useDataGrid<PullRequestItem>();
  return (
    <DataGridTableHead>
      {getDataGridTableMergedHeaderGroups(table).map((group) => (
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
  );
}

// Must equal the tallest real cell (the title cell: a text-sm line, gap-0.5
// and a text-xs line = 20 + 2 + 16px), so skeleton rows and real rows match.
const ROW_CONTENT_HEIGHT = "h-[38px]";

const SKELETON_CELLS: Record<string, ReactNode> = {
  createdOn: (
    <>
      <Skeleton className="size-2 rounded-full" />
      <Skeleton className="h-3.5 w-16" />
    </>
  ),
  title: (
    <div className="flex w-full flex-col gap-1.5">
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3 w-28" />
    </div>
  ),
  author: (
    <>
      <Skeleton className="size-6 rounded-full" />
      <Skeleton className="h-3.5 w-24" />
    </>
  ),
  approvals: (
    <>
      <Skeleton className="h-1.5 w-[1.625rem] rounded-full" />
      <Skeleton className="h-3 w-6" />
    </>
  ),
  state: <Skeleton className="h-5 w-20 rounded-full" />,
};

function SkeletonRows({ columnIds }: { columnIds: string[] }) {
  return Array.from({ length: SKELETON_ROWS }, (_, i) => (
    <tr key={i} className="[&:not(:last-child)>td]:border-b">
      {columnIds.map((id) => (
        <td key={id} className="px-2 py-1.5 align-middle">
          <div className={`flex items-center gap-2 ${ROW_CONTENT_HEIGHT}`}>
            {SKELETON_CELLS[id] ?? <Skeleton className="h-3.5 w-3/4" />}
          </div>
        </td>
      ))}
    </tr>
  ));
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
