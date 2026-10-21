import { describe, expect, test } from "vitest";
import { buildPullRequestQ } from "@/lib/bitbucket/queries";

describe("buildPullRequestQ", () => {
  test("monta o q com state OPEN e UUIDs", () => {
    const q = buildPullRequestQ(["{u1}", "{u2}"]);
    expect(q).toBe('state="OPEN" AND (author.uuid="{u1}" OR author.uuid="{u2}")');
  });

  test("deduplica UUIDs", () => {
    const q = buildPullRequestQ(["{u1}", "{u1}"]);
    expect(q).toBe('state="OPEN" AND (author.uuid="{u1}")');
  });

  test("encoding do q preserva chaves {} via URLSearchParams", () => {
    const q = buildPullRequestQ(["{abc-123}"]);
    const params = new URLSearchParams({ q });
    const encoded = params.toString();
    expect(encoded).toContain("q=");
    expect(encoded).toContain("%7Babc-123%7D");
  });
});

