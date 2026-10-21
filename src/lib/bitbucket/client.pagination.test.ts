import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { fetchAllPages } from "@/lib/bitbucket/client";

const pageSchema = z.object({
  values: z.array(z.number()),
  next: z.string().url().optional(),
});

describe("fetchAllPages", () => {
  test("segue o campo next até o fim", async () => {
    process.env.BITBUCKET_WORKSPACE = "ws";
    process.env.BITBUCKET_EMAIL = "a@b.com";
    process.env.BITBUCKET_API_TOKEN = "token";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/first")) {
        return new Response(
          JSON.stringify({ values: [1, 2], next: "https://api.bitbucket.org/2.0/second" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/second")) {
        return new Response(JSON.stringify({ values: [3] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const values = await fetchAllPages("/first", pageSchema);
    expect(values).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

