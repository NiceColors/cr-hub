import { describe, expect, test } from "vitest";
import { paginationRange } from "@/components/motion/pagination";
import { paginate } from "@/components/pull-requests/queue-pagination";

describe("paginate", () => {
  const items = Array.from({ length: 181 }, (_, index) => index + 1);

  test("returns the requested page and a 1-based range", () => {
    const page = paginate(items, 2, 25);
    expect(page.page).toBe(2);
    expect(page.pageCount).toBe(8);
    expect(page.start).toBe(26);
    expect(page.end).toBe(50);
    expect(page.items).toEqual(Array.from({ length: 25 }, (_, index) => index + 26));
  });

  test("clamps a page past the end and an empty list", () => {
    expect(paginate(items, 99, 50).page).toBe(4);
    expect(paginate(items, 99, 50).end).toBe(181);
    expect(paginate([], 3, 25)).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 0, items: [] });
  });
});

describe("paginationRange", () => {
  test("lists every page when there are only a few", () => {
    expect(paginationRange(1, 4)).toEqual([1, 2, 3, 4]);
  });

  test("collapses the middle of a long list", () => {
    expect(paginationRange(5, 10)).toEqual([1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 10]);
  });
});
