import { BitbucketHttpError } from "@/lib/bitbucket/client";
import { requestsCounter } from "@/lib/requestsCounter";
import { getRateLimitRemainingSeconds } from "@/lib/pullRequestsCache";
import {
  getLastTokenVerifyAtMs,
  getTokenStatus,
  recordTokenCheckFailure,
  runTokenVerify,
} from "@/lib/tokenStatus";
import { isTokenUsable, shouldVerifyToken } from "@/domain/token-status";
import { bitbucketClient } from "@/services/bitbucketClient";

export async function verifyToken(opts: { force: boolean }) {
  const nowMs = Date.now();
  const current = getTokenStatus();
  if (
    !shouldVerifyToken({
      state: current.state,
      lastVerifiedAtMs: getLastTokenVerifyAtMs(),
      nowMs,
      force: opts.force,
    })
  ) {
    return current;
  }

  return runTokenVerify(async () => {
    try {
      await bitbucketClient.getCurrentUser();
    } catch (err) {
      // Respostas HTTP já atualizam o estado pelo hook do client.
      if (err instanceof BitbucketHttpError) return;
      recordTokenCheckFailure({
        code: "STATUS_FAILED",
        message: err instanceof Error ? err.message : "Erro ao validar token",
      });
    }
  }, nowMs);
}

export async function getStatus() {
  if (getTokenStatus().state === "unknown") await verifyToken({ force: false });
  return buildStatusPayload();
}

export function buildStatusPayload() {
  const token = getTokenStatus();
  const retryAfterSeconds = getRateLimitRemainingSeconds();
  return {
    tokenState: token.state,
    tokenValid: isTokenUsable(token.state),
    checkedAt: token.checkedAtMs ? new Date(token.checkedAtMs).toISOString() : null,
    requestsLastHour: requestsCounter.countLastHour(),
    retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
    error: token.error,
  };
}
