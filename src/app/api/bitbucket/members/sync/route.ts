import { NextResponse } from "next/server";
import { syncMembersFromBitbucket } from "@/services/syncService";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const out = await syncMembersFromBitbucket();
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "BITBUCKET_SYNC_FAILED",
          message: err instanceof Error ? err.message : "Erro ao sincronizar membros",
        },
      },
      { status: 500 },
    );
  }
}

