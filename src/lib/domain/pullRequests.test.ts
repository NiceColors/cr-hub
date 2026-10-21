import { describe, expect, test } from "vitest";
import {
  filterPullRequestsBySquad,
  sortOldestFirst,
  summarizeReviewState,
  type PullRequestItem,
  type Squad,
} from "@/lib/domain/pullRequests";

describe("summarizeReviewState", () => {
  test("conta aprovações e detecta changes requested", () => {
    const out = summarizeReviewState([
      { approved: true, state: null },
      { approved: false, state: "changes_requested" },
      { approved: true, state: "APPROVED" },
    ]);
    expect(out.approvals).toBe(2);
    expect(out.changesRequested).toBe(true);
  });
});

describe("filterPullRequestsBySquad", () => {
  const prs: PullRequestItem[] = [
    {
      id: 1,
      title: "A",
      url: "https://example.com/1",
      repoSlug: "repo-a",
      repoName: "Repo A",
      author: { uuid: "{u1}" },
      createdOn: "2024-01-01T00:00:00Z",
      participants: [],
    },
    {
      id: 2,
      title: "B",
      url: "https://example.com/2",
      repoSlug: "repo-b",
      repoName: "Repo B",
      author: { uuid: "{u2}" },
      createdOn: "2024-01-02T00:00:00Z",
      participants: [],
    },
  ];

  test("filtra por membros e por repos quando filtro existe", () => {
    const squad: Squad = {
      id: 10,
      name: "S1",
      memberUuids: ["{u1}"],
      repoFilterSlugs: ["repo-a"],
    };
    const out = filterPullRequestsBySquad(prs, squad);
    expect(out.map((p) => p.id)).toEqual([1]);
  });

  test("se repoFilterSlugs vazio, considera todos os repos monitorados", () => {
    const squad: Squad = {
      id: 10,
      name: "S1",
      memberUuids: ["{u1}", "{u2}"],
      repoFilterSlugs: [],
    };
    const out = filterPullRequestsBySquad(prs, squad);
    expect(out.map((p) => p.id)).toEqual([1, 2]);
  });
});

describe("sortOldestFirst", () => {
  test("ordena por createdOn mais antigo primeiro", () => {
    const prs: PullRequestItem[] = [
      {
        id: 2,
        title: "B",
        url: "https://example.com/2",
        repoSlug: "repo",
        repoName: "Repo",
        author: { uuid: "{u}" },
        createdOn: "2024-01-03T00:00:00Z",
        participants: [],
      },
      {
        id: 1,
        title: "A",
        url: "https://example.com/1",
        repoSlug: "repo",
        repoName: "Repo",
        author: { uuid: "{u}" },
        createdOn: "2024-01-01T00:00:00Z",
        participants: [],
      },
    ];
    expect(sortOldestFirst(prs).map((p) => p.id)).toEqual([1, 2]);
  });
});

