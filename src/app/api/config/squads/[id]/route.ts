import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  monitoredRepos,
  monitoredUsers,
  squadMembers,
  squadRepoFilters,
  squads,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

const squadInputSchema = z.object({
  name: z.string().min(1),
  memberUuids: z.array(z.string().min(1)).default([]),
  repoFilterSlugs: z.array(z.string().min(1)).default([]),
});

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
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = squadInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, memberUuids, repoFilterSlugs } = parsed.data;

  db.transaction((tx) => {
    tx.update(squads).set({ name }).where(eq(squads.id, id)).run();

    tx.delete(squadMembers).where(eq(squadMembers.squadId, id)).run();
    if (memberUuids.length) {
      const existingUsers = tx
        .select({ uuid: monitoredUsers.uuid })
        .from(monitoredUsers)
        .where(inArray(monitoredUsers.uuid, memberUuids))
        .all()
        .map((r) => r.uuid);
      tx.insert(squadMembers)
        .values(existingUsers.map((uuid) => ({ squadId: id, userUuid: uuid })))
        .run();
    }

    tx.delete(squadRepoFilters).where(eq(squadRepoFilters.squadId, id)).run();
    if (repoFilterSlugs.length) {
      const existingRepos = tx
        .select({ slug: monitoredRepos.slug })
        .from(monitoredRepos)
        .where(inArray(monitoredRepos.slug, repoFilterSlugs))
        .all()
        .map((r) => r.slug);
      tx.insert(squadRepoFilters)
        .values(existingRepos.map((slug) => ({ squadId: id, repoSlug: slug })))
        .run();
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await ctx.params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  db.delete(squads).where(eq(squads.id, id)).run();
  return NextResponse.json({ ok: true });
}

