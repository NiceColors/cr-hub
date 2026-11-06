import type { AgeBand } from "@/hooks/use-pull-requests";

export const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const WEEKDAYS_SHORT_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** Mês do calendário, com `month` de 0 a 11 como no `Date`. */
export type CalendarMonth = { year: number; month: number };

const pad = (n: number) => String(n).padStart(2, "0");

/** Chave `AAAA-MM-DD` do dia no fuso do navegador. */
export function dayKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function dayKeyOf(date: Date) {
  return dayKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysInMonth({ year, month }: CalendarMonth) {
  return new Date(year, month + 1, 0).getDate();
}

export function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function sameMonth(a: CalendarMonth, b: CalendarMonth) {
  return a.year === b.year && a.month === b.month;
}

/** Agrupa pelo dia de abertura do PR, preservando a ordem de entrada em cada dia. */
export function groupByOpenedDay<T extends { createdOn: string }>(items: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKeyOf(new Date(item.createdOn));
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

export function monthCount(groups: ReadonlyMap<string, readonly unknown[]>, month: CalendarMonth) {
  let total = 0;
  for (let day = 1; day <= daysInMonth(month); day++) {
    total += groups.get(dayKey(month.year, month.month, day))?.length ?? 0;
  }
  return total;
}

/**
 * Dia selecionado ao abrir um mês: hoje, se tiver PRs; senão o dia mais
 * recente com PRs (até hoje, no mês corrente); senão hoje no mês corrente e o
 * dia 1 nos demais.
 */
export function defaultDay(
  groups: ReadonlyMap<string, readonly unknown[]>,
  month: CalendarMonth,
  today: Date,
) {
  const isCurrent = sameMonth(month, { year: today.getFullYear(), month: today.getMonth() });
  const last = isCurrent ? today.getDate() : daysInMonth(month);
  for (let day = last; day >= 1; day--) {
    if (groups.get(dayKey(month.year, month.month, day))?.length) return day;
  }
  return isCurrent ? today.getDate() : 1;
}

const SEVERITY: Record<AgeBand, number> = { critical: 0, warning: 1, normal: 2 };

/** Até `limit` marcas por dia, as faixas mais graves primeiro. */
export function dayMarks(items: readonly { ageBand: AgeBand }[], limit = 3): AgeBand[] {
  return items
    .map((item) => item.ageBand)
    .toSorted((a, b) => SEVERITY[a] - SEVERITY[b])
    .slice(0, limit);
}

export function openedLabel(count: number) {
  return count === 1 ? "PR aberto no mês" : "PRs abertos no mês";
}
