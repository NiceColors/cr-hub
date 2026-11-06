export const QUEUE_PAGE_SIZES = [10, 25, 50, 100] as const;

export type QueuePageSize = (typeof QUEUE_PAGE_SIZES)[number];

export function isQueuePageSize(value: number): value is QueuePageSize {
  return (QUEUE_PAGE_SIZES as readonly number[]).includes(value);
}

export type PageSlice<T> = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** 1-based index of the first row on this page. 0 when the list is empty. */
  start: number;
  /** 1-based index of the last row on this page. 0 when the list is empty. */
  end: number;
  items: T[];
};

export function paginate<T>(items: readonly T[], page: number, pageSize: number): PageSlice<T> {
  const total = items.length;
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const offset = (current - 1) * size;
  const slice = items.slice(offset, offset + size);
  return {
    page: current,
    pageCount,
    pageSize: size,
    total,
    start: total === 0 ? 0 : offset + 1,
    end: offset + slice.length,
    items: slice,
  };
}