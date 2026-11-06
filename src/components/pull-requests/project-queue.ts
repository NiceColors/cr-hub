export const UNLINKED_GROUP = "unlinked";

export type ProjectGroupSource = {
  id: number;
  name: string;
  status: "active" | "done";
  pullRequests: { prKey: string }[];
};

export function projectIdsByKey(projects: readonly ProjectGroupSource[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const project of projects) {
    const id = String(project.id);
    for (const link of project.pullRequests) {
      const current = map.get(link.prKey);
      if (current) {
        if (!current.includes(id)) current.push(id);
      } else {
        map.set(link.prKey, [id]);
      }
    }
  }
  return map;
}

export type GroupedQueueRow<T> = { item: T; groupId: string };

export function groupQueueByProject<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  projects: readonly ProjectGroupSource[],
  idsByKey: ReadonlyMap<string, readonly string[]>,
): GroupedQueueRow<T>[] {
  const buckets = new Map<number, T[]>();
  const unlinked: T[] = [];
  for (const item of items) {
    const ids = idsByKey.get(keyOf(item));
    if (!ids || ids.length === 0) {
      unlinked.push(item);
      continue;
    }
    for (const id of ids) {
      const projectId = Number(id);
      const list = buckets.get(projectId);
      if (list) list.push(item);
      else buckets.set(projectId, [item]);
    }
  }

  const ordered = projects
    .filter((project) => buckets.has(project.id))
    .toSorted((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return a.name.localeCompare(b.name, "pt");
    });

  const rows: GroupedQueueRow<T>[] = [];
  for (const project of ordered) {
    for (const item of buckets.get(project.id) ?? []) {
      rows.push({ item, groupId: `project:${project.id}` });
    }
  }
  for (const item of unlinked) rows.push({ item, groupId: UNLINKED_GROUP });
  return rows;
}

export function projectIdFromGroup(groupId: string): number | null {
  if (!groupId.startsWith("project:")) return null;
  const id = Number(groupId.slice("project:".length));
  return Number.isInteger(id) ? id : null;
}
