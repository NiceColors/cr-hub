"use client";

import { CompositionChart, type CompositionChartSeries } from "@/components/charts/composition-chart";
import { ChartCard, chartState, DataTable, HISTORY_EMPTY } from "@/components/dashboard/chart-card";
import { formatDayShort, formatNumber, plural } from "@/components/dashboard/format";
import type { DashboardResponse } from "@/hooks/use-dashboard";

type Point = DashboardResponse["queue"][number];

const BANDS = [
  { id: "normal", name: "No prazo", color: "var(--success)" },
  { id: "warning", name: "Atenção", color: "var(--warning)" },
  { id: "critical", name: "Crítico", color: "var(--destructive)" },
] as const;

const formatPrs = (value: number) => plural(value, "PR", "PRs");

function summarize(points: Point[]) {
  const last = points.at(-1);
  if (!last) return "";
  return (
    `Distribuição por idade dos PRs abertos nos últimos ${plural(points.length, "dia", "dias")}. ` +
    `Hoje: ${formatNumber(last.normal)} no prazo, ${formatNumber(last.warning)} em atenção e ` +
    `${plural(last.critical, "crítico", "críticos")}.`
  );
}

export function AgeChart({
  data,
  isLoading,
}: {
  data: DashboardResponse | undefined;
  isLoading: boolean;
}) {
  const points = data?.queue ?? [];
  const series: CompositionChartSeries[] = BANDS.map((band) => ({
    ...band,
    values: points.map((p) => p[band.id]),
  }));
  return (
    <ChartCard
      title="Distribuição por idade"
      description="Parte da fila em cada faixa do SLA do repositório, no fim de cada dia."
      state={chartState(isLoading, points.some((p) => p.total > 0))}
      summary={summarize(points)}
      empty={HISTORY_EMPTY}
      bodyClassName="min-h-96"
      table={
        <DataTable
          caption="Distribuição por idade"
          rows={points.toReversed()}
          rowKey={(p) => p.day}
          columns={[
            { key: "day", header: "Dia", cell: (p) => formatDayShort(p.day) },
            ...BANDS.map((band) => ({
              key: band.id,
              header: band.name,
              numeric: true,
              cell: (p: Point) => formatNumber(p[band.id]),
            })),
          ]}
        />
      }
    >
      <CompositionChart
        series={series}
        periods={points.map((p) => formatDayShort(p.day))}
        formatValue={formatPrs}
        label="Distribuição por idade"
      />
    </ChartCard>
  );
}
