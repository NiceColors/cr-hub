import { NextResponse } from "next/server";
import { requestsCounter } from "@/lib/requestsCounter";

export async function GET() {
  return NextResponse.json({ requestsLastHour: requestsCounter.countLastHour() });
}

