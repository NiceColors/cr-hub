import { describe, expect, test } from "vitest";
import {
  computeAgeBand,
  computeReviewState,
  countApprovals,
  filterByTeam,
  resolveTeamScope,
} from "@/domain/pull-request";

describe("computeAgeBand", () => {
  test("normal < 24h", () => {
    const now = Date.parse("2026-01-02T00:00:00Z");
    const created = "2026-01-01T01:00:01Z";
    expect(computeAgeBand(created, now)).toBe("normal");
  });

  test("warning em 24h exatas", () => {
    const now = Date.parse("2026-01-02T00:00:00Z");
    const created = "2026-01-01T00:00:00Z";
    expect(computeAgeBand(created, now)).toBe("warning");
  });

  test("critical > 72h", () => {
    const now = Date.parse("2026-01-04T00:00:01Z");
    const created = "2026-01-01T00:00:00Z";
    expect(computeAgeBand(created, now)).toBe("critical");
  });
});

describe("countApprovals / computeReviewState", () => {
  test("não conta aprovação do autor", () => {
    const participants = [
      { userUuid: "{author}", approved: true, state: null },
      { userUuid: "{rev1}", approved: true, state: null },
    ];
    expect(countApprovals(participants, "{author}")).toBe(1);
  });

  test("changes_requested tem prioridade", () => {
    const participants = [
      { userUuid: "{rev1}", approved: true, state: "approved" },
      { userUuid: "{rev2}", approved: false, state: "changes_requested" },
    ];
    const out = computeReviewState(participants, "{author}", 1);
    expect(out.reviewState).toBe("changes_requested");
    expect(out.changesRequested).toBe(true);
  });

  test("approved quando approvals >= minApprovals", () => {
    const participants = [{ userUuid: "{rev1}", approved: true, state: null }];
    const out = computeReviewState(participants, "{author}", 1);
    expect(out.reviewState).toBe("approved");
  });

  test("in_review quando há atividade mas não aprovou o mínimo", () => {
    const participants = [
      { userUuid: "{rev1}", approved: false, state: "commented" },
    ];
    const out = computeReviewState(participants, "{author}", 2);
    expect(out.reviewState).toBe("in_review");
    expect(out.hasReviewActivity).toBe(true);
  });

  test("waiting quando sem atividade", () => {
    const out = computeReviewState([], "{author}", 1);
    expect(out.reviewState).toBe("waiting");
  });
});

describe("resolveTeamScope / filterByTeam", () => {
  test("team sem filtro de repos => todos monitorados", () => {
    const monitored = [{ uuid: "r1" }, { uuid: "r2" }];
    const scope = resolveTeamScope({ repositoryUuids: [] }, monitored);
    expect(scope).toEqual(["r1", "r2"]);
  });

  test("filterByTeam filtra por membros e escopo", () => {
    const prs = [
      {
        id: 1,
        title: "A",
        url: "https://example.com/1",
        repository: { uuid: "r1", slug: "s1", name: "R1" },
        author: { uuid: "u1", displayName: "U1" },
        createdOn: "2026-01-01T00:00:00Z",
        updatedOn: "2026-01-01T00:00:00Z",
        approvals: 0,
        minApprovals: 1,
        changesRequested: false,
        hasReviewActivity: false,
        reviewState: "waiting" as const,
        ageBand: "normal" as const,
      },
      {
        id: 2,
        title: "B",
        url: "https://example.com/2",
        repository: { uuid: "r2", slug: "s2", name: "R2" },
        author: { uuid: "u2", displayName: "U2" },
        createdOn: "2026-01-01T00:00:00Z",
        updatedOn: "2026-01-01T00:00:00Z",
        approvals: 0,
        minApprovals: 1,
        changesRequested: false,
        hasReviewActivity: false,
        reviewState: "waiting" as const,
        ageBand: "normal" as const,
      },
    ];
    const team = { memberUuids: ["u1"], repositoryUuids: ["r1"] };
    const out = filterByTeam(prs, team, [{ uuid: "r1" }, { uuid: "r2" }]);
    expect(out.map((p) => p.id)).toEqual([1]);
  });
});

