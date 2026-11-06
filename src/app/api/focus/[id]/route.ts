import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, jsonError } from "@/lib/api/route-errors";
import {
  completeFocus,
  FocusError,
  pauseFocusTimer,
  removeFocus,
  startFocusTimer,
} from "@/services/focusService";

const patchSchema = z.object({ action: z.enum(["start", "pause", "complete"]) });

const ACTIONS = { start: startFocusTimer, pause: pauseFocusTimer, complete: completeFocus };

async function parseId(ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) ? id : null;
}

function handle(fn: () => void) {
  try {
    fn();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FocusError) return jsonError(err.code, err.message, err.status);
    throw err;
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await parseId(ctx);
  if (id === null) return badRequest("id inválido");
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  return handle(() => ACTIONS[parsed.data.action](id));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await parseId(ctx);
  if (id === null) return badRequest("id inválido");
  return handle(() => removeFocus(id));
}
