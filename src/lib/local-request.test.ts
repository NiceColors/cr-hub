import { afterEach, describe, expect, test, vi } from "vitest";
import { isLocalRequest } from "@/lib/local-request";

function req(headers: Record<string, string>) {
  return new Request("http://localhost:43123/api/config/credentials", { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isLocalRequest", () => {
  test("aceita hosts de loopback", () => {
    expect(isLocalRequest(req({ host: "localhost:43123" }))).toBe(true);
    expect(isLocalRequest(req({ host: "127.0.0.1:43123" }))).toBe(true);
    expect(isLocalRequest(req({ host: "[::1]:43123" }))).toBe(true);
  });

  test("recusa acesso pela rede e DNS rebinding", () => {
    expect(isLocalRequest(req({ host: "192.168.0.10:43123" }))).toBe(false);
    expect(isLocalRequest(req({ host: "localhost.evil.com:43123" }))).toBe(false);
    expect(isLocalRequest(req({}))).toBe(false);
  });

  test("recusa Origin de outro site", () => {
    expect(
      isLocalRequest(req({ host: "localhost:43123", origin: "http://localhost:43123" })),
    ).toBe(true);
    expect(
      isLocalRequest(req({ host: "localhost:43123", origin: "https://evil.com" })),
    ).toBe(false);
    expect(isLocalRequest(req({ host: "localhost:43123", origin: "null" }))).toBe(false);
  });

  test("nunca é local na Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    expect(isLocalRequest(req({ host: "localhost:43123" }))).toBe(false);
  });
});
