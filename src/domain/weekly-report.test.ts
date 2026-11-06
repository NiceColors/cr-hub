import { describe, expect, test } from "vitest";
import {
  buildWeeklyReport,
  formatDuration,
  median,
  weekRange,
  weekStartOf,
  type HistoryRow,
} from "@/domain/weekly-report";

const H = 60 * 60 * 1000;
const local = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();

function row(patch: Partial<HistoryRow> & { prId: number }): HistoryRow {
  return {
    repoSlug: "api",
    title: `PR ${patch.prId}`,
    url: `https://bitbucket.org/x/api/pull-requests/${patch.prId}`,
    authorName: "Ana",
    createdOn: new Date(local(2026, 10, 19, 9)).toISOString(),
    firstSeenAt: local(2026, 10, 19, 9),
    firstReviewAt: null,
    closedAt: null,
    lastSeenAt: local(2026, 10, 22, 12),
    changesCycles: 0,
    reviewTrackedFromStart: true,
    ...patch,
  };
}

describe("semana", () => {
  test("começa na segunda local e termina na segunda seguinte", () => {
    expect(weekStartOf(new Date(2026, 9, 22))).toBe("2026-10-19");
    expect(weekStartOf(new Date(2026, 9, 25))).toBe("2026-10-19"); // domingo
    const range = weekRange("2026-10-19");
    expect(range.endIso).toBe("2026-10-25");
    expect(range.endMs - range.startMs).toBe(7 * 24 * H);
  });
});

describe("median / formatDuration", () => {
  test("mediana com quantidade par e ímpar", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  test("formata durações curtas e longas", () => {
    expect(formatDuration(30 * 1000)).toBe("<1min");
    expect(formatDuration(45 * 60 * 1000)).toBe("45min");
    expect(formatDuration(3 * H + 20 * 60 * 1000)).toBe("3h 20min");
    expect(formatDuration(2 * 24 * H + 4 * H)).toBe("2d 4h");
  });
});

describe("buildWeeklyReport", () => {
  const rows = [
    // Revisado 2h depois de aberto; fechado depois de 3 dias, com 2 ciclos.
    row({
      prId: 1,
      firstReviewAt: local(2026, 10, 19, 11),
      closedAt: local(2026, 10, 22, 9),
      changesCycles: 2,
    }),
    // Revisado 6h depois; ainda aberto.
    row({ prId: 2, firstReviewAt: local(2026, 10, 19, 15) }),
    // Já tinha revisão quando o app o viu: fica fora da mediana.
    row({ prId: 3, firstReviewAt: local(2026, 10, 19, 9), reviewTrackedFromStart: false }),
    // De outra semana.
    row({
      prId: 4,
      createdOn: new Date(local(2026, 10, 5, 9)).toISOString(),
      firstSeenAt: local(2026, 10, 5, 9),
      firstReviewAt: local(2026, 10, 6, 9),
      closedAt: local(2026, 10, 7, 9),
      lastSeenAt: local(2026, 10, 7, 9),
      changesCycles: 5,
    }),
  ];

  const { markdown, stats } = buildWeeklyReport({
    rows,
    focus: [
      {
        repoSlug: "api",
        prId: 2,
        title: "PR 2",
        url: "https://x/2",
        timeSpentMs: 40 * 60 * 1000,
        doneAt: local(2026, 10, 20, 10),
      },
    ],
    weekStartIso: "2026-10-19",
    nowMs: local(2026, 10, 22, 12),
  });

  test("calcula os números da semana", () => {
    expect(stats.opened).toBe(3);
    expect(stats.closed).toBe(1);
    expect(stats.openAtEnd).toBe(2);
    expect(stats.firstReviewSample).toBe(2);
    expect(stats.firstReviewMedianMs).toBe(4 * H);
  });

  test("gera Markdown com as seções da retro", () => {
    expect(markdown).toContain("## Retro de code review · 19/10 a 25/10/2026");
    expect(markdown).toContain("Mediana de **4h** em 2 PR(s)");
    expect(markdown).toContain("[api #1](https://bitbucket.org/x/api/pull-requests/1) PR 1 | Ana | 3d | 2 |");
    expect(markdown).toContain("### Mais ciclos de mudança");
    expect(markdown).not.toContain("api #4");
    expect(markdown).toContain("1 revisão(ões), **40min** no total");
  });

  test("escapa barras verticais em títulos", () => {
    const out = buildWeeklyReport({
      rows: [row({ prId: 9, title: "a | b", closedAt: local(2026, 10, 20, 9) })],
      focus: [],
      weekStartIso: "2026-10-19",
      nowMs: local(2026, 10, 22, 12),
    });
    expect(out.markdown).toContain("a \\| b |");
    expect(out.markdown).not.toContain("a \\\\| b");
  });
});
