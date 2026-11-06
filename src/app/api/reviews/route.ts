import { NextResponse } from "next/server";
import { internalError } from "@/lib/api/route-errors";
import { listReviewSessions } from "@/services/reviewService";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(listReviewSessions());
  } catch (error) {
    return internalError(error);
  }
}
