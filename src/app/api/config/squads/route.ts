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
import { inArray } from "drizzle-orm";

const squadInputSchema = z.object({
  name: z.string().min(1),
  memberUuids: z.array(z.string().min(1)).default([]),
  repoFilterSlugs: z.array(z.string().min(1)).default([]),
});

function listSquads() {
  const squadRows = db.select().from(squads).all();
  const ids = squadRows.map((s) => s.id);
  const members = ids.length
    ? db.select().from(squadMembers).where(inArray(squadMembers.squadId, ids)).all()
    : [];
  const repos = ids.length
    ? db
        .select()
        .from(squadRepoFilters)
        .where(inArray(squadRepoFilters.squadId, ids))
        .all()
    : [];

  const membersBySquad = new Map<number, string[]>();
  for (const m of members) {
    const arr = membersBySquad.get(m.squadId) ?? [];
    arr.push(m.userUuid);
    membersBySquad.set(m.squadId, arr);
  }
  const reposBySquad = new Map<number, string[]>();
  for (const r of repos) {
    const arr = reposBySquad.get(r.squadId) ?? [];
    arr.push(r.repoSlug);
    reposBySquad.set(r.squadId, arr);
  }

  return squadRows.map((s) => ({
    id: s.id,
    name: s.name,
    memberUuids: membersBySquad.get(s.id) ?? [],
    repoFilterSlugs: reposBySquad.get(s.id) ?? [],
  }));
}

export async function GET() {
  return NextResponse.json({ squads: listSquads() });
}

export async function POST(req: Request) {
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
    const created = tx.insert(squads).values({ name }).run();
    const squadId = Number(created.lastInsertRowid);

    // garante que os UUIDs/repos existam nas tabelas monitoradas antes de vincular
    if (memberUuids.length) {
      const existingUsers = tx
        .select({ uuid: monitoredUsers.uuid })
        .from(monitoredUsers)
        .where(inArray(monitoredUsers.uuid, memberUuids))
        .all()
        .map((r) => r.uuid);
      tx.insert(squadMembers)
        .values(existingUsers.map((uuid) => ({ squadId, userUuid: uuid })))
        .run();
    }

    if (repoFilterSlugs.length) {
      const existingRepos = tx
        .select({ slug: monitoredRepos.slug })
        .from(monitoredRepos)
        .where(inArray(monitoredRepos.slug, repoFilterSlugs))
        .all()
        .map((r) => r.slug);
      tx.insert(squadRepoFilters)
        .values(existingRepos.map((slug) => ({ squadId, repoSlug: slug })))
        .run();
    }
  });

  return NextResponse.json({ ok: true, squads: listSquads() });
}

