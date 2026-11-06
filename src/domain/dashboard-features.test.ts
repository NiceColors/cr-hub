import { describe, expect, test } from "vitest";
import { dayBuckets, type HistoryRow } from "@/domain/dashboard";
import {
  buildFeatureBoard,
  kindByPullRequest,
  stageAt,
  type FeatureInput,
} from "@/domain/dashboard-features";

const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).getTime();

function row(prKey: string, partial: Partial<HistoryRow> & { createdDay: number }): HistoryRow {
  const { createdDay, ...rest } = partial;
  return {
    prKey,
    repoUuid: "r1",
    authorUuid: "a1",
    createdOn: new Date(at(createdDay)).toISOString(),
    firstSeenAt: at(createdDay),
    firstReviewAt: null,
    approvedAt: null,
    closedAt: null,
    changesCycles: 0,
    ...rest,
  };
}

function feature(
  id: number,
  kind: FeatureInput["kind"],
  keys: string[],
  extra: Partial<FeatureInput> = {},
): FeatureInput {
  return {
    id,
    name: `Projeto ${id}`,
    kind,
    status: "active",
    createdAt: at(1),
    updatedAt: at(1),
    links: keys.map((prKey, i) => ({ prKey, repoSlug: "app", authorName: "Ana", addedAt: at(1) + i })),
    ...extra,
  };
}

describe("stageAt", () => {
  test("usa o estágio mais avançado alcançado até o instante", () => {
    const r = row("a", { createdDay: 20, firstReviewAt: at(21), approvedAt: at(22), closedAt: at(23) });
    expect(stageAt(r, at(20, 13))).toBe("waiting");
    expect(stageAt(r, at(21, 13))).toBe("inReview");
    expect(stageAt(r, at(22, 13))).toBe("approved");
    expect(stageAt(r, at(23, 13))).toBe("closed");
  });
});

describe("kindByPullRequest", () => {
  test("um CR em dois projetos fica com o tipo do vínculo mais recente", () => {
    const kinds = kindByPullRequest([
      feature(1, "feature", ["x"]),
      { ...feature(2, "fix", []), links: [{ prKey: "x", repoSlug: "app", authorName: null, addedAt: at(5) }] },
    ]);
    expect(kinds.get("x")).toBe("fix");
  });
});

describe("buildFeatureBoard", () => {
  const nowMs = at(22, 13);
  const buckets = dayBuckets(at(20), nowMs, 30);
  const rows = [
    row("a", { createdDay: 20, firstReviewAt: at(20, 15), closedAt: at(21), changesCycles: 1 }),
    row("b", { createdDay: 21, firstReviewAt: at(21, 15) }),
    row("c", { createdDay: 20 }),
    row("solto", { createdDay: 21, closedAt: at(22) }),
  ];

  test("resume o andamento dos CRs vinculados", () => {
    const board = buildFeatureBoard([feature(1, "feature", ["a", "b", "c", "sem-historico"])], rows, buckets, {
      scoped: false,
      nowMs,
    });
    expect(board.features[0]).toMatchObject({
      stages: { waiting: 1, inReview: 1, approved: 0, closed: 1, untracked: 1 },
      total: 4,
      closedInWindow: 1,
      cycleMedianHours: 24,
      changesCycles: 1,
      oldestOpenHours: 49,
      repos: ["app"],
      authors: ["Ana"],
    });
  });

  test("separa entregas e fila aberta por tipo, com os CRs sem vínculo à parte", () => {
    const board = buildFeatureBoard([feature(1, "feature", ["a", "b", "c"])], rows, buckets, {
      scoped: false,
      nowMs,
    });
    expect(board.deliveries).toEqual([
      { id: "feature", values: [0, 1, 0] },
      { id: "none", values: [0, 0, 1] },
    ]);
    expect(board.openByKind).toEqual([
      { id: "feature", waiting: 1, inReview: 1, approved: 0, total: 2 },
    ]);
  });

  test("com time, ignora vínculos fora do escopo e esconde projetos sem CRs nele", () => {
    const board = buildFeatureBoard(
      [feature(1, "feature", ["a", "fora"]), feature(2, "fix", ["fora"])],
      rows,
      buckets,
      { scoped: true, nowMs },
    );
    expect(board.features.map((f) => f.id)).toEqual([1]);
    expect(board.features[0]).toMatchObject({ total: 1, stages: { untracked: 0, closed: 1 } });
  });

  test("ativos primeiro, depois quem tem mais CRs abertos", () => {
    const board = buildFeatureBoard(
      [
        feature(1, "feature", ["a"], { status: "done" }),
        feature(2, "fix", ["c"]),
        feature(3, "chore", ["b", "c"]),
      ],
      rows,
      buckets,
      { scoped: false, nowMs },
    );
    expect(board.features.map((f) => f.id)).toEqual([3, 2, 1]);
  });
});
