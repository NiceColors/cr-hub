"use client";

import { CompositionChart, type CompositionChartSeries } from "@/components/charts/composition-chart";
import { ChartCard, chartState, DataTable, HISTORY_EMPTY } from "@/components/dashboard/chart-card";
import { formatDayShort, formatNumber, plural } from "@/components/dashboard/format";
import { OTHER_REPOSITORIES_ID } from "@/domain/dashboard";
import type { DashboardResponse } from "@/hooks/use-dashboard";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const OTHER_COLOR = "color-mix(in oklch, var(--muted-foreground) 30%, transparent)";

const formatPrs = (value: number) => plural(value, "PR", "PRs");

function summarize(repos: DashboardResponse["repositories"], days: string[]) {
  const today = days.length - 1;
  const total = repos.reduce((sum, r) => sum + (r.values[today] ?? 0), 0);
  const top = repos
    .filter((r) => r.id !== OTHER_REPOSITORIES_ID)
    .reduce<(typeof repos)[number] | null>(
      (best, r) => (!best || (r.values[today] ?? 0) > (best.values[today] ?? 0) ? r : best),
      null,
    );
  if (!top || total === 0) return "Nenhum PR aberto hoje.";
  const count = top.values[today] ?? 0;
  return (
    `PRs abertos por repositório nos últimos ${plural(days.length, "dia", "dias")}. ` +
    `Hoje, ${top.name} concentra ${formatPrs(count)} de ${formatNumber(total)} ` +
    `(${Math.round((count / total) * 100)}%).`
  );
}

export function RepositoriesChart({
  data,
  isLoading,
  className,
}: {
  data: DashboardResponse | undefined;
  isLoading: boolean;
  className?: string;
}) {
  const days = data?.days ?? [];
  const repos = data?.repositories ?? [];
  const series: CompositionChartSeries[] = repos.map((repo, i) => ({
    id: repo.id,
    name: repo.name,
    color: repo.id === OTHER_REPOSITORIES_ID ? OTHER_COLOR : COLORS[i % COLORS.length]!,
    values: repo.values,
  }));
  const rows = days.map((day, i) => ({ day, i })).toReversed();
  return (
    <ChartCard
      className={className}
      title="PRs por repositório"
      description="Como a fila se divide entre os repositórios, no fim de cada dia."
      state={chartState(isLoading, repos.length > 0)}
      summary={summarize(repos, days)}
      empty={HISTORY_EMPTY}
      bodyClassName="min-h-96"
      table={
        <DataTable
          caption="PRs por repositório"
          rows={rows}
          rowKey={(r) => r.day}
          columns={[
            { key: "day", header: "Dia", cell: (r) => formatDayShort(r.day) },
            ...repos.map((repo) => ({
              key: repo.id,
              header: repo.name,
              numeric: true,
              cell: (r: { i: number }) => formatNumber(repo.values[r.i] ?? 0),
            })),
          ]}
        />
      }
    >
      <CompositionChart
        series={series}
        periods={days.map(formatDayShort)}
        formatValue={formatPrs}
        label="PRs por repositório"
      />
    </ChartCard>
  );
}
