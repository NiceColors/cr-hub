import { NextResponse } from "next/server";
import { pauseAllFocusTimers } from "@/services/focusService";

/** Chamado via `sendBeacon` quando a aba é fechada, para o cronômetro não seguir contando. */
export async function POST() {
  pauseAllFocusTimers();
  return NextResponse.json({ ok: true });
}
