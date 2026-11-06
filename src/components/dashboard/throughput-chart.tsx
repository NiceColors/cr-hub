"use client";

import { BarChart, type BarChartSeries } from "@/components/charts/bar-chart";
import { ChartCard, chartState, DataTable, HISTORY_EMPTY } from "@/components/dashboard/chart-card";
import { formatDayShort, formatNumber, plural } from "@/components/dashboard/format";
import type { DashboardResponse } from "@/hooks/use-dashboard";

const SERIES = [
  { id: "opened", name: "Abertos", color: "var(--chart-3)" },
  { id: "closed", name: "Concluídos", color: "var(--chart-1)" },
] as const;

function summarize(points: DashboardResponse["throughput"]) {
  const opened = points.reduce((sum, p) => sum + p.opened, 0);
  const closed = points.reduce((sum, p) => sum + p.closed, 0);
  return (
    `Throughput nos últimos ${plural(points.length, "dia", "dias")}: ` +
    `${plural(opened, "PR aberto", "PRs abertos")} e ${plural(closed, "concluído", "concluídos")}, ` +
    `média de ${formatNumber(Math.round((closed / Math.max(1, points.length)) * 10) / 10)} concluídos por dia.`
  );
}

export function ThroughputChart({
  data,
  isLoading,
  className,
}: {
  data: DashboardResponse | undefined;
  isLoading: boolean;
  className?: string;
}) {
  const points = data?.throughput ?? [];
  const series: BarChartSeries[] = SERIES.map((band) => ({
    ...band,
    values: points.map((point) => point[band.id]),
  }));
  return (
    <ChartCard
      className={className}
      title="Throughput"
      description="PRs abertos e concluídos (mergeados ou recusados) por dia."
      state={chartState(isLoading, points.length > 0)}
      summary={summarize(points)}
      empty={HISTORY_EMPTY}
      table={
        <DataTable
          caption="Throughput"
          rows={points.toReversed()}
          rowKey={(p) => p.day}
          columns={[
            { key: "day", header: "Dia", cell: (p) => formatDayShort(p.day) },
            { key: "opened", header: "Abertos", numeric: true, cell: (p) => formatNumber(p.opened) },
            { key: "closed", header: "Concluídos", numeric: true, cell: (p) => formatNumber(p.closed) },
          ]}
        />
      }
    >
      <BarChart
        series={series}
        categories={points.map((point) => formatDayShort(point.day))}
        layout="grouped"
        formatValue={formatNumber}
        formatTick={formatNumber}
        label="Throughput"
      />
    </ChartCard>
  );
}
