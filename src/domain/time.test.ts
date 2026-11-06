import { describe, expect, test } from "vitest";
import { formatCompactAge } from "@/domain/time";

const now = new Date("2026-11-06T12:00:00.000Z");

describe("formatCompactAge", () => {
  test("uses the shortest unit that still reads", () => {
    expect(formatCompactAge("2026-11-06T11:59:30.000Z", now)).toBe("agora");
    expect(formatCompactAge("2026-11-06T11:34:00.000Z", now)).toBe("26min");
    expect(formatCompactAge("2026-11-06T09:00:00.000Z", now)).toBe("3h");
    expect(formatCompactAge("2026-11-04T12:00:00.000Z", now)).toBe("2d");
  });
});
