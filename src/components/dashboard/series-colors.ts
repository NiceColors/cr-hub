import { PROJECT_KIND_LABELS } from "@/domain/project";
import { UNLINKED_KIND, type WorkKind } from "@/domain/dashboard-features";

const SERIES_COUNT = 8;

/** Cor categórica estável para a i-ésima série (times, por exemplo). */
export const seriesColor = (index: number) => `var(--series-${(index % SERIES_COUNT) + 1})`;

export const MUTED_SERIES = "color-mix(in oklch, var(--muted-foreground) 35%, transparent)";

export const WORK_KIND_COLORS: Record<WorkKind, string> = {
  feature: "var(--series-1)",
  project: "var(--series-3)",
  fix: "var(--series-2)",
  hotfix: "var(--series-7)",
  chore: "var(--series-4)",
  spike: "var(--series-5)",
  [UNLINKED_KIND]: MUTED_SERIES,
};

export const WORK_KIND_LABELS: Record<WorkKind, string> = {
  ...PROJECT_KIND_LABELS,
  [UNLINKED_KIND]: "Sem projeto",
};

/** Estados da revisão, nas mesmas cores do gráfico da fila. */
export const STAGE_COLORS = {
  waiting: "var(--chart-1)",
  inReview: "var(--chart-3)",
  approved: "var(--success)",
  closed: "color-mix(in oklch, var(--success) 55%, var(--muted-foreground))",
  untracked: MUTED_SERIES,
} as const;

export const STAGE_LABELS = {
  waiting: "Aguardando revisão",
  inReview: "Em revisão",
  approved: "Aprovados",
  closed: "Concluídos",
  untracked: "Sem histórico",
} as const;

export const AGE_COLORS = {
  normal: "var(--success)",
  warning: "var(--warning)",
  critical: "var(--destructive)",
} as const;
