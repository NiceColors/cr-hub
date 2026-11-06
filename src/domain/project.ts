export const PROJECT_KINDS = ["project", "feature", "fix", "chore", "hotfix", "spike"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  project: "Projeto",
  feature: "Feature",
  fix: "Fix",
  chore: "Chore",
  hotfix: "Hotfix",
  spike: "Spike",
};

export const PROJECT_STATUSES = ["active", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Ativo",
  done: "Concluído",
};

const KIND_SET: ReadonlySet<string> = new Set(PROJECT_KINDS);
const STATUS_SET: ReadonlySet<string> = new Set(PROJECT_STATUSES);

export function isProjectKind(value: string): value is ProjectKind {
  return KIND_SET.has(value);
}

export function isProjectStatus(value: string): value is ProjectStatus {
  return STATUS_SET.has(value);
}

export type TextResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function normalizeProjectName(name: string): TextResult<string> {
  const value = name.trim().replace(/\s+/g, " ");
  if (!value) return { ok: false, message: "Informe um nome." };
  if (value.length > 80) return { ok: false, message: "O nome pode ter no máximo 80 caracteres." };
  return { ok: true, value };
}

export function normalizeProjectNotes(notes: string | null | undefined): TextResult<string | null> {
  if (notes == null) return { ok: true, value: null };
  const value = notes.trim();
  if (!value) return { ok: true, value: null };
  if (value.length > 500) return { ok: false, message: "As notas podem ter no máximo 500 caracteres." };
  return { ok: true, value };
}
