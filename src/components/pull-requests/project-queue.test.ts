import { describe, expect, test } from "vitest";
import type { FilterQuery } from "@/components/reui/filters/filters-types";
import { UNLINKED_PROJECT, matchesQuery } from "@/components/pull-requests/filter-query";
import { groupQueueByProject, projectIdsByKey } from "@/components/pull-requests/project-queue";
import type { PullRequestItem } from "@/hooks/use-pull-requests";

function pullRequest(id: number): PullRequestItem {
  return {
    id,
    title: `PR ${id}`,
    url: "https://example.com/pr",
    repository: { uuid: "{repo}", slug: "app", name: "App" },
    author: { uuid: "{author}", displayName: "Ana" },
    createdOn: "2026-01-01T00:00:00.000Z",
    updatedOn: "2026-01-01T00:00:00.000Z",
    approvals: 0,
    minApprovals: 1,
    changesRequested: false,
    hasReviewActivity: false,
    reviewState: "waiting",
    ageBand: "normal",
    sla: { warningHours: 24, criticalHours: 72 },
    reviewers: [],
    commentCount: 0,
    taskCount: 0,
    sourceBranch: "feat",
    destinationBranch: "main",
    targetKind: "production",
    jiraKey: null,
    authorMonitored: true,
    snooze: null,
    complexity: null,
  };
}

function query(operator: string, value: string[]): FilterQuery {
  return {
    id: "root",
    type: "group",
    combinator: "and",
    rules: [{ id: "rule", type: "rule", path: ["project"], operator, value }],
  };
}

const projects = [
  {
    id: 2,
    name: "Zebra",
    status: "active" as const,
    pullRequests: [{ prKey: "{repo}:1" }],
  },
  {
    id: 1,
    name: "Alpha",
    status: "done" as const,
    pullRequests: [{ prKey: "{repo}:1" }, { prKey: "{repo}:2" }],
  },
];

describe("vínculo na fila", () => {
  const ids = projectIdsByKey(projects);
  const ctx = { insights: {}, projectIdsByKey: ids };

  test("agrupa ativos antes dos concluídos e deixa os sem vínculo no fim", () => {
    const rows = groupQueueByProject(
      [pullRequest(3), pullRequest(1), pullRequest(2)],
      (pr) => `${pr.repository.uuid}:${pr.id}`,
      projects,
      ids,
    );
    expect(rows.map((row) => `${row.groupId}:${row.item.id}`)).toEqual([
      "project:2:1",
      "project:1:1",
      "project:1:2",
      "unlinked:3",
    ]);
  });

  test("filtra por projeto ou pela ausência de vínculo", () => {
    const linked = pullRequest(1);
    const unlinked = pullRequest(3);
    expect(matchesQuery(linked, query("is_any_of", ["2"]), ctx)).toBe(true);
    expect(matchesQuery(linked, query("is_any_of", [UNLINKED_PROJECT]), ctx)).toBe(false);
    expect(matchesQuery(unlinked, query("is_any_of", [UNLINKED_PROJECT]), ctx)).toBe(true);
    expect(matchesQuery(linked, query("is_none_of", ["2"]), ctx)).toBe(false);
    expect(matchesQuery(unlinked, query("is_none_of", ["2"]), ctx)).toBe(true);
  });
});
