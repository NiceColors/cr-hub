import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  BitbucketHttpError,
  PULL_REQUEST_READ_SCOPE,
  bitbucketFetchJson,
  fetchAllPages,
} from "@/lib/bitbucket/client";
import { clearBitbucketRateLimit, getRateLimitRemainingSeconds } from "@/lib/bitbucket/rateLimit";

describe("bitbucketFetchJson retry/backoff", () => {
  test("faz retry em 429 respeitando Retry-After", async () => {
    clearBitbucketRateLimit();
    vi.useFakeTimers();
    process.env.BITBUCKET_WORKSPACE = "ws";
    process.env.BITBUCKET_EMAIL = "a@b.com";
    process.env.BITBUCKET_API_TOKEN = "token";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 429,
          headers: { "retry-after": "1", "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock as any);

    const p = bitbucketFetchJson("/x", z.object({ ok: z.boolean() }));
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  test("429 sem Retry-After não insiste e abre uma pausa", async () => {
    clearBitbucketRateLimit();
    process.env.BITBUCKET_WORKSPACE = "ws";
    process.env.BITBUCKET_EMAIL = "a@b.com";
    process.env.BITBUCKET_API_TOKEN = "token";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock as any);

    await expect(bitbucketFetchJson("/x", z.object({ ok: z.boolean() }))).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 60,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRateLimitRemainingSeconds()).toBeGreaterThan(0);
  });

  test("não faz retry em 401", async () => {
    process.env.BITBUCKET_WORKSPACE = "ws";
    process.env.BITBUCKET_EMAIL = "a@b.com";
    process.env.BITBUCKET_API_TOKEN = "token";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock as any);

    await expect(
      bitbucketFetchJson("/x", z.object({ ok: z.boolean() })),
    ).rejects.toBeInstanceOf(BitbucketHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("guarda o escopo exigido quando o Bitbucket responde 403", async () => {
    process.env.BITBUCKET_WORKSPACE = "ws";
    process.env.BITBUCKET_EMAIL = "a@b.com";
    process.env.BITBUCKET_API_TOKEN = "token";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "error",
            error: {
              message: "Your credentials lack one or more required privilege scopes.",
              detail: { required: [PULL_REQUEST_READ_SCOPE], granted: ["read:repository:bitbucket"] },
            },
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(bitbucketFetchJson("/x", z.object({ ok: z.boolean() }))).rejects.toMatchObject({
      status: 403,
      requiredScopes: [PULL_REQUEST_READ_SCOPE],
    });
  });
});

describe("fetchAllPages", () => {
  test("aplica limite de segurança de páginas", async () => {
    process.env.BITBUCKET_WORKSPACE = "ws";
    process.env.BITBUCKET_EMAIL = "a@b.com";
    process.env.BITBUCKET_API_TOKEN = "token";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          values: [1],
          next: "https://api.bitbucket.org/2.0/next",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock as any);

    const pageSchema = z.object({
      values: z.array(z.number()),
      next: z.string().url().optional(),
    });

    await expect(fetchAllPages("/first", pageSchema, { maxPages: 1 })).rejects.toThrow(
      /limite de segurança/i,
    );
  });
});

