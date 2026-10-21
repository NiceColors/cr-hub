import { NextResponse } from "next/server";
import { BitbucketHttpError } from "@/lib/bitbucket/client";
import { bitbucketClient } from "@/services/bitbucketClient";
import { requestsCounter } from "@/lib/requestsCounter";
import { getRateLimitRemainingSeconds } from "@/lib/pullRequestsCache";

export const dynamic = "force-dynamic";

export async function GET() {
  const retryAfterSeconds = getRateLimitRemainingSeconds();

  try {
    await bitbucketClient.getCurrentUser();
    return NextResponse.json({
      tokenValid: true,
      requestsLastHour: requestsCounter.countLastHour(),
      retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
    });
  } catch (err) {
    if (err instanceof BitbucketHttpError && (err.status === 401 || err.status === 403)) {
      return NextResponse.json({
        tokenValid: false,
        requestsLastHour: requestsCounter.countLastHour(),
        retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
        error: { code: "BITBUCKET_AUTH", message: err.message },
      });
    }
    return NextResponse.json(
      {
        tokenValid: false,
        requestsLastHour: requestsCounter.countLastHour(),
        retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
        error: {
          code: "STATUS_FAILED",
          message: err instanceof Error ? err.message : "Erro ao validar token",
        },
      },
      { status: 500 },
    );
  }
}

