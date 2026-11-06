import { describe, expect, it } from "vitest";
import { isProjectKind, normalizeProjectName, normalizeProjectNotes } from "@/domain/project";

describe("normalizeProjectName", () => {
  it("colapsa espaços nas pontas e no meio", () => {
    expect(normalizeProjectName("  checkout   v2 ")).toEqual({ ok: true, value: "checkout v2" });
  });

  it("recusa nome vazio", () => {
    expect(normalizeProjectName("   ").ok).toBe(false);
  });

  it("recusa nome longo demais", () => {
    expect(normalizeProjectName("a".repeat(81)).ok).toBe(false);
  });
});

describe("normalizeProjectNotes", () => {
  it("trata vazio como ausência de notas", () => {
    expect(normalizeProjectNotes("  ")).toEqual({ ok: true, value: null });
    expect(normalizeProjectNotes(null)).toEqual({ ok: true, value: null });
  });
});

describe("isProjectKind", () => {
  it("aceita os tipos de entrega", () => {
    expect(isProjectKind("feature")).toBe(true);
    expect(isProjectKind("epic")).toBe(false);
  });
});
