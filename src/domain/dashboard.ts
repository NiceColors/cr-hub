import {
  computeAgeBand,
  DEFAULT_SLA,
  isPendingFor,
  type PullRequest,
  type Sla,
} from "@/domain/pull-request";

const HOUR_MS = 60 * 60 * 1000;
const UTC_DAY_MS = 24 * HOUR_MS;

/** Janelas que o dashboard oferece, em dias. */
export const DASHBOARD_RANGES = [7, 14, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
export const DEFAULT_DASHBOARD_RANGE: DashboardRange = 30;

export function isDashboardRange(value: number): value is DashboardRange {
  return (DASHBOARD_RANGES as readonly number[]).includes(value);
}

/** Linha de `pr_history` com o que o dashboard usa. Instantes em ms. */
export interface HistoryRow {
  prKey: string;
  repoUuid: string;
  authorUuid: string;
  createdOn: string; // ISO
  firstSeenAt: number;
  firstReviewAt: number | null;
  approvedAt: number | null;
  closedAt: number | null;
  changesCycles: number;
}

export interface DayBucket {
  day: string; // YYYY-MM-DD, horário local
  startMs: number;
  /** Instante em que o dia é "fotografado": fim do dia, ou agora para hoje. */
  cutoffMs: number;
}

export interface QueuePoint {
  day: string;
  total: number;
  waiting: number;
  inReview: number;
  approved: number;
  normal: number;
  warning: number;
  critical: number;
}

export interface RepositorySeries {
  id: string;
  name: string;
  values: number[];
}

export interface FirstReviewPoint {
  day: string;
  reviewed: number;
  medianHours: number | null;
  p75Hours: number | null;
}

export interface ThroughputPoint {
  day: string;
  opened: number;
  closed: number;
}

/** Medidas de uma janela de tempo, para comparar com a janela anterior. */
export interface WindowStats {
  opened: number;
  closed: number;
  firstReviewMedianHours: number | null;
  /** Da abertura à conclusão, entre os PRs concluídos na janela. */
  cycleMedianHours: number | null;
}

export interface PeriodComparison {
  current: WindowStats;
  /** Janela de mesmo tamanho logo antes; null se a gravação não a cobre inteira. */
  previous: WindowStats | null;
}

export interface DashboardData {
  days: string[];
  period: PeriodComparison;
  queue: QueuePoint[];
  repositories: RepositorySeries[];
  firstReview: FirstReviewPoint[];
  /** As mesmas medidas sobre todas as primeiras revisões da janela. */
  firstReviewOverall: Omit<FirstReviewPoint, "day">;
  throughput: ThroughputPoint[];
  /** Primeiras revisões por dia local, para o calendário de atividade. */
  activity: { today: string; counts: Record<string, number> };
}

export const OTHER_REPOSITORIES_ID = "outros";

/** Data local no formato YYYY-MM-DD. */
export function localDay(ms: number) {
  const date = new Date(ms);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfLocalDay(ms: number) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addLocalDays(ms: number, days: number) {
  const date = new Date(ms);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/**
 * Dias locais de `sinceMs` até hoje, limitados aos últimos `maxDays`. Antes do
 * início da gravação não há como saber o que estava aberto, então a janela
 * nunca começa antes dele.
 */
export function dayBuckets(sinceMs: number | null, nowMs: number, maxDays: number): DayBucket[] {
  if (sinceMs === null || sinceMs > nowMs) return [];
  const today = startOfLocalDay(nowMs);
  const first = Math.max(startOfLocalDay(sinceMs), addLocalDays(today, -(maxDays - 1)));
  const out: DayBucket[] = [];
  for (let start = first; start <= today; start = addLocalDays(start, 1)) {
    out.push({
      day: localDay(start),
      startMs: start,
      cutoffMs: Math.min(addLocalDays(start, 1) - 1, nowMs),
    });
  }
  return out;
}

/** Os últimos `count` dias locais terminando hoje, sem depender do histórico. */
export function recentDayBuckets(nowMs: number, count: number): DayBucket[] {
  const today = startOfLocalDay(nowMs);
  return dayBuckets(addLocalDays(today, -(count - 1)), nowMs, count);
}

export function isOpenAt(row: HistoryRow, atMs: number) {
  return Date.parse(row.createdOn) <= atMs && (row.closedAt === null || row.closedAt > atMs);
}

export function queueSeries(
  rows: HistoryRow[],
  buckets: DayBucket[],
  slaByRepo: Map<string, Sla>,
): QueuePoint[] {
  return buckets.map(({ day, cutoffMs }) => {
    const point: QueuePoint = {
      day,
      total: 0,
      waiting: 0,
      inReview: 0,
      approved: 0,
      normal: 0,
      warning: 0,
      critical: 0,
    };
    for (const row of rows) {
      if (!isOpenAt(row, cutoffMs)) continue;
      point.total++;
      if (row.approvedAt !== null && row.approvedAt <= cutoffMs) point.approved++;
      else if (row.firstReviewAt !== null && row.firstReviewAt <= cutoffMs) point.inReview++;
      else point.waiting++;
      point[computeAgeBand(row.createdOn, cutoffMs, slaByRepo.get(row.repoUuid) ?? DEFAULT_SLA)]++;
    }
    return point;
  });
}

/** PRs abertos por repositório; os `limit` maiores no período e o resto em "Outros". */
export function repositorySeries(
  rows: HistoryRow[],
  buckets: DayBucket[],
  repoNames: Map<string, string>,
  limit = 4,
): RepositorySeries[] {
  const byRepo = new Map<string, number[]>();
  buckets.forEach(({ cutoffMs }, i) => {
    for (const row of rows) {
      if (!isOpenAt(row, cutoffMs)) continue;
      let values = byRepo.get(row.repoUuid);
      if (!values) {
        values = buckets.map(() => 0);
        byRepo.set(row.repoUuid, values);
      }
      values[i]!++;
    }
  });
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const name = (uuid: string) => repoNames.get(uuid) ?? uuid;
  const ranked = [...byRepo.entries()].sort(
    ([a, va], [b, vb]) => sum(vb) - sum(va) || name(a).localeCompare(name(b), "pt-BR"),
  );
  const top = ranked.slice(0, limit).map(([id, values]) => ({ id, name: name(id), values }));
  const rest = ranked.slice(limit);
  if (rest.length === 0) return top;
  const other = buckets.map((_, i) => rest.reduce((acc, [, values]) => acc + values[i]!, 0));
  return [...top, { id: OTHER_REPOSITORIES_ID, name: "Outros", values: other }];
}

/**
 * Primeira revisão confiável: o PR foi visto antes de ser revisado. Se já
 * chegou revisado, o instante gravado é o da primeira busca, não o da revisão.
 */
export function hasObservedFirstReview(
  row: HistoryRow,
): row is HistoryRow & { firstReviewAt: number } {
  return row.firstReviewAt !== null && row.firstReviewAt > row.firstSeenAt;
}

/** Percentil com interpolação linear sobre valores já ordenados. */
export function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (index - lo);
}

function hoursToFirstReviewByDay(rows: HistoryRow[]) {
  const hoursByDay = new Map<string, number[]>();
  for (const row of rows) {
    if (!hasObservedFirstReview(row)) continue;
    const day = localDay(row.firstReviewAt);
    const hours = Math.max(0, row.firstReviewAt - Date.parse(row.createdOn)) / HOUR_MS;
    const list = hoursByDay.get(day) ?? [];
    list.push(hours);
    hoursByDay.set(day, list);
  }
  return hoursByDay;
}

function summarizeHours(hours: number[]): Omit<FirstReviewPoint, "day"> {
  const sorted = hours.toSorted((a, b) => a - b);
  return {
    reviewed: sorted.length,
    medianHours: percentile(sorted, 0.5),
    p75Hours: percentile(sorted, 0.75),
  };
}

export function firstReviewSeries(rows: HistoryRow[], buckets: DayBucket[]): FirstReviewPoint[] {
  const hoursByDay = hoursToFirstReviewByDay(rows);
  return buckets.map(({ day }) => ({ day, ...summarizeHours(hoursByDay.get(day) ?? []) }));
}

export function firstReviewOverall(rows: HistoryRow[], buckets: DayBucket[]) {
  const hoursByDay = hoursToFirstReviewByDay(rows);
  return summarizeHours(buckets.flatMap(({ day }) => hoursByDay.get(day) ?? []));
}

export function throughputSeries(rows: HistoryRow[], buckets: DayBucket[]): ThroughputPoint[] {
  const opened = new Map<string, number>();
  const closed = new Map<string, number>();
  const bump = (map: Map<string, number>, day: string) => map.set(day, (map.get(day) ?? 0) + 1);
  for (const row of rows) {
    bump(opened, localDay(Date.parse(row.createdOn)));
    if (row.closedAt !== null) bump(closed, localDay(row.closedAt));
  }
  return buckets.map(({ day }) => ({
    day,
    opened: opened.get(day) ?? 0,
    closed: closed.get(day) ?? 0,
  }));
}

export function activityCounts(rows: HistoryRow[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!hasObservedFirstReview(row)) continue;
    const day = localDay(row.firstReviewAt);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return counts;
}

/** Desde quando há gravação para estas linhas. */
export function recordingSince(rows: HistoryRow[]) {
  let since: number | null = null;
  for (const row of rows) if (since === null || row.firstSeenAt < since) since = row.firstSeenAt;
  return since;
}

export function windowStats(rows: HistoryRow[], fromMs: number, toMs: number): WindowStats {
  let opened = 0;
  let closed = 0;
  const firstReview: number[] = [];
  const cycle: number[] = [];
  const within = (ms: number) => ms >= fromMs && ms <= toMs;
  for (const row of rows) {
    const created = Date.parse(row.createdOn);
    if (within(created)) opened++;
    if (row.closedAt !== null && within(row.closedAt)) {
      closed++;
      cycle.push(Math.max(0, row.closedAt - created) / HOUR_MS);
    }
    if (hasObservedFirstReview(row) && within(row.firstReviewAt)) {
      firstReview.push(Math.max(0, row.firstReviewAt - created) / HOUR_MS);
    }
  }
  const median = (values: number[]) => percentile(values.toSorted((a, b) => a - b), 0.5);
  return {
    opened,
    closed,
    firstReviewMedianHours: median(firstReview),
    cycleMedianHours: median(cycle),
  };
}

/** A janela dos `buckets` e a de mesmo tamanho imediatamente antes. */
export function periodComparison(
  rows: HistoryRow[],
  buckets: DayBucket[],
  since: number | null,
): PeriodComparison {
  const first = buckets[0];
  const last = buckets.at(-1);
  if (!first || !last) {
    return {
      current: { opened: 0, closed: 0, firstReviewMedianHours: null, cycleMedianHours: null },
      previous: null,
    };
  }
  const previousStart = addLocalDays(first.startMs, -buckets.length);
  return {
    current: windowStats(rows, first.startMs, last.cutoffMs),
    previous:
      since !== null && since <= previousStart
        ? windowStats(rows, previousStart, first.startMs - 1)
        : null,
  };
}

export function buildDashboard(
  rows: HistoryRow[],
  opts: {
    nowMs: number;
    windowDays: number;
    slaByRepo: Map<string, Sla>;
    repoNames: Map<string, string>;
  },
): DashboardData {
  const since = recordingSince(rows);
  const buckets = dayBuckets(since, opts.nowMs, opts.windowDays);
  return {
    days: buckets.map((b) => b.day),
    period: periodComparison(rows, buckets, since),
    queue: queueSeries(rows, buckets, opts.slaByRepo),
    repositories: repositorySeries(rows, buckets, opts.repoNames),
    firstReview: firstReviewSeries(rows, buckets),
    firstReviewOverall: firstReviewOverall(rows, buckets),
    throughput: throughputSeries(rows, buckets),
    activity: { today: localDay(opts.nowMs), counts: activityCounts(rows) },
  };
}

function isoToUtcMs(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

/**
 * Grade do calendário de atividade: `values[semana][dia]` (segunda primeiro)
 * em 0..1 e a contagem que vale 1. Usa a mesma aritmética UTC do HeatCalendar,
 * com `endDate` no dia de calendário `todayIso`.
 */
export function heatCalendarGrid(counts: Record<string, number>, todayIso: string, weeks: number) {
  const end = isoToUtcMs(todayIso);
  const monday = end - ((new Date(end).getUTCDay() + 6) % 7) * UTC_DAY_MS;
  const start = monday - (weeks - 1) * 7 * UTC_DAY_MS;
  const raw: number[][] = [];
  let maxCount = 0;
  let total = 0;
  let activeDays = 0;
  let busiest: { day: string; count: number } | null = null;
  for (let w = 0; w < weeks; w++) {
    const week: number[] = [];
    for (let d = 0; d < 7; d++) {
      const ms = start + (w * 7 + d) * UTC_DAY_MS;
      const day = new Date(ms).toISOString().slice(0, 10);
      const count = ms <= end ? (counts[day] ?? 0) : 0;
      week.push(count);
      maxCount = Math.max(maxCount, count);
      total += count;
      if (count > 0) activeDays++;
      if (count > 0 && (!busiest || count > busiest.count)) busiest = { day, count };
    }
    raw.push(week);
  }
  return {
    values: raw.map((week) => week.map((count) => (maxCount > 0 ? count / maxCount : 0))),
    maxCount: Math.max(1, maxCount),
    endDate: new Date(end),
    startDay: new Date(start).toISOString().slice(0, 10),
    total,
    activeDays,
    busiest,
  };
}

export interface RankingSeries {
  id: string;
  name: string;
  /** Posição por período (1 = mais revisões pendentes); null quando não tinha nenhuma. */
  ranks: (number | null)[];
  values: number[];
}

/**
 * Ranking de revisões pendentes por pessoa em cada corte. Conta os PRs abertos
 * hoje em que a pessoa ainda precisa revisar, criados até o corte: mostra como
 * a carga atual de cada um se acumulou. Só as `limit` pessoas com mais
 * pendências hoje entram, e a posição é calculada entre elas.
 */
export function reviewRanking(
  prs: Pick<PullRequest, "author" | "reviewers" | "createdOn">[],
  members: { uuid: string; displayName: string }[],
  cutoffsMs: number[],
  limit = 6,
): RankingSeries[] {
  const counted = members.map((member) => {
    const created = prs
      .filter((pr) => isPendingFor(pr, member.uuid))
      .map((pr) => Date.parse(pr.createdOn));
    return {
      id: member.uuid,
      name: member.displayName,
      values: cutoffsMs.map((cutoff) => created.filter((ms) => ms <= cutoff).length),
    };
  });
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR");
  const top = counted
    .filter((m) => (m.values.at(-1) ?? 0) > 0)
    .toSorted((a, b) => b.values.at(-1)! - a.values.at(-1)! || byName(a, b))
    .slice(0, limit);
  const ranks = cutoffsMs.map((_, i) => {
    const order = top
      .filter((m) => m.values[i]! > 0)
      .toSorted((a, b) => b.values[i]! - a.values[i]! || byName(a, b));
    return new Map(order.map((m, index) => [m.id, index + 1]));
  });
  return top.map((m) => ({ ...m, ranks: ranks.map((byId) => byId.get(m.id) ?? null) }));
}
