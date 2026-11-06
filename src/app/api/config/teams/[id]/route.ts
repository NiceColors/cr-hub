import { NextResponse } from "next/server";
import { teamInputSchema as putSchema } from "@/lib/api/team-schema";
import { deleteTeam, updateTeam } from "@/services/configService";

function parseId(idParam: string) {
  const id = Number(idParam);
  if (!Number.isFinite(id)) return null;
  return id;
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await ctx.params;
  const id = parseId(idParam);
  if (!id) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "ID inválido" } },
      { status: 400 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 },
    );
  }

  updateTeam(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await ctx.params;
  const id = parseId(idParam);
  if (!id) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "ID inválido" } },
      { status: 400 },
    );
  }
  deleteTeam(id);
  return NextResponse.json({ ok: true });
}

