import { and, desc, eq } from "drizzle-orm";
import {
  isProjectKind,
  isProjectStatus,
  normalizeProjectName,
  normalizeProjectNotes,
  type ProjectKind,
  type ProjectStatus,
} from "@/domain/project";
import { prKey } from "@/domain/pull-request";
import { db } from "@/lib/db";
import { projectPullRequests, projects } from "@/lib/db/schema";

export class ProjectError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProjectError";
  }
}

export type ProjectLink = {
  prKey: string;
  repoUuid: string;
  prId: number;
  title: string;
  url: string;
  repoSlug: string;
  authorName: string | null;
  addedAt: number;
};

export type Project = {
  id: number;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
  pullRequests: ProjectLink[];
};

function failName(result: { ok: false; message: string }): never {
  throw new ProjectError("INVALID_NAME", result.message, 400);
}

function toLink(row: typeof projectPullRequests.$inferSelect): ProjectLink {
  return {
    prKey: row.prKey,
    repoUuid: row.repoUuid,
    prId: row.prId,
    title: row.title,
    url: row.url,
    repoSlug: row.repoSlug,
    authorName: row.authorName,
    addedAt: row.addedAt.getTime(),
  };
}

function toProject(
  row: typeof projects.$inferSelect,
  links: ProjectLink[],
): Project {
  if (!isProjectKind(row.kind) || !isProjectStatus(row.status)) {
    throw new ProjectError("INVALID_ROW", "Projeto salvo com tipo ou status desconhecido.", 500);
  }
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    pullRequests: links,
  };
}

function requireRow(id: number) {
  const row = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!row) throw new ProjectError("NOT_FOUND", "Projeto não encontrado.", 404);
  return row;
}

export function listProjects(): Project[] {
  const rows = db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
  const links = db
    .select()
    .from(projectPullRequests)
    .orderBy(desc(projectPullRequests.addedAt))
    .all();
  const byProject = new Map<number, ProjectLink[]>();
  for (const link of links) {
    const list = byProject.get(link.projectId) ?? [];
    list.push(toLink(link));
    byProject.set(link.projectId, list);
  }
  return rows.map((row) => toProject(row, byProject.get(row.id) ?? []));
}

export function getProject(id: number): Project {
  const row = requireRow(id);
  const links = db
    .select()
    .from(projectPullRequests)
    .where(eq(projectPullRequests.projectId, id))
    .orderBy(desc(projectPullRequests.addedAt))
    .all()
    .map(toLink);
  return toProject(row, links);
}

export function createProject(input: { name: string; kind: ProjectKind; notes?: string | null }) {
  const name = normalizeProjectName(input.name);
  if (!name.ok) failName(name);
  const notes = normalizeProjectNotes(input.notes);
  if (!notes.ok) throw new ProjectError("INVALID_NOTES", notes.message, 400);
  const now = new Date();
  const created = db
    .insert(projects)
    .values({
      name: name.value,
      kind: input.kind,
      status: "active",
      notes: notes.value,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getProject(Number(created.lastInsertRowid));
}

export function updateProject(
  id: number,
  patch: { name?: string; kind?: ProjectKind; status?: ProjectStatus; notes?: string | null },
) {
  const current = requireRow(id);
  let name = current.name;
  if (patch.name !== undefined) {
    const parsed = normalizeProjectName(patch.name);
    if (!parsed.ok) failName(parsed);
    name = parsed.value;
  }
  const notes =
    patch.notes === undefined ? { ok: true as const, value: current.notes } : normalizeProjectNotes(patch.notes);
  if (!notes.ok) throw new ProjectError("INVALID_NOTES", notes.message, 400);
  db.update(projects)
    .set({
      name,
      kind: patch.kind ?? current.kind,
      status: patch.status ?? current.status,
      notes: notes.value,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .run();
  return getProject(id);
}

export function deleteProject(id: number) {
  requireRow(id);
  db.delete(projectPullRequests).where(eq(projectPullRequests.projectId, id)).run();
  db.delete(projects).where(eq(projects.id, id)).run();
}

export type LinkInput = {
  repoUuid: string;
  prId: number;
  title: string;
  url: string;
  repoSlug: string;
  authorName?: string | null;
};

export function linkPullRequest(projectId: number, input: LinkInput) {
  requireRow(projectId);
  const key = prKey(input.repoUuid, input.prId);
  const now = new Date();
  const existing = db
    .select()
    .from(projectPullRequests)
    .where(and(eq(projectPullRequests.projectId, projectId), eq(projectPullRequests.prKey, key)))
    .get();
  const snapshot = {
    title: input.title,
    url: input.url,
    repoSlug: input.repoSlug,
    authorName: input.authorName ?? null,
  };
  if (existing) {
    db.update(projectPullRequests)
      .set(snapshot)
      .where(and(eq(projectPullRequests.projectId, projectId), eq(projectPullRequests.prKey, key)))
      .run();
  } else {
    db.insert(projectPullRequests)
      .values({
        projectId,
        prKey: key,
        repoUuid: input.repoUuid,
        prId: input.prId,
        ...snapshot,
        addedAt: now,
      })
      .run();
  }
  db.update(projects).set({ updatedAt: now }).where(eq(projects.id, projectId)).run();
}

export function unlinkPullRequest(projectId: number, key: string) {
  requireRow(projectId);
  db.delete(projectPullRequests)
    .where(and(eq(projectPullRequests.projectId, projectId), eq(projectPullRequests.prKey, key)))
    .run();
  db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId)).run();
}
