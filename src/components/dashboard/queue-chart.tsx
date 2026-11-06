"use client";

import { BarChart, type BarChartSeries } from "@/components/charts/bar-chart";
import { ChartCard, chartState, DataTable, HISTORY_EMPTY } from "@/components/dashboard/chart-card";
import { formatDayShort, formatNumber, plural } from "@/components/dashboard/format";
import type { DashboardResponse } from "@/hooks/use-dashboard";

type Point = DashboardResponse["queue"][number];

const BANDS = [
  { id: "approved", name: "Aprovados", color: "var(--success)" },
  { id: "inReview", name: "Em revisão", color: "var(--chart-3)" },
  { id: "waiting", name: "Aguardando revisão", color: "var(--chart-1)" },
] as const;

const formatPrs = (value: number) => formatNumber(value);

function summarize(points: Point[]) {
  const last = points.at(-1);
  if (!last) return "";
  const peak = points.reduce((a, b) => (b.total > a.total ? b : a));
  return (
    `Fila de PRs abertos nos últimos ${plural(points.length, "dia", "dias")}. ` +
    `Hoje: ${plural(last.total, "aberto", "abertos")}, ${formatNumber(last.waiting)} aguardando revisão, ` +
    `${formatNumber(last.inReview)} em revisão e ${plural(last.approved, "aprovado", "aprovados")}. ` +
    `Pico de ${formatNumber(peak.total)} em ${formatDayShort(peak.day)}.`
  );
}

export function QueueChart({
  data,
  isLoading,
  className,
}: {
  data: DashboardResponse | undefined;
  isLoading: boolean;
  className?: string;
}) {
  const points = data?.queue ?? [];
  const series: BarChartSeries[] = BANDS.map((band) => ({
    ...band,
    values: points.map((point) => point[band.id]),
  }));
  return (
    <ChartCard
      className={className}
      title="Fila ao longo do tempo"
      description="PRs abertos no fim de cada dia, pelo estado da revisão."
      state={chartState(isLoading, points.length > 0)}
      summary={summarize(points)}
      empty={HISTORY_EMPTY}
      table={
        <DataTable
          caption="Fila ao longo do tempo"
          rows={points.toReversed()}
          rowKey={(p) => p.day}
          columns={[
            { key: "day", header: "Dia", cell: (p) => formatDayShort(p.day) },
            { key: "waiting", header: "Aguardando", numeric: true, cell: (p) => formatNumber(p.waiting) },
            { key: "inReview", header: "Em revisão", numeric: true, cell: (p) => formatNumber(p.inReview) },
            { key: "approved", header: "Aprovados", numeric: true, cell: (p) => formatNumber(p.approved) },
            { key: "total", header: "Total", numeric: true, cell: (p) => formatNumber(p.total) },
          ]}
        />
      }
    >
      <BarChart
        series={series}
        categories={points.map((point) => formatDayShort(point.day))}
        layout="stacked"
        formatValue={formatPrs}
        formatTick={formatNumber}
        label="Fila ao longo do tempo"
      />
    </ChartCard>
  );
}
