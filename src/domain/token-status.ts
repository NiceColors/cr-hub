export type TokenState = "unknown" | "valid" | "invalid" | "rate_limited";

export const TOKEN_VERIFY_TTL_MS = 5 * 60 * 1000;

export function tokenStateFromHttpStatus(
  status: number,
): Exclude<TokenState, "unknown"> | null {
  if (status === 401) return "invalid";
  if (status === 429) return "rate_limited";
  if (status >= 200 && status < 300) return "valid";
  return null;
}

export function isTokenUsable(state: TokenState) {
  return state === "valid" || state === "rate_limited";
}

export function shouldVerifyToken(opts: {
  state: TokenState;
  lastVerifiedAtMs: number | null;
  nowMs: number;
  force: boolean;
  ttlMs?: number;
}) {
  if (!opts.force && opts.state !== "unknown") return false;
  if (opts.lastVerifiedAtMs === null) return true;
  return opts.nowMs - opts.lastVerifiedAtMs >= (opts.ttlMs ?? TOKEN_VERIFY_TTL_MS);
}
