import { NextResponse } from "next/server";
import { badRequest, jsonError } from "@/lib/api/route-errors";
import { deleteSavedView, updateSavedView } from "@/services/configService";
import { savedViewInputSchema } from "@/lib/api/saved-view-schema";

const patchSchema = savedViewInputSchema.partial();

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return badRequest("id inválido");
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  try {
    updateSavedView(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return jsonError("DUPLICATE_NAME", "Já existe uma visão com esse nome.", 409);
    }
    throw err;
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return badRequest("id inválido");
  deleteSavedView(id);
  return NextResponse.json({ ok: true });
}
