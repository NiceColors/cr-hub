import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { bitbucketFetchJson } from "@/lib/bitbucket/client";
import {
  getTokenStatus,
  recordTokenHttpStatus,
  resetTokenStatus,
  runTokenVerify,
} from "@/lib/tokenStatus";

beforeEach(() => {
  resetTokenStatus();
  process.env.BITBUCKET_WORKSPACE = "ws";
  process.env.BITBUCKET_EMAIL = "a@b.com";
  process.env.BITBUCKET_API_TOKEN = "token";
});

describe("tokenStatus", () => {
  test("começa sem estado conhecido", () => {
    expect(getTokenStatus()).toEqual({ state: "unknown", checkedAtMs: null, error: undefined });
  });

  test("registra o estado e o horário da última verificação", () => {
    recordTokenHttpStatus(401, 1000);
    expect(getTokenStatus()).toMatchObject({ state: "invalid", checkedAtMs: 1000 });
    expect(getTokenStatus().error?.code).toBe("BITBUCKET_AUTH");

    recordTokenHttpStatus(200, 2000);
    expect(getTokenStatus()).toEqual({ state: "valid", checkedAtMs: 2000, error: undefined });
  });

  test("status sem significado para o token é ignorado", () => {
    recordTokenHttpStatus(200, 1000);
    recordTokenHttpStatus(500, 2000);
    expect(getTokenStatus()).toMatchObject({ state: "valid", checkedAtMs: 1000 });
  });

  test("runTokenVerify faz single-flight", async () => {
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      recordTokenHttpStatus(200);
    });
    const [a, b] = await Promise.all([runTokenVerify(fn), runTokenVerify(fn)]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(a.state).toBe("valid");
    expect(b).toEqual(a);
  });

  test("o client notifica cada resposta HTTP ao hook", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const onResponse = vi.fn();
    await bitbucketFetchJson("/x", z.object({ ok: z.boolean() }), { hooks: { onResponse } });
    expect(onResponse).toHaveBeenCalledWith(200);
  });
});
