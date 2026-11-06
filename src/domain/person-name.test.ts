import { describe, expect, test } from "vitest";
import { shortPersonName } from "@/domain/person-name";

describe("shortPersonName", () => {
  test("keeps a single name", () => {
    expect(shortPersonName("Ana")).toBe("Ana");
  });

  test("abbreviates the last surname and skips particles", () => {
    expect(shortPersonName("Victor Batista do Carmo")).toBe("Victor C.");
    expect(shortPersonName("Maria da Silva")).toBe("Maria S.");
    expect(shortPersonName("Ana Beatriz")).toBe("Ana B.");
  });
});
