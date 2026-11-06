import { db } from "@/lib/db";
import {
  members,
  prHistory,
  repositories,
  savedViews,
  settings,
  teamMembers,
  teamRepositories,
  teamRotations,
  teams,
} from "@/lib/db/schema";
import type { Rotation } from "@/domain/rotation";
import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { clearPullRequestsCache } from "@/lib/pullRequestsCache";

export type PollIntervalSeconds = 30 | 60 | 120;

export function getSettings() {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (row) return row;
  db.insert(settings).values({ id: 1, pollIntervalSeconds: 60 }).run();
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

export function setJiraSettings(input: { baseUrl: string | null; projectKeys: string | null }) {
  getSettings();
  db.update(settings)
    .set({ jiraBaseUrl: input.baseUrl, jiraProjectKeys: input.projectKeys })
    .where(eq(settings.id, 1))
    .run();
  clearPullRequestsCache();
}

export function listRepositories() {
  return db.select().from(repositories).all();
}

export type RepositoryTeamRef = { id: number; name: string };

export type RepositoryCatalogItem = {
  uuid: string;
  slug: string;
  name: string;
  monitored: boolean;
  minApprovals: number;
  slaWarningHours: number | null;
  slaCriticalHours: number | null;
  syncedAt: number | null;
  description: string | null;
  language: string | null;
  isPrivate: boolean | null;
  mainBranch: string | null;
  projectKey: string | null;
  projectName: string | null;
  htmlUrl: string | null;
  updatedOn: string | null;
  openPullRequests: number;
  teams: RepositoryTeamRef[];
};

export function listRepositoryCatalog(): RepositoryCatalogItem[] {
  const rows = listRepositories();
  const openCounts = db
    .select({
      repoUuid: prHistory.repoUuid,
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(prHistory)
    .where(isNull(prHistory.closedAt))
    .groupBy(prHistory.repoUuid)
    .all();
  const openByRepo = new Map(openCounts.map((row) => [row.repoUuid, row.total]));

  const links = db
    .select({
      repositoryUuid: teamRepositories.repositoryUuid,
      id: teams.id,
      name: teams.name,
    })
    .from(teamRepositories)
    .innerJoin(teams, eq(teams.id, teamRepositories.teamId))
    .all();
  const teamsByRepo = new Map<string, RepositoryTeamRef[]>();
  for (const link of links) {
    const list = teamsByRepo.get(link.repositoryUuid) ?? [];
    list.push({ id: link.id, name: link.name });
    teamsByRepo.set(link.repositoryUuid, list);
  }

  return rows.map((row) => ({
    uuid: row.uuid,
    slug: row.slug,
    name: row.name,
    monitored: row.monitored,
    minApprovals: row.minApprovals,
    slaWarningHours: row.slaWarningHours,
    slaCriticalHours: row.slaCriticalHours,
    syncedAt: row.syncedAt ? row.syncedAt.getTime() : null,
    description: row.description,
    language: row.language,
    isPrivate: row.isPrivate,
    mainBranch: row.mainBranch,
    projectKey: row.projectKey,
    projectName: row.projectName,
    htmlUrl: row.htmlUrl,
    updatedOn: row.updatedOn,
    openPullRequests: openByRepo.get(row.uuid) ?? 0,
    teams: (teamsByRepo.get(row.uuid) ?? []).toSorted((a, b) =>
      a.name.localeCompare(b.name, "pt"),
    ),
  }));
}

export function getRepository(uuid: string) {
  return db.select().from(repositories).where(eq(repositories.uuid, uuid)).get() ?? null;
}

export type RepositoryPatch = {
  monitored?: boolean;
  minApprovals?: number;
  slaWarningHours?: number | null;
  slaCriticalHours?: number | null;
};

export function patchRepository(uuid: string, patch: RepositoryPatch) {
  const toSet: Partial<typeof repositories.$inferInsert> = {};
  if (typeof patch.monitored === "boolean") toSet.monitored = patch.monitored;
  if (typeof patch.minApprovals === "number") toSet.minApprovals = patch.minApprovals;
  if (patch.slaWarningHours !== undefined) toSet.slaWarningHours = patch.slaWarningHours;
  if (patch.slaCriticalHours !== undefined) toSet.slaCriticalHours = patch.slaCriticalHours;
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
  rotation: Rotation | null;
};

export type TeamInput = {
  name: string;
  memberUuids: string[];
  repositoryUuids: string[];
  rotation?: Rotation | null;
};

function parseRotation(row: typeof teamRotations.$inferSelect | undefined): Rotation | null {
  if (!row) return null;
  try {
    const memberUuids = JSON.parse(row.memberUuids);
    return Array.isArray(memberUuids)
      ? { memberUuids: memberUuids.filter((u) => typeof u === "string"), startDate: row.startDate }
      : null;
  } catch {
    return null;
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A escala só pode ter membros do time; `undefined` mantém a atual. */
function writeRotation(tx: Tx, teamId: number, rotation: Rotation | null | undefined, members: string[]) {
  if (rotation === undefined) return;
  tx.delete(teamRotations).where(eq(teamRotations.teamId, teamId)).run();
  if (!rotation) return;
  const allowed = new Set(members);
  const order = [...new Set(rotation.memberUuids)].filter((uuid) => allowed.has(uuid));
  if (order.length === 0) return;
  tx.insert(teamRotations)
    .values({ teamId, memberUuids: JSON.stringify(order), startDate: rotation.startDate })
    .run();
}

export function listTeams(): Team[] {
  const teamRows = db.select().from(teams).all();
  const ids = teamRows.map((t) => t.id);
  const rotationRows = ids.length
    ? db.select().from(teamRotations).where(inArray(teamRotations.teamId, ids)).all()
    : [];
  const rotationByTeam = new Map(rotationRows.map((r) => [r.teamId, r]));
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
    rotation: parseRotation(rotationByTeam.get(t.id)),
  }));
}

export function createTeam(input: TeamInput) {
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

    writeRotation(tx, teamId, input.rotation, input.memberUuids);
  });
}

export function updateTeam(id: number, input: TeamInput) {
  db.transaction((tx) => {
    tx.update(teams).set({ name: input.name.trim() }).where(eq(teams.id, id)).run();

    tx.delete(teamMembers).where(eq(teamMembers.teamId, id)).run();
    let memberUuids: string[] = [];
    if (input.memberUuids.length) {
      memberUuids = tx
        .select({ uuid: members.uuid })
        .from(members)
        .where(inArray(members.uuid, input.memberUuids))
        .all()
        .map((r) => r.uuid);
      tx.insert(teamMembers)
        .values(memberUuids.map((uuid) => ({ teamId: id, memberUuid: uuid })))
        .run();
    }
    if (input.rotation === undefined) {
      // Sem escala no payload: mantém a atual, sem membros que saíram do time.
      const current = parseRotation(
        tx.select().from(teamRotations).where(eq(teamRotations.teamId, id)).get(),
      );
      writeRotation(tx, id, current, memberUuids);
    } else {
      writeRotation(tx, id, input.rotation, memberUuids);
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
  const rotationRow = db.select().from(teamRotations).where(eq(teamRotations.teamId, id)).get();

  return {
    id: teamRow.id,
    name: teamRow.name,
    createdAt: teamRow.createdAt.getTime(),
    memberUuids: memberRows.map((r) => r.memberUuid),
    repositoryUuids: repoRows.map((r) => r.repositoryUuid),
    rotation: parseRotation(rotationRow),
  };
}

export type SavedViewTab = "all" | "mine" | "authored";

export type SavedView = {
  id: number;
  name: string;
  tab: SavedViewTab;
  teamId: number | null;
  filterQuery: unknown;
  showSnoozed: boolean;
  createdAt: number;
};

export type SavedViewInput = Omit<SavedView, "id" | "createdAt">;

function toSavedView(row: typeof savedViews.$inferSelect): SavedView {
  let filterQuery: unknown = null;
  try {
    filterQuery = JSON.parse(row.filterQuery);
  } catch {
    filterQuery = null;
  }
  return {
    id: row.id,
    name: row.name,
    tab: row.tab as SavedViewTab,
    teamId: row.teamId,
    filterQuery,
    showSnoozed: row.showSnoozed,
    createdAt: row.createdAt.getTime(),
  };
}

export function listSavedViews(): SavedView[] {
  return db.select().from(savedViews).orderBy(asc(savedViews.name)).all().map(toSavedView);
}

export function createSavedView(input: SavedViewInput) {
  const created = db
    .insert(savedViews)
    .values({
      name: input.name.trim(),
      tab: input.tab,
      teamId: input.teamId,
      filterQuery: JSON.stringify(input.filterQuery ?? null),
      showSnoozed: input.showSnoozed,
      createdAt: new Date(),
    })
    .run();
  return Number(created.lastInsertRowid);
}

export function updateSavedView(id: number, input: Partial<SavedViewInput>) {
  const toSet: Partial<typeof savedViews.$inferInsert> = {};
  if (input.name !== undefined) toSet.name = input.name.trim();
  if (input.tab !== undefined) toSet.tab = input.tab;
  if (input.teamId !== undefined) toSet.teamId = input.teamId;
  if (input.filterQuery !== undefined) toSet.filterQuery = JSON.stringify(input.filterQuery);
  if (input.showSnoozed !== undefined) toSet.showSnoozed = input.showSnoozed;
  db.update(savedViews).set(toSet).where(eq(savedViews.id, id)).run();
}

export function deleteSavedView(id: number) {
  db.delete(savedViews).where(eq(savedViews.id, id)).run();
}

export function listMonitoredRepositories() {
  return db.select().from(repositories).where(eq(repositories.monitored, true)).all();
}

export function listMonitoredMembers() {
  return db.select().from(members).where(eq(members.monitored, true)).all();
}

