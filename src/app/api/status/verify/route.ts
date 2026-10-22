import { NextResponse } from "next/server";
import { buildStatusPayload, verifyToken } from "@/services/tokenService";

export const dynamic = "force-dynamic";

export async function POST() {
  await verifyToken({ force: true });
  return NextResponse.json(buildStatusPayload());
}
