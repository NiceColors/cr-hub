"use client";

import { TimerIcon } from "lucide-react";
import { LineChart, type LineChartSeries } from "@/components/charts/line-chart";
import { ChartCard, chartState, DataTable } from "@/components/dashboard/chart-card";
import {
  formatDayShort,
  formatHours,
  formatNumber,
  plural,
} from "@/components/dashboard/format";
import type { DashboardResponse } from "@/hooks/use-dashboard";

type Point = DashboardResponse["firstReview"][number];

const SERIES = [
  { id: "medianHours", name: "Mediana", color: "var(--chart-1)" },
  { id: "p75Hours", name: "75% dos PRs até", color: "var(--chart-3)" },
] as const;

const hoursOrDash = (hours: number | null) => (hours === null ? "—" : formatHours(hours));

function summarize(overall: DashboardResponse["firstReviewOverall"], days: number) {
  if (overall.medianHours === null || overall.p75Hours === null) return "";
  return (
    `Tempo até a primeira revisão nos últimos ${plural(days, "dia", "dias")}: ` +
    `${plural(overall.reviewed, "PR revisado", "PRs revisados")}, mediana de ` +
    `${formatHours(overall.medianHours)} e 75% revisados em até ${formatHours(overall.p75Hours)}.`
  );
}

export function FirstReviewChart({
  data,
  isLoading,
  className,
}: {
  data: DashboardResponse | undefined;
  isLoading: boolean;
  className?: string;
}) {
  const points = data?.firstReview ?? [];
  const overall = data?.firstReviewOverall;
  const series: LineChartSeries[] = SERIES.map((band) => ({
    ...band,
    values: points.map((point) => point[band.id]),
  }));
  return (
    <ChartCard
      className={className}
      title="Tempo até a primeira revisão"
      description={
        overall && overall.medianHours !== null ? (
          <>
            Da abertura do PR à primeira revisão, pelo dia da revisão. Mediana do período:{" "}
            <span className="font-mono text-foreground tabular-nums">
              {formatHours(overall.medianHours)}
            </span>
            .
          </>
        ) : (
          "Da abertura do PR à primeira revisão, pelo dia da revisão."
        )
      }
      state={chartState(isLoading, (overall?.reviewed ?? 0) > 0)}
      summary={overall ? summarize(overall, points.length) : ""}
      empty={{
        icon: TimerIcon,
        title: "Nenhuma primeira revisão observada",
        description:
          "Só entram PRs que o CR Tracker viu antes da primeira revisão. Os que já chegaram revisados não têm o instante exato.",
      }}
      table={
        <DataTable
          caption="Tempo até a primeira revisão"
          rows={points.filter((p) => p.reviewed > 0).toReversed()}
          rowKey={(p) => p.day}
          columns={[
            { key: "day", header: "Dia", cell: (p: Point) => formatDayShort(p.day) },
            { key: "reviewed", header: "PRs revisados", numeric: true, cell: (p) => p.reviewed },
            { key: "median", header: "Mediana", numeric: true, cell: (p) => hoursOrDash(p.medianHours) },
            { key: "p75", header: "75% até", numeric: true, cell: (p) => hoursOrDash(p.p75Hours) },
          ]}
        />
      }
    >
      <LineChart
        series={series}
        categories={points.map((point) => formatDayShort(point.day))}
        variant="line"
        curve="monotone"
        formatValue={formatHours}
        formatTick={formatHours}
        label="Tempo até a primeira revisão"
      />
    </ChartCard>
  );
}
