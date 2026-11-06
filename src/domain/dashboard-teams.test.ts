import { describe, expect, test } from "vitest";
import { dayBuckets, type HistoryRow } from "@/domain/dashboard";
import { buildTeamComparison } from "@/domain/dashboard-teams";

const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).getTime();

let nextId = 1;
function row(partial: Partial<HistoryRow> & { createdDay: number }): HistoryRow {
  const { createdDay, ...rest } = partial;
  return {
    prKey: `r1:${nextId++}`,
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

describe("buildTeamComparison", () => {
  test("alinha os times nos mesmos dias e retrata a fila no último", () => {
    const buckets = dayBuckets(at(20), at(22, 13), 30);
    const [alfa, beta] = buildTeamComparison(
      [
        {
          id: 1,
          name: "Alfa",
          members: 3,
          rows: [
            row({ createdDay: 20, firstReviewAt: at(21) }),
            row({ createdDay: 21, closedAt: at(22, 9) }),
          ],
        },
        { id: 2, name: "Beta", members: 1, rows: [] },
      ],
      buckets,
      new Map(),
    );
    expect(alfa).toMatchObject({
      open: [1, 2, 1],
      waiting: [1, 1, 0],
      opened: [1, 1, 0],
      closed: [0, 0, 1],
      now: { total: 1, inReview: 1 },
      stats: { opened: 2, closed: 1 },
    });
    expect(beta).toMatchObject({ open: [0, 0, 0], now: { total: 0 }, stats: { opened: 0 } });
  });

  test("sem dias gravados, séries vazias e retrato zerado", () => {
    const [team] = buildTeamComparison([{ id: 1, name: "Alfa", members: 0, rows: [] }], [], new Map());
    expect(team).toMatchObject({ open: [], now: { total: 0 }, stats: { firstReviewMedianHours: null } });
  });
});
