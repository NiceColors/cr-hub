import { describe, expect, test } from "vitest";
import {
  dayKey,
  dayMarks,
  defaultDay,
  groupByOpenedDay,
  monthCount,
  shiftMonth,
} from "@/components/pull-requests/queue-calendar-model";

// Sem "Z": datas no fuso local, como o calendário as agrupa.
const items = [
  { id: 1, createdOn: "2026-03-03T09:00:00" },
  { id: 2, createdOn: "2026-03-03T18:30:00" },
  { id: 3, createdOn: "2026-03-17T10:00:00" },
  { id: 4, createdOn: "2026-02-27T10:00:00" },
];

describe("groupByOpenedDay", () => {
  test("agrupa pelo dia local de abertura, mantendo a ordem", () => {
    const groups = groupByOpenedDay(items);
    expect(groups.get("2026-03-03")?.map((i) => i.id)).toEqual([1, 2]);
    expect(groups.get("2026-03-17")?.map((i) => i.id)).toEqual([3]);
    expect(groups.get("2026-02-27")?.map((i) => i.id)).toEqual([4]);
  });
});

describe("monthCount", () => {
  test("soma só os dias do mês", () => {
    const groups = groupByOpenedDay(items);
    expect(monthCount(groups, { year: 2026, month: 2 })).toBe(3);
    expect(monthCount(groups, { year: 2026, month: 1 })).toBe(1);
    expect(monthCount(groups, { year: 2026, month: 3 })).toBe(0);
  });
});

describe("shiftMonth", () => {
  test("atravessa a virada do ano", () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2025, month: 11 }, 1)).toEqual({ year: 2026, month: 0 });
  });
});

describe("defaultDay", () => {
  const groups = groupByOpenedDay(items);

  test("no mês corrente, hoje quando tem PRs", () => {
    expect(defaultDay(groups, { year: 2026, month: 2 }, new Date(2026, 2, 17))).toBe(17);
  });

  test("no mês corrente, o dia mais recente com PRs até hoje", () => {
    expect(defaultDay(groups, { year: 2026, month: 2 }, new Date(2026, 2, 10))).toBe(3);
  });

  test("no mês corrente sem PRs até hoje, fica em hoje", () => {
    expect(defaultDay(groups, { year: 2026, month: 2 }, new Date(2026, 2, 2))).toBe(2);
  });

  test("em outro mês, o dia mais recente com PRs ou o dia 1", () => {
    expect(defaultDay(groups, { year: 2026, month: 1 }, new Date(2026, 2, 17))).toBe(27);
    expect(defaultDay(groups, { year: 2026, month: 0 }, new Date(2026, 2, 17))).toBe(1);
  });
});

describe("dayMarks", () => {
  test("ordena por gravidade e limita a quantidade", () => {
    expect(
      dayMarks([
        { ageBand: "normal" },
        { ageBand: "critical" },
        { ageBand: "warning" },
        { ageBand: "critical" },
      ]),
    ).toEqual(["critical", "critical", "warning"]);
  });
});

test("dayKey usa mês de 0 a 11", () => {
  expect(dayKey(2026, 0, 5)).toBe("2026-01-05");
});
