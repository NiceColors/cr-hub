import { describe, expect, test } from "vitest";
import {
  buildOpenPrQuery,
  buildOpenPrQueryBatches,
} from "@/lib/bitbucket/queries";

describe("buildOpenPrQuery", () => {
  test("monta o q com state OPEN e UUIDs", () => {
    const q = buildOpenPrQuery(["{u1}", "{u2}"]);
    expect(q).toBe('state="OPEN" AND (author.uuid="{u1}" OR author.uuid="{u2}")');
  });

  test("deduplica UUIDs", () => {
    const q = buildOpenPrQuery(["{u1}", "{u1}"]);
    expect(q).toBe('state="OPEN" AND (author.uuid="{u1}")');
  });

  test("encoding do q preserva chaves {} via URLSearchParams", () => {
    const q = buildOpenPrQuery(["{abc-123}"]);
    const params = new URLSearchParams({ q });
    const encoded = params.toString();
    expect(encoded).toContain("q=");
    expect(encoded).toContain("%7Babc-123%7D");
  });

  test("inclui o revisor como alternativa ao autor", () => {
    const q = buildOpenPrQuery(["{u1}"], "{me}");
    expect(q).toBe('state="OPEN" AND (author.uuid="{u1}" OR reviewers.uuid="{me}")');
  });

  test("cada lote repete o filtro de revisor", () => {
    const uuids = Array.from({ length: 26 }, (_, i) => `{u${i}}`);
    const batches = buildOpenPrQueryBatches(uuids, 25, "{me}");
    expect(batches.every((q) => q.includes('reviewers.uuid="{me}"'))).toBe(true);
  });

  test("divide em lotes acima de 25", () => {
    const uuids = Array.from({ length: 26 }, (_, i) => `{u${i}}`);
    const batches = buildOpenPrQueryBatches(uuids, 25);
    expect(batches).toHaveLength(2);
  });
});

