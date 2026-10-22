import { NextResponse } from "next/server";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import {
  getPullRequestDetail,
  PullRequestActionError,
} from "@/services/pullRequestDetailsService";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ repoUuid: string; id: string }> },
) {
  const { repoUuid, id } = await ctx.params;
  const prId = Number(id);
  if (!Number.isInteger(prId)) return badRequest("id inválido");
  try {
    return NextResponse.json(await getPullRequestDetail(decodeURIComponent(repoUuid), prId));
  } catch (err) {
    if (err instanceof PullRequestActionError) {
      return jsonError(err.code, err.message, err.status);
    }
    return internalError(err);
  }
}
