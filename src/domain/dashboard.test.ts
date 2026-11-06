import { describe, expect, test } from "vitest";
import {
  activityCounts,
  buildDashboard,
  dayBuckets,
  firstReviewOverall,
  firstReviewSeries,
  hasObservedFirstReview,
  heatCalendarGrid,
  percentile,
  periodComparison,
  queueSeries,
  repositorySeries,
  reviewRanking,
  throughputSeries,
  windowStats,
  type HistoryRow,
} from "@/domain/dashboard";
import type { Reviewer } from "@/domain/pull-request";

const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).getTime();
const iso = (day: number, hour = 12) => new Date(at(day, hour)).toISOString();

let nextId = 1;
function row(partial: Partial<HistoryRow> & { createdDay: number }): HistoryRow {
  const { createdDay, ...rest } = partial;
  return {
    prKey: `r1:${nextId++}`,
    repoUuid: "r1",
    authorUuid: "a1",
    createdOn: iso(createdDay),
    firstSeenAt: at(createdDay),
    firstReviewAt: null,
    approvedAt: null,
    closedAt: null,
    changesCycles: 0,
    ...rest,
  };
}

describe("dayBuckets", () => {
  test("começa no dia da primeira gravação e termina hoje, com corte em agora", () => {
    const buckets = dayBuckets(at(20, 9), at(22, 13), 30);
    expect(buckets.map((b) => b.day)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(buckets.at(-1)!.cutoffMs).toBe(at(22, 13));
    expect(buckets[0]!.cutoffMs).toBe(new Date(2026, 9, 21).getTime() - 1);
  });

  test("respeita o limite de dias", () => {
    expect(dayBuckets(at(1), at(22), 7).map((b) => b.day)[0]).toBe("2026-10-16");
  });

  test("sem histórico não há dias", () => {
    expect(dayBuckets(null, at(22), 30)).toEqual([]);
  });
});

describe("queueSeries", () => {
  test("classifica estado e idade no fim de cada dia", () => {
    const rows = [
      row({ createdDay: 20, firstReviewAt: at(21, 10) }),
      row({ createdDay: 20, firstReviewAt: at(20, 14), approvedAt: at(21, 9), closedAt: at(22, 8) }),
      row({ createdDay: 22 }),
    ];
    const buckets = dayBuckets(at(20), at(22, 13), 30);
    const [d20, d21, d22] = queueSeries(rows, buckets, new Map());
    expect(d20).toMatchObject({ total: 2, waiting: 1, inReview: 1, approved: 0, normal: 2 });
    expect(d21).toMatchObject({ total: 2, waiting: 0, inReview: 1, approved: 1, warning: 2 });
    expect(d22).toMatchObject({ total: 2, inReview: 1, waiting: 1, normal: 1, warning: 1 });
  });

  test("usa o SLA do repositório", () => {
    const rows = [row({ createdDay: 21, repoUuid: "rapido" })];
    const buckets = dayBuckets(at(22), at(22, 13), 30);
    const [point] = queueSeries(
      rows,
      buckets,
      new Map([["rapido", { warningHours: 4, criticalHours: 12 }]]),
    );
    expect(point).toMatchObject({ critical: 1 });
  });
});

describe("repositorySeries", () => {
  test("agrupa o que passa do limite em Outros", () => {
    const rows = ["a", "a", "b", "c"].map((repoUuid) => row({ createdDay: 22, repoUuid }));
    const buckets = dayBuckets(at(22), at(22, 13), 30);
    const series = repositorySeries(rows, buckets, new Map([["a", "api"]]), 1);
    expect(series).toEqual([
      { id: "a", name: "api", values: [2] },
      { id: "outros", name: "Outros", values: [2] },
    ]);
  });
});

describe("primeira revisão", () => {
  test("só conta revisões vistas acontecendo", () => {
    expect(hasObservedFirstReview(row({ createdDay: 20, firstReviewAt: at(20) }))).toBe(false);
    expect(hasObservedFirstReview(row({ createdDay: 20, firstReviewAt: at(20, 15) }))).toBe(true);
  });

  test("mediana e p75 em horas por dia da revisão", () => {
    const rows = [1, 2, 3, 4].map((h) =>
      row({ createdDay: 22, createdOn: iso(22, 8), firstSeenAt: at(22, 8), firstReviewAt: at(22, 8 + h) }),
    );
    const buckets = dayBuckets(at(22), at(22, 23), 30);
    const [point] = firstReviewSeries(rows, buckets);
    expect(point).toEqual({ day: "2026-10-22", reviewed: 4, medianHours: 2.5, p75Hours: 3.25 });
    expect(firstReviewOverall(rows, buckets)).toEqual({
      reviewed: 4,
      medianHours: 2.5,
      p75Hours: 3.25,
    });
  });

  test("o geral ignora revisões fora da janela", () => {
    const rows = [
      row({ createdDay: 1, firstReviewAt: at(1, 14) }),
      row({ createdDay: 22, createdOn: iso(22, 8), firstSeenAt: at(22, 8), firstReviewAt: at(22, 10) }),
    ];
    const overall = firstReviewOverall(rows, dayBuckets(at(20), at(22, 23), 30));
    expect(overall).toEqual({ reviewed: 1, medianHours: 2, p75Hours: 2 });
  });

  test("percentile de lista vazia é null", () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  test("activityCounts agrupa por dia local", () => {
    const rows = [
      row({ createdDay: 20, firstReviewAt: at(21, 9) }),
      row({ createdDay: 20, firstReviewAt: at(21, 18) }),
      row({ createdDay: 20, firstReviewAt: at(20) }),
    ];
    expect(activityCounts(rows)).toEqual({ "2026-10-21": 2 });
  });
});

describe("throughputSeries", () => {
  test("conta abertos pela criação e concluídos pelo fechamento", () => {
    const rows = [row({ createdDay: 21, closedAt: at(22, 9) }), row({ createdDay: 22 })];
    const series = throughputSeries(rows, dayBuckets(at(21), at(22, 13), 30));
    expect(series).toEqual([
      { day: "2026-10-21", opened: 1, closed: 0 },
      { day: "2026-10-22", opened: 1, closed: 1 },
    ]);
  });
});

describe("buildDashboard", () => {
  test("sem linhas devolve séries vazias", () => {
    const data = buildDashboard([], {
      nowMs: at(22),
      windowDays: 30,
      slaByRepo: new Map(),
      repoNames: new Map(),
    });
    expect(data.days).toEqual([]);
    expect(data.queue).toEqual([]);
    expect(data.activity).toEqual({ today: "2026-10-22", counts: {} });
    expect(data.period).toEqual({
      current: { opened: 0, closed: 0, firstReviewMedianHours: null, cycleMedianHours: null },
      previous: null,
    });
  });
});

describe("windowStats", () => {
  test("conta aberturas e conclusões e tira as medianas dentro da janela", () => {
    const rows = [
      row({ createdDay: 20, firstSeenAt: at(20, 8), firstReviewAt: at(20, 14), closedAt: at(21, 12) }),
      row({ createdDay: 21, firstSeenAt: at(21, 8), firstReviewAt: at(21, 16), closedAt: at(22, 12) }),
      row({ createdDay: 10, closedAt: at(11) }),
    ];
    expect(windowStats(rows, at(20, 0), at(22, 23))).toEqual({
      opened: 2,
      closed: 2,
      firstReviewMedianHours: 3,
      cycleMedianHours: 24,
    });
  });
});

describe("periodComparison", () => {
  test("compara com a janela anterior de mesmo tamanho quando a gravação a cobre", () => {
    // Janela atual: 16 a 22/10. Anterior: 9 a 15/10.
    const rows = [
      row({ createdDay: 8, closedAt: at(12) }),
      row({ createdDay: 10, closedAt: at(17) }),
      row({ createdDay: 19, closedAt: at(21) }),
      row({ createdDay: 21 }),
    ];
    const buckets = dayBuckets(at(8), at(22, 13), 7);
    const { current, previous } = periodComparison(rows, buckets, at(8));
    expect(current).toMatchObject({ opened: 2, closed: 2 });
    expect(previous).toMatchObject({ opened: 1, closed: 1 });
  });

  test("sem a janela anterior inteira gravada não há comparação", () => {
    const rows = [row({ createdDay: 20 })];
    const buckets = dayBuckets(at(20), at(22, 13), 7);
    expect(periodComparison(rows, buckets, at(20)).previous).toBeNull();
  });
});

describe("heatCalendarGrid", () => {
  test("alinha semanas começando na segunda e normaliza pelo maior dia", () => {
    // 2026-10-22 é quinta: a última coluna vai de 19/10 (segunda) a 25/10.
    const grid = heatCalendarGrid({ "2026-10-19": 2, "2026-10-22": 4, "2026-10-25": 9 }, "2026-10-22", 2);
    expect(grid.startDay).toBe("2026-10-12");
    expect(grid.values[1]).toEqual([0.5, 0, 0, 1, 0, 0, 0]);
    expect(grid).toMatchObject({ maxCount: 4, total: 6, activeDays: 2 });
    expect(grid.busiest).toEqual({ day: "2026-10-22", count: 4 });
  });
});

describe("reviewRanking", () => {
  const reviewer = (uuid: string, extra: Partial<Reviewer> = {}): Reviewer => ({
    uuid,
    displayName: uuid,
    approved: false,
    changesRequested: false,
    ...extra,
  });
  const pr = (createdDay: number, reviewers: Reviewer[]) => ({
    author: { uuid: "autor", displayName: "Autor" },
    reviewers,
    createdOn: iso(createdDay),
  });
  const members = [
    { uuid: "ana", displayName: "Ana" },
    { uuid: "bia", displayName: "Bia" },
    { uuid: "caio", displayName: "Caio" },
  ];

  test("posição por corte entre quem tem pendências hoje", () => {
    const prs = [
      pr(20, [reviewer("ana")]),
      pr(21, [reviewer("bia")]),
      pr(22, [reviewer("bia"), reviewer("caio", { approved: true })]),
    ];
    const series = reviewRanking(prs, members, [at(20, 23), at(21, 23), at(22, 23)]);
    expect(series).toEqual([
      { id: "bia", name: "Bia", values: [0, 1, 2], ranks: [null, 2, 1] },
      { id: "ana", name: "Ana", values: [1, 1, 1], ranks: [1, 1, 2] },
    ]);
  });
});
