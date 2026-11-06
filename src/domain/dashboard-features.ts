import {
  isOpenAt,
  percentile,
  type DayBucket,
  type HistoryRow,
} from "@/domain/dashboard";
import { PROJECT_KINDS, type ProjectKind, type ProjectStatus } from "@/domain/project";

const HOUR_MS = 60 * 60 * 1000;

/** CRs sem projeto vinculado, nas séries por tipo de trabalho. */
export const UNLINKED_KIND = "none";
export type WorkKind = ProjectKind | typeof UNLINKED_KIND;
export const WORK_KINDS: readonly WorkKind[] = [...PROJECT_KINDS, UNLINKED_KIND];

export type PullRequestStage = "waiting" | "inReview" | "approved" | "closed";

export interface FeatureInput {
  id: number;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  links: { prKey: string; repoSlug: string; authorName: string | null; addedAt: number }[];
}

export interface FeatureSummary {
  id: number;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  /** CRs vinculados por estágio. `untracked` não tem histórico gravado. */
  stages: Record<PullRequestStage | "untracked", number>;
  total: number;
  closedInWindow: number;
  /** Idade do CR aberto mais antigo, em horas. */
  oldestOpenHours: number | null;
  /** Da abertura à conclusão, entre os CRs concluídos. */
  cycleMedianHours: number | null;
  changesCycles: number;
  lastActivityAt: number | null;
  authors: string[];
  repos: string[];
}

export interface KindSeries {
  id: WorkKind;
  values: number[];
}

export interface KindQueue {
  id: WorkKind;
  waiting: number;
  inReview: number;
  approved: number;
  total: number;
}

export interface FeatureBoard {
  features: FeatureSummary[];
  /** CRs concluídos por dia, pelo tipo do projeto vinculado. */
  deliveries: KindSeries[];
  /** Fila aberta agora, pelo tipo do projeto vinculado. */
  openByKind: KindQueue[];
}

/** Estágio do CR no instante dado, do mais avançado para o menos. */
export function stageAt(row: HistoryRow, atMs: number): PullRequestStage {
  if (row.closedAt !== null && row.closedAt <= atMs) return "closed";
  if (row.approvedAt !== null && row.approvedAt <= atMs) return "approved";
  if (row.firstReviewAt !== null && row.firstReviewAt <= atMs) return "inReview";
  return "waiting";
}

/** Um CR em vários projetos conta no tipo do vínculo mais recente. */
export function kindByPullRequest(features: FeatureInput[]) {
  const latest = new Map<string, { kind: ProjectKind; addedAt: number }>();
  for (const feature of features) {
    for (const link of feature.links) {
      const current = latest.get(link.prKey);
      if (!current || link.addedAt > current.addedAt) {
        latest.set(link.prKey, { kind: feature.kind, addedAt: link.addedAt });
      }
    }
  }
  return new Map([...latest].map(([key, { kind }]) => [key, kind]));
}

function lastActivity(row: HistoryRow) {
  return Math.max(
    Date.parse(row.createdOn),
    row.firstReviewAt ?? 0,
    row.approvedAt ?? 0,
    row.closedAt ?? 0,
  );
}

const distinct = (values: (string | null)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].toSorted((a, b) => a.localeCompare(b, "pt-BR"));

function summarizeFeature(
  feature: FeatureInput,
  rowsByKey: Map<string, HistoryRow>,
  opts: { scoped: boolean; fromMs: number; nowMs: number },
): FeatureSummary | null {
  const stages = { waiting: 0, inReview: 0, approved: 0, closed: 0, untracked: 0 };
  let closedInWindow = 0;
  let oldestOpenHours: number | null = null;
  let changesCycles = 0;
  let lastActivityAt: number | null = null;
  const cycle: number[] = [];
  const links = feature.links.filter((link) => !opts.scoped || rowsByKey.has(link.prKey));
  if (opts.scoped && links.length === 0) return null;

  for (const link of links) {
    const row = rowsByKey.get(link.prKey);
    if (!row) {
      stages.untracked++;
      continue;
    }
    const stage = stageAt(row, opts.nowMs);
    stages[stage]++;
    changesCycles += row.changesCycles;
    lastActivityAt = Math.max(lastActivityAt ?? 0, lastActivity(row));
    const created = Date.parse(row.createdOn);
    if (stage === "closed") {
      cycle.push(Math.max(0, row.closedAt! - created) / HOUR_MS);
      if (row.closedAt! >= opts.fromMs) closedInWindow++;
    } else {
      const age = Math.max(0, opts.nowMs - created) / HOUR_MS;
      oldestOpenHours = Math.max(oldestOpenHours ?? 0, age);
    }
  }

  return {
    id: feature.id,
    name: feature.name,
    kind: feature.kind,
    status: feature.status,
    createdAt: feature.createdAt,
    updatedAt: feature.updatedAt,
    stages,
    total: links.length,
    closedInWindow,
    oldestOpenHours,
    cycleMedianHours: percentile(cycle.toSorted((a, b) => a - b), 0.5),
    changesCycles,
    lastActivityAt,
    authors: distinct(links.map((l) => l.authorName)),
    repos: distinct(links.map((l) => l.repoSlug)),
  };
}

const openCount = (f: FeatureSummary) => f.stages.waiting + f.stages.inReview + f.stages.approved;

/**
 * Projetos e features cruzados com o histórico dos CRs vinculados. `rows` já
 * vem no escopo do filtro; com `scoped`, vínculos fora dele são ignorados e
 * projetos sem nenhum CR no escopo somem.
 */
export function buildFeatureBoard(
  features: FeatureInput[],
  rows: HistoryRow[],
  buckets: DayBucket[],
  opts: { scoped: boolean; nowMs: number },
): FeatureBoard {
  const rowsByKey = new Map(rows.map((row) => [row.prKey, row]));
  const fromMs = buckets[0]?.startMs ?? opts.nowMs;
  const summaries = features
    .map((feature) => summarizeFeature(feature, rowsByKey, { ...opts, fromMs }))
    .filter((f): f is FeatureSummary => f !== null)
    .toSorted(
      (a, b) =>
        Number(a.status === "done") - Number(b.status === "done") ||
        openCount(b) - openCount(a) ||
        b.updatedAt - a.updatedAt,
    );

  const kinds = kindByPullRequest(features);
  const kindOf = (row: HistoryRow): WorkKind => kinds.get(row.prKey) ?? UNLINKED_KIND;

  const deliveries = new Map<WorkKind, number[]>();
  const queues = new Map<WorkKind, KindQueue>();
  for (const row of rows) {
    const kind = kindOf(row);
    if (row.closedAt !== null) {
      const bucket = buckets.findIndex((b) => row.closedAt! >= b.startMs && row.closedAt! <= b.cutoffMs);
      if (bucket >= 0) {
        const values = deliveries.get(kind) ?? buckets.map(() => 0);
        values[bucket]!++;
        deliveries.set(kind, values);
      }
    }
    if (isOpenAt(row, opts.nowMs)) {
      const stage = stageAt(row, opts.nowMs);
      if (stage === "closed") continue;
      const queue = queues.get(kind) ?? { id: kind, waiting: 0, inReview: 0, approved: 0, total: 0 };
      queue[stage]++;
      queue.total++;
      queues.set(kind, queue);
    }
  }

  return {
    features: summaries,
    deliveries: WORK_KINDS.flatMap((id) => {
      const values = deliveries.get(id);
      return values ? [{ id, values }] : [];
    }),
    openByKind: WORK_KINDS.flatMap((id) => {
      const queue = queues.get(id);
      return queue ? [queue] : [];
    }),
  };
}
