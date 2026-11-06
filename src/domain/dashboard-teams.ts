import {
  queueSeries,
  throughputSeries,
  windowStats,
  type DayBucket,
  type HistoryRow,
  type QueuePoint,
  type WindowStats,
} from "@/domain/dashboard";
import type { Sla } from "@/domain/pull-request";

/** Séries diárias de um time, alinhadas com os mesmos dias de todos os outros. */
export interface TeamComparison {
  id: number;
  name: string;
  members: number;
  open: number[];
  waiting: number[];
  critical: number[];
  opened: number[];
  closed: number[];
  /** Retrato da fila no último dia. */
  now: Omit<QueuePoint, "day">;
  stats: WindowStats;
}

const EMPTY_NOW: Omit<QueuePoint, "day"> = {
  total: 0,
  waiting: 0,
  inReview: 0,
  approved: 0,
  normal: 0,
  warning: 0,
  critical: 0,
};

/**
 * Cada time com as linhas do seu escopo. Os dias vêm de fora para que todos
 * os times dividam o mesmo eixo, mesmo os que começaram a ter PRs depois.
 */
export function buildTeamComparison(
  teams: { id: number; name: string; members: number; rows: HistoryRow[] }[],
  buckets: DayBucket[],
  slaByRepo: Map<string, Sla>,
): TeamComparison[] {
  const first = buckets[0];
  const last = buckets.at(-1);
  return teams.map((team) => {
    const queue = queueSeries(team.rows, buckets, slaByRepo);
    const throughput = throughputSeries(team.rows, buckets);
    const lastPoint = queue.at(-1);
    const now = lastPoint
      ? {
          total: lastPoint.total,
          waiting: lastPoint.waiting,
          inReview: lastPoint.inReview,
          approved: lastPoint.approved,
          normal: lastPoint.normal,
          warning: lastPoint.warning,
          critical: lastPoint.critical,
        }
      : EMPTY_NOW;
    return {
      id: team.id,
      name: team.name,
      members: team.members,
      open: queue.map((p) => p.total),
      waiting: queue.map((p) => p.waiting),
      critical: queue.map((p) => p.critical),
      opened: throughput.map((p) => p.opened),
      closed: throughput.map((p) => p.closed),
      now,
      stats:
        first && last
          ? windowStats(team.rows, first.startMs, last.cutoffMs)
          : { opened: 0, closed: 0, firstReviewMedianHours: null, cycleMedianHours: null },
    };
  });
}
