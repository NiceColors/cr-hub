"use client";

import { useId } from "react";
import {
  AlarmClockIcon,
  CheckCheckIcon,
  GitPullRequestIcon,
  HourglassIcon,
  InboxIcon,
  RefreshCwIcon,
  SirenIcon,
} from "lucide-react";
import { AgeChart } from "@/components/dashboard/age-chart";
import { HISTORY_EMPTY } from "@/components/dashboard/chart-card";
import { Delta } from "@/components/dashboard/delta";
import { FirstReviewChart } from "@/components/dashboard/first-review-chart";
import { formatDayShort, formatHours, formatNumber, plural } from "@/components/dashboard/format";
import { KpiStrip, type Kpi } from "@/components/dashboard/kpi-card";
import { QueueChart } from "@/components/dashboard/queue-chart";
import { RepositoriesChart } from "@/components/dashboard/repositories-chart";
import { AGE_COLORS, STAGE_COLORS, STAGE_LABELS } from "@/components/dashboard/series-colors";
import { ShareBar, ShareLegend, type ShareSegment } from "@/components/dashboard/share-bar";
import {
  DonutChart,
  DonutChartCenter,
  DonutChartLegend,
  DonutChartPlot,
} from "@/components/charts/donut-chart";
import { ThroughputChart } from "@/components/dashboard/throughput-chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardResponse } from "@/hooks/use-dashboard";

/** Ponto da fila uma semana antes do último, ou o primeiro se a janela for menor. */
export function weekAgoIndex(length: number) {
  return length >= 2 ? Math.max(0, length - 8) : -1;
}

export function againstLabel(days: string[]) {
  const index = weekAgoIndex(days.length);
  if (index < 0) return "";
  return days.length >= 8 ? "7 dias atrás" : formatDayShort(days[index]!);
}

function overviewKpis(data: DashboardResponse | undefined, range: number): Kpi[] {
  const queue = data?.queue ?? [];
  const last = queue.at(-1);
  const ref = queue[weekAgoIndex(queue.length)];
  const against = againstLabel(data?.days ?? []);
  const { current, previous } = data?.period ?? { current: null, previous: null };
  const previousLabel = `os ${range} dias anteriores`;
  const hintVs = (label: string) => (label ? `vs. ${label}` : undefined);

  return [
    {
      label: "PRs abertos",
      icon: GitPullRequestIcon,
      value: last?.total ?? null,
      color: "var(--chart-1)",
      spark: queue.map((p) => p.total),
      delta: (
        <Delta current={last?.total ?? null} previous={ref?.total ?? null} better="down" against={against} />
      ),
      hint: hintVs(against),
    },
    {
      label: "Aguardando revisão",
      icon: InboxIcon,
      value: last?.waiting ?? null,
      color: "var(--chart-2)",
      spark: queue.map((p) => p.waiting),
      delta: (
        <Delta current={last?.waiting ?? null} previous={ref?.waiting ?? null} better="down" against={against} />
      ),
      hint: hintVs(against),
    },
    {
      label: "Críticos",
      icon: SirenIcon,
      value: last?.critical ?? null,
      tone: "destructive",
      color: "var(--destructive)",
      spark: queue.map((p) => p.critical),
      delta: (
        <Delta current={last?.critical ?? null} previous={ref?.critical ?? null} better="down" against={against} />
      ),
      hint: hintVs(against),
    },
    {
      label: "Até a 1ª revisão",
      icon: AlarmClockIcon,
      value: current?.firstReviewMedianHours ?? null,
      format: formatHours,
      color: "var(--series-3)",
      spark: data?.firstReview.map((p) => p.medianHours),
      delta: (
        <Delta
          current={current?.firstReviewMedianHours ?? null}
          previous={previous?.firstReviewMedianHours ?? null}
          better="down"
          against={previousLabel}
        />
      ),
      hint: "mediana",
    },
    {
      label: "Concluídos",
      icon: CheckCheckIcon,
      value: current?.closed ?? null,
      color: "var(--success)",
      spark: data?.throughput.map((p) => p.closed),
      delta: (
        <Delta current={current?.closed ?? null} previous={previous?.closed ?? null} better="up" against={previousLabel} />
      ),
      hint: `em ${range} dias`,
    },
    {
      label: "Ciclo do PR",
      icon: RefreshCwIcon,
      value: current?.cycleMedianHours ?? null,
      format: formatHours,
      color: "var(--series-5)",
      delta: (
        <Delta
          current={current?.cycleMedianHours ?? null}
          previous={previous?.cycleMedianHours ?? null}
          better="down"
          against={previousLabel}
        />
      ),
      hint: "abertura → conclusão",
    },
  ];
}

function QueueNowCard({ data, isLoading }: { data: DashboardResponse | undefined; isLoading: boolean }) {
  const last = data?.queue.at(-1);
  const current = data?.period.current;
  const stages: ShareSegment[] = last
    ? (["waiting", "inReview", "approved"] as const).map((id) => ({
        id,
        label: STAGE_LABELS[id],
        value: last[id],
        color: STAGE_COLORS[id],
      }))
    : [];
  const ages: ShareSegment[] = last
    ? [
        { id: "normal", label: "No prazo", value: last.normal, color: AGE_COLORS.normal },
        { id: "warning", label: "Atenção", value: last.warning, color: AGE_COLORS.warning },
        { id: "critical", label: "Crítico", value: last.critical, color: AGE_COLORS.critical },
      ]
    : [];
  const net = current ? current.closed - current.opened : 0;
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isLoading}
      className="flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <header className="flex flex-col gap-1">
        <h2 id={titleId} className="text-sm font-medium">
          Fila agora
        </h2>
        <p className="text-xs text-muted-foreground">Como os PRs abertos se dividem neste momento.</p>
      </header>
      {isLoading ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !last ? (
        <p className="text-sm text-muted-foreground">{HISTORY_EMPTY.description}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
              {formatNumber(last.total)}
            </span>
            <span className="text-sm text-muted-foreground">{last.total === 1 ? "PR aberto" : "PRs abertos"}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-medium text-muted-foreground">Pelo estado da revisão</h3>
            <DonutChart
              label="PRs abertos pelo estado da revisão"
              segments={stages.map((stage) => ({
                id: stage.id,
                name: stage.label,
                value: stage.value,
                color: stage.color,
              }))}
              formatValue={formatNumber}
              thickness={14}
            >
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
                <DonutChartPlot>
                  <DonutChartCenter totalLabel="abertos" />
                </DonutChartPlot>
                <DonutChartLegend
                  className="[&_button]:px-2"
                  renderValue={(segment) => (
                    <span className="font-mono text-xs">{formatNumber(segment.value)}</span>
                  )}
                />
              </div>
            </DonutChart>
          </div>
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-medium text-muted-foreground">Pelo SLA de idade</h3>
            <ShareBar segments={ages} label="PRs abertos pela faixa de idade" />
            <ShareLegend segments={ages} />
          </div>
          {current ? (
            <p className="mt-auto flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <HourglassIcon aria-hidden className="size-3.5 shrink-0" />
              <span>
                No período: {plural(current.opened, "aberto", "abertos")} e{" "}
                {plural(current.closed, "concluído", "concluídos")}.{" "}
                <span className={net > 0 ? "text-success-foreground" : net < 0 ? "text-warning-foreground" : undefined}>
                  {net > 0
                    ? `A fila encolheu ${formatNumber(net)}.`
                    : net < 0
                      ? `A fila cresceu ${formatNumber(-net)}.`
                      : "A fila ficou estável."}
                </span>
              </span>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function OverviewView({
  data,
  isLoading,
  range,
}: {
  data: DashboardResponse | undefined;
  isLoading: boolean;
  range: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <KpiStrip items={overviewKpis(data, range)} isLoading={isLoading} className="2xl:grid-cols-6" />
      <div className="grid gap-4 lg:grid-cols-3">
        <QueueChart data={data} isLoading={isLoading} className="lg:col-span-2" />
        <QueueNowCard data={data} isLoading={isLoading} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AgeChart data={data} isLoading={isLoading} />
        <FirstReviewChart data={data} isLoading={isLoading} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ThroughputChart data={data} isLoading={isLoading} />
        <RepositoriesChart data={data} isLoading={isLoading} />
      </div>
    </div>
  );
}
