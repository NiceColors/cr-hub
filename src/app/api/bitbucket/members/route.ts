import { NextResponse } from "next/server";
import {
  BitbucketHttpError,
  fetchAllPages,
  getWorkspaceFromEnv,
} from "@/lib/bitbucket/client";
import { bitbucketWorkspaceMembersSchema } from "@/lib/bitbucket/schemas";

export async function GET() {
  try {
    const workspace = getWorkspaceFromEnv();
    const params = new URLSearchParams({
      pagelen: "100",
      fields:
        "values.user.uuid,values.user.nickname,values.user.display_name,values.user.links.avatar.href,next",
    });

    const rows = await fetchAllPages(
      `/workspaces/${encodeURIComponent(workspace)}/members?${params.toString()}`,
      bitbucketWorkspaceMembersSchema,
    );

    const members = rows.map((m) => ({
      uuid: m.user.uuid,
      nickname: m.user.nickname ?? null,
      displayName: m.user.display_name ?? null,
      avatarUrl: m.user.links?.avatar?.href ?? null,
    }));

    return NextResponse.json({ forbidden: false, members });
  } catch (err) {
    if (err instanceof BitbucketHttpError && err.status === 403) {
      return NextResponse.json({ forbidden: true, members: [] });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar membros" },
      { status: 500 },
    );
  }
}

