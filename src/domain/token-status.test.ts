import { describe, expect, test } from "vitest";
import {
  TOKEN_VERIFY_TTL_MS,
  isTokenUsable,
  shouldVerifyToken,
  tokenStateFromHttpStatus,
} from "@/domain/token-status";

describe("tokenStateFromHttpStatus", () => {
  test("401 marca token inválido", () => {
    expect(tokenStateFromHttpStatus(401)).toBe("invalid");
  });

  test("429 marca rate limit ativo", () => {
    expect(tokenStateFromHttpStatus(429)).toBe("rate_limited");
  });

  test("qualquer 2xx marca token válido", () => {
    expect(tokenStateFromHttpStatus(200)).toBe("valid");
    expect(tokenStateFromHttpStatus(204)).toBe("valid");
    expect(tokenStateFromHttpStatus(299)).toBe("valid");
  });

  test("demais status não alteram o estado", () => {
    expect(tokenStateFromHttpStatus(403)).toBeNull();
    expect(tokenStateFromHttpStatus(404)).toBeNull();
    expect(tokenStateFromHttpStatus(500)).toBeNull();
    expect(tokenStateFromHttpStatus(302)).toBeNull();
  });
});

describe("isTokenUsable", () => {
  test("token com rate limit continua utilizável", () => {
    expect(isTokenUsable("valid")).toBe(true);
    expect(isTokenUsable("rate_limited")).toBe(true);
    expect(isTokenUsable("invalid")).toBe(false);
    expect(isTokenUsable("unknown")).toBe(false);
  });
});

describe("shouldVerifyToken", () => {
  const nowMs = 10_000_000;

  test("verifica na primeira carga, sem estado conhecido", () => {
    expect(
      shouldVerifyToken({ state: "unknown", lastVerifiedAtMs: null, nowMs, force: false }),
    ).toBe(true);
  });

  test("não verifica sozinho quando já existe estado", () => {
    expect(
      shouldVerifyToken({ state: "valid", lastVerifiedAtMs: null, nowMs, force: false }),
    ).toBe(false);
    expect(
      shouldVerifyToken({ state: "invalid", lastVerifiedAtMs: null, nowMs, force: false }),
    ).toBe(false);
  });

  test("teste manual respeita o cache de 5 minutos", () => {
    const recent = nowMs - TOKEN_VERIFY_TTL_MS + 1;
    const expired = nowMs - TOKEN_VERIFY_TTL_MS;
    expect(
      shouldVerifyToken({ state: "valid", lastVerifiedAtMs: recent, nowMs, force: true }),
    ).toBe(false);
    expect(
      shouldVerifyToken({ state: "valid", lastVerifiedAtMs: expired, nowMs, force: true }),
    ).toBe(true);
  });

  test("falha anterior sem estado não repete a verificação dentro do cache", () => {
    expect(
      shouldVerifyToken({
        state: "unknown",
        lastVerifiedAtMs: nowMs - 1000,
        nowMs,
        force: false,
      }),
    ).toBe(false);
  });
});
