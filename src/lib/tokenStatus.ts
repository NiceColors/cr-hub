import { tokenStateFromHttpStatus, type TokenState } from "@/domain/token-status";

export type TokenStatusError = { code: string; message: string };

export type TokenStatusSnapshot = {
  state: TokenState;
  checkedAtMs: number | null;
  error?: TokenStatusError;
};

type TokenStatusStore = TokenStatusSnapshot & {
  lastVerifiedAtMs: number | null;
  verifyInFlight: Promise<TokenStatusSnapshot> | null;
};

declare global {
  var __crTrackerTokenStatus: TokenStatusStore | undefined;
}

function emptyStore(): TokenStatusStore {
  return { state: "unknown", checkedAtMs: null, lastVerifiedAtMs: null, verifyInFlight: null };
}

const store = globalThis.__crTrackerTokenStatus ?? emptyStore();
globalThis.__crTrackerTokenStatus = store;

const INVALID_TOKEN_ERROR: TokenStatusError = {
  code: "BITBUCKET_AUTH",
  message:
    "O Bitbucket recusou o token (401). Verifique BITBUCKET_EMAIL e BITBUCKET_API_TOKEN.",
};

export function recordTokenHttpStatus(status: number, nowMs = Date.now()) {
  const state = tokenStateFromHttpStatus(status);
  if (!state) return;
  store.state = state;
  store.checkedAtMs = nowMs;
  store.error = state === "invalid" ? INVALID_TOKEN_ERROR : undefined;
}

export function recordTokenCheckFailure(error: TokenStatusError, nowMs = Date.now()) {
  store.checkedAtMs = nowMs;
  store.error = error;
}

export function getTokenStatus(): TokenStatusSnapshot {
  return { state: store.state, checkedAtMs: store.checkedAtMs, error: store.error };
}

export function getLastTokenVerifyAtMs() {
  return store.lastVerifiedAtMs;
}

export function runTokenVerify(
  fn: () => Promise<void>,
  nowMs = Date.now(),
): Promise<TokenStatusSnapshot> {
  if (store.verifyInFlight) return store.verifyInFlight;
  store.lastVerifiedAtMs = nowMs;
  const p = fn()
    .then(() => getTokenStatus())
    .finally(() => {
      store.verifyInFlight = null;
    });
  store.verifyInFlight = p;
  return p;
}

export function resetTokenStatus() {
  Object.assign(store, emptyStore(), { error: undefined });
}
