import { NextResponse } from "next/server";
import { listRepositoryCatalog } from "@/services/configService";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ repositories: listRepositoryCatalog() });
}

