import { db } from "@/lib/db";
import {
  members,
  repositories,
  settings,
  teamMembers,
  teamRepositories,
  teams,
} from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { clearPullRequestsCache } from "@/lib/pullRequestsCache";

export type PollIntervalSeconds = 30 | 60 | 120;

export function getSettings() {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (row) return row;
  db.insert(settings).values({ id: 1, pollIntervalSeconds: 30 }).run();
  return db.select().from(settings).where(eq(settings.id, 1)).get()!;
}

export function setPollIntervalSeconds(pollIntervalSeconds: PollIntervalSeconds) {
  getSettings();
  db.update(settings)
    .set({ pollIntervalSeconds })
    .where(eq(settings.id, 1))
    .run();
  clearPullRequestsCache();
}

export function listRepositories() {
  return db.select().from(repositories).all();
}

export function patchRepository(
  uuid: string,
  patch: { monitored?: boolean; minApprovals?: number },
) {
  const toSet: Partial<typeof repositories.$inferInsert> = {};
  if (typeof patch.monitored === "boolean") toSet.monitored = patch.monitored;
  if (typeof patch.minApprovals === "number") toSet.minApprovals = patch.minApprovals;
  db.update(repositories).set(toSet).where(eq(repositories.uuid, uuid)).run();
  clearPullRequestsCache();
}

export function listMembers() {
  return db.select().from(members).all();
}

export function addManualMember(input: {
  uuid: string;
  nickname?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const displayName =
    input.displayName?.trim() ||
    input.nickname?.trim() ||
    input.uuid.trim();

  db.insert(members)
    .values({
      uuid: input.uuid.trim(),
      nickname: input.nickname ?? null,
      displayName,
      avatarUrl: input.avatarUrl ?? null,
      monitored: true,
      source: "manual",
    })
    .onConflictDoUpdate({
      target: members.uuid,
      set: {
        nickname: input.nickname ?? null,
        displayName,
        avatarUrl: input.avatarUrl ?? null,
        source: "manual",
      },
    })
    .run();

  clearPullRequestsCache();
}

export function patchMember(uuid: string, patch: { monitored?: boolean }) {
  const toSet: Partial<typeof members.$inferInsert> = {};
  if (typeof patch.monitored === "boolean") toSet.monitored = patch.monitored;
  db.update(members).set(toSet).where(eq(members.uuid, uuid)).run();
  clearPullRequestsCache();
}

export function deleteMember(uuid: string) {
  db.delete(members).where(eq(members.uuid, uuid)).run();
  clearPullRequestsCache();
}

export type Team = {
  id: number;
  name: string;
  createdAt: number; // ms
  memberUuids: string[];
  repositoryUuids: string[];
};

export function listTeams(): Team[] {
  const teamRows = db.select().from(teams).all();
  const ids = teamRows.map((t) => t.id);
  const memberRows = ids.length
    ? db.select().from(teamMembers).where(inArray(teamMembers.teamId, ids)).all()
    : [];
  const repoRows = ids.length
    ? db
        .select()
        .from(teamRepositories)
        .where(inArray(teamRepositories.teamId, ids))
        .all()
    : [];

  const membersByTeam = new Map<number, string[]>();
  for (const r of memberRows) {
    const arr = membersByTeam.get(r.teamId) ?? [];
    arr.push(r.memberUuid);
    membersByTeam.set(r.teamId, arr);
  }
  const reposByTeam = new Map<number, string[]>();
  for (const r of repoRows) {
    const arr = reposByTeam.get(r.teamId) ?? [];
    arr.push(r.repositoryUuid);
    reposByTeam.set(r.teamId, arr);
  }

  return teamRows.map((t) => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt.getTime(),
    memberUuids: membersByTeam.get(t.id) ?? [],
    repositoryUuids: reposByTeam.get(t.id) ?? [],
  }));
}

export function createTeam(input: {
  name: string;
  memberUuids: string[];
  repositoryUuids: string[];
}) {
  db.transaction((tx) => {
    const created = tx
      .insert(teams)
      .values({ name: input.name.trim(), createdAt: new Date() })
      .run();
    const teamId = Number(created.lastInsertRowid);

    if (input.memberUuids.length) {
      const existing = tx
        .select({ uuid: members.uuid })
        .from(members)
        .where(inArray(members.uuid, input.memberUuids))
        .all()
        .map((r) => r.uuid);
      tx.insert(teamMembers)
        .values(existing.map((uuid) => ({ teamId, memberUuid: uuid })))
        .run();
    }

    if (input.repositoryUuids.length) {
      const existing = tx
        .select({ uuid: repositories.uuid })
        .from(repositories)
        .where(inArray(repositories.uuid, input.repositoryUuids))
        .all()
        .map((r) => r.uuid);
      tx.insert(teamRepositories)
        .values(existing.map((uuid) => ({ teamId, repositoryUuid: uuid })))
        .run();
    }
  });
}

export function updateTeam(
  id: number,
  input: { name: string; memberUuids: string[]; repositoryUuids: string[] },
) {
  db.transaction((tx) => {
    tx.update(teams).set({ name: input.name.trim() }).where(eq(teams.id, id)).run();

    tx.delete(teamMembers).where(eq(teamMembers.teamId, id)).run();
    if (input.memberUuids.length) {
      const existing = tx
        .select({ uuid: members.uuid })
        .from(members)
        .where(inArray(members.uuid, input.memberUuids))
        .all()
        .map((r) => r.uuid);
      tx.insert(teamMembers)
        .values(existing.map((uuid) => ({ teamId: id, memberUuid: uuid })))
        .run();
    }

    tx.delete(teamRepositories).where(eq(teamRepositories.teamId, id)).run();
    if (input.repositoryUuids.length) {
      const existing = tx
        .select({ uuid: repositories.uuid })
        .from(repositories)
        .where(inArray(repositories.uuid, input.repositoryUuids))
        .all()
        .map((r) => r.uuid);
      tx.insert(teamRepositories)
        .values(existing.map((uuid) => ({ teamId: id, repositoryUuid: uuid })))
        .run();
    }
  });
  clearPullRequestsCache();
}

export function deleteTeam(id: number) {
  db.delete(teams).where(eq(teams.id, id)).run();
  clearPullRequestsCache();
}

export function getTeam(id: number) {
  const teamRow = db.select().from(teams).where(eq(teams.id, id)).get();
  if (!teamRow) return null;
  const memberRows = db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, id))
    .all();
  const repoRows = db
    .select()
    .from(teamRepositories)
    .where(eq(teamRepositories.teamId, id))
    .all();

  return {
    id: teamRow.id,
    name: teamRow.name,
    createdAt: teamRow.createdAt.getTime(),
    memberUuids: memberRows.map((r) => r.memberUuid),
    repositoryUuids: repoRows.map((r) => r.repositoryUuid),
  };
}

export function listMonitoredRepositories() {
  return db.select().from(repositories).where(eq(repositories.monitored, true)).all();
}

export function listMonitoredMembers() {
  return db.select().from(members).where(eq(members.monitored, true)).all();
}

