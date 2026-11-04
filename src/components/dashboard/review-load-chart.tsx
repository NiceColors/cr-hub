"use client";

import { useMemo } from "react";
import { UsersRoundIcon } from "lucide-react";
import { BumpChart } from "@/components/charts/bump-chart";
import { ChartCard, chartState, DataTable } from "@/components/dashboard/chart-card";
import { formatDayShort, formatNumber, plural } from "@/components/dashboard/format";
import { recentDayBuckets, reviewRanking, type RankingSeries } from "@/domain/dashboard";
import { useMembers, useSettings, useTeams } from "@/hooks/use-config";
import { usePullRequests } from "@/hooks/use-pull-requests";

const DAYS = 10;

const formatPending = (value: number) => plural(value, "revisão pendente", "revisões pendentes");

function summarize(series: RankingSeries[]) {
  const ranked = series
    .map((s) => ({ name: s.name, value: s.values.at(-1) ?? 0 }))
    .filter((s) => s.value > 0);
  if (ranked.length === 0) return "";
  const [first, second] = ranked;
  return (
    `Ranking de revisões pendentes por pessoa nos últimos ${DAYS} dias. ` +
    `Hoje, ${first!.name} lidera com ${formatPending(first!.value)}` +
    (second ? `, seguido de ${second.name} com ${formatNumber(second.value)}.` : ".")
  );
}

export function ReviewLoadChart({ teamId }: { teamId: number | null }) {
  const settings = useSettings();
  const membersQuery = useMembers();
  const teamsData = useTeams().data;
  const { query } = usePullRequests({
    teamId,
    refreshIntervalSec: settings.data?.pollIntervalSeconds ?? 30,
  });

  const { series, days } = useMemo(() => {
    const data = query.data;
    if (!data || !membersQuery.data) return { series: [], days: [] };
    const team = teamId ? teamsData?.teams.find((t) => t.id === teamId) : null;
    const scope = team ? new Set(team.memberUuids) : null;
    const members = membersQuery.data.members.filter(
      (m) => m.monitored && (!scope || scope.has(m.uuid)),
    );
    const buckets = recentDayBuckets(query.dataUpdatedAt, DAYS);
    return {
      series: reviewRanking(
        data.pullRequests.filter((pr) => pr.authorMonitored),
        members,
        buckets.map((b) => b.cutoffMs),
      ),
      days: buckets.map((b) => b.day),
    };
  }, [query.data, query.dataUpdatedAt, membersQuery.data, teamsData, teamId]);

  const periods = days.map(formatDayShort);
  return (
    <ChartCard
      title="Carga de revisão por pessoa"
      description="Quem tem mais revisões pendentes hoje e como essa fila se acumulou, pelo dia em que cada PR foi aberto."
      state={chartState(query.isLoading || membersQuery.isLoading, series.length > 0)}
      summary={summarize(series)}
      empty={{
        icon: UsersRoundIcon,
        title: "Ninguém com revisões pendentes",
        description: "Nenhum membro monitorado está como revisor de um PR aberto sem ter revisado.",
      }}
      bodyClassName="min-h-72"
      table={
        <DataTable
          caption="Revisões pendentes por pessoa e dia (posição entre parênteses)"
          rows={series}
          rowKey={(s) => s.id}
          columns={[
            { key: "name", header: "Pessoa", cell: (s: RankingSeries) => s.name },
            ...periods.map((period, i) => ({
              key: days[i]!,
              header: period,
              numeric: true,
              cell: (s: RankingSeries) =>
                s.ranks[i] == null
                  ? "—"
                  : `${formatNumber(s.values[i]!)} (${s.ranks[i]}º)`,
            })),
          ]}
        />
      }
    >
      <BumpChart
        series={series}
        periods={periods}
        formatValue={formatPending}
        label="Carga de revisão por pessoa"
        className="mx-auto max-w-3xl"
      />
    </ChartCard>
  );
}
