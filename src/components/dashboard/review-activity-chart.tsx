"use client";

import { CalendarDaysIcon } from "lucide-react";
import { HeatCalendar } from "@/components/charts/heat-calendar";
import { ChartCard, chartState, DataTable } from "@/components/dashboard/chart-card";
import { formatDayLong, formatDayShort, formatNumber, plural } from "@/components/dashboard/format";
import { heatCalendarGrid } from "@/domain/dashboard";
import type { DashboardResponse } from "@/hooks/use-dashboard";

const WEEKS = 52;

export function ReviewActivityChart({
  data,
  isLoading,
}: {
  data: DashboardResponse | undefined;
  isLoading: boolean;
}) {
  const grid = data ? heatCalendarGrid(data.activity.counts, data.activity.today, WEEKS) : null;
  const days = data
    ? Object.entries(data.activity.counts)
        .filter(([day, count]) => count > 0 && grid && day >= grid.startDay)
        .toSorted(([a], [b]) => b.localeCompare(a))
    : [];
  const summary = grid?.busiest
    ? `Atividade de revisão nas últimas ${WEEKS} semanas: ` +
      `${plural(grid.total, "PR recebeu", "PRs receberam")} a primeira revisão em ` +
      `${plural(grid.activeDays, "dia", "dias")}. Dia mais ativo: ` +
      `${formatDayLong(grid.busiest.day)}, com ${formatNumber(grid.busiest.count)}.`
    : "";

  return (
    <ChartCard
      title="Atividade de revisão"
      description="PRs que receberam a primeira revisão em cada dia. Mostra a cadência do time."
      state={chartState(isLoading, (grid?.total ?? 0) > 0)}
      summary={summary}
      empty={{
        icon: CalendarDaysIcon,
        title: "Nenhuma primeira revisão nas últimas semanas",
        description:
          "Os dias aparecem conforme o CR Tracker vê PRs recebendo a primeira revisão durante as atualizações da fila.",
      }}
      bodyClassName="min-h-56"
      table={
        <DataTable
          caption="PRs com a primeira revisão por dia"
          rows={days}
          rowKey={([day]) => day}
          columns={[
            { key: "day", header: "Dia", cell: ([day]) => formatDayShort(day) },
            { key: "count", header: "PRs", numeric: true, cell: ([, count]) => formatNumber(count) },
          ]}
        />
      }
    >
      {grid ? (
        <div className="flex justify-center overflow-x-auto pb-1">
          <HeatCalendar
            weeks={WEEKS}
            values={grid.values}
            maxCount={grid.maxCount}
            endDate={grid.endDate}
            unit="PRs revisados"
            unitOne="PR revisado"
            color="var(--primary)"
          />
        </div>
      ) : null}
    </ChartCard>
  );
}
