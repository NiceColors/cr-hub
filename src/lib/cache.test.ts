import { describe, expect, test } from "vitest";
import { createTtlCache } from "@/lib/cache";

describe("createTtlCache", () => {
  test("expira após TTL", () => {
    let t = 1000;
    const cache = createTtlCache<number>({ now: () => t });
    cache.set("k", 123, 100);
    expect(cache.get("k")).toBe(123);
    t = 1099;
    expect(cache.get("k")).toBe(123);
    t = 1100;
    expect(cache.get("k")).toBeUndefined();
  });
});

