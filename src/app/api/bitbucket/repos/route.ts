import { NextResponse } from "next/server";
import { fetchAllPages, getWorkspaceFromEnv } from "@/lib/bitbucket/client";
import { bitbucketWorkspaceRepoListSchema } from "@/lib/bitbucket/schemas";

export async function GET() {
  try {
    const workspace = getWorkspaceFromEnv();
    const params = new URLSearchParams({
      role: "member",
      pagelen: "100",
      fields: "values.slug,values.name,next",
    });
    const repos = await fetchAllPages(
      `/repositories/${encodeURIComponent(workspace)}?${params.toString()}`,
      bitbucketWorkspaceRepoListSchema,
    );

    return NextResponse.json({ repos });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar repositórios" },
      { status: 500 },
    );
  }
}

