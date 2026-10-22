import { NextResponse } from "next/server";
import { internalError } from "@/lib/api/route-errors";
import { getMe } from "@/services/meService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMe());
  } catch (err) {
    return internalError(err);
  }
}
