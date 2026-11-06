"use client";

import { Pagination } from "@/components/motion/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import {
  QUEUE_PAGE_SIZES,
  isQueuePageSize,
  type QueuePageSize,
} from "@/components/pull-requests/queue-pagination";
import { cn } from "@/lib/utils";

export function QueuePaginationBar({
  page,
  pageCount,
  pageSize,
  start,
  end,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  className?: string;
  page: number;
  pageCount: number;
  pageSize: QueuePageSize;
  start: number;
  end: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: QueuePageSize) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        {total === 0 ? "0" : `${start}–${end}`} de {total}
      </p>

      <Pagination
        aria-label="Paginação da fila"
        className="justify-center"
        totalPages={pageCount}
        page={page}
        onPageChange={onPageChange}
      />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Por página</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            const next = Number(value);
            if (isQueuePageSize(next)) onPageSizeChange(next);
          }}
          className="z-30 w-20"
        >
          <SelectTrigger className="h-8 py-0">
            <span className="sr-only">Por página</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUEUE_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
