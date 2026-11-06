"use client";

import { useId, useState } from "react";
import { UsersIcon } from "lucide-react";
import { BarChart, type BarChartSeries } from "@/components/charts/bar-chart";
import { LineChart, type LineChartSeries } from "@/components/charts/line-chart";
import { ChartCard, chartState, DataTable, HISTORY_EMPTY } from "@/components/dashboard/chart-card";
import { Delta } from "@/components/dashboard/delta";
import { formatDayShort, formatHours, formatNumber, plural } from "@/components/dashboard/format";
import { againstLabel, weekAgoIndex } from "@/components/dashboard/overview-view";
import { SegmentedControl } from "@/components/segmented-control";
import { seriesColor, STAGE_COLORS, STAGE_LABELS } from "@/components/dashboard/series-colors";
import { ShareBar, type ShareSegment } from "@/components/dashboard/share-bar";
import { Sparkline } from "@/components/charts/sparkline";
import { ButtonLink } from "@/components/motion/button/base";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamComparison, type TeamComparisonResponse } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

type Team = TeamComparisonResponse["teams"][number];
type Metric = "open" | "waiting" | "critical" | "closed" | "opened";

const METRICS: { value: Metric; label: string; title: string; description: string }[] = [
  { value: "open", label: "Abertos", title: "PRs abertos", description: "PRs abertos no fim de cada dia, por time." },
  {
    value: "waiting",
    label: "Aguardando",
    title: "Aguardando revisão",
    description: "PRs ainda sem nenhuma revisão no fim de cada dia, por time.",
  },
  {
    value: "critical",
    label: "Críticos",
    title: "PRs críticos",
    description: "PRs acima do SLA crítico do repositório no fim de cada dia, por time.",
  },
  {
    value: "closed",
    label: "Concluídos",
    title: "Concluídos por dia",
    description: "PRs mergeados ou recusados em cada dia, por time.",
  },
  { value: "opened", label: "Novos", title: "Novos por dia", description: "PRs abertos em cada dia, por time." },
];

const formatPrs = (value: number) => plural(value, "PR", "PRs");

function TeamsTrendChart({ data, isLoading }: { data: TeamComparisonResponse | undefined; isLoading: boolean }) {
  const [metric, setMetric] = useState<Metric>("open");
  const selected = METRICS.find((m) => m.value === metric)!;
  const teams = data?.teams ?? [];
  const days = data?.days ?? [];
  const periods = days.map(formatDayShort);
  const series: LineChartSeries[] = teams.map((team, i) => ({
    id: String(team.id),
    name: team.name,
    color: seriesColor(i),
    values: team[metric],
  }));
  const leader = teams.toSorted((a, b) => (b[metric].at(-1) ?? 0) - (a[metric].at(-1) ?? 0))[0];
  const summary = leader
    ? `${selected.title} por time nos últimos ${plural(days.length, "dia", "dias")}. ` +
      `No último dia, ${leader.name} tem o maior valor: ${formatPrs(leader[metric].at(-1) ?? 0)}.`
    : "";

  return (
    <ChartCard
      title="Times lado a lado"
      description={selected.description}
      state={chartState(isLoading, days.length > 0 && teams.length > 0)}
      summary={summary}
      empty={HISTORY_EMPTY}
      actions={
        <SegmentedControl
          label="Medida comparada"
          value={metric}
          onChange={setMetric}
          options={METRICS.map((m) => ({ value: m.value, label: m.label, title: m.title }))}
        />
      }
      table={
        <DataTable
          caption={`${selected.title} por time`}
          rows={days.map((day, i) => ({ day, i })).toReversed()}
          rowKey={(r) => r.day}
          columns={[
            { key: "day", header: "Dia", cell: (r) => formatDayShort(r.day) },
            ...teams.map((team) => ({
              key: String(team.id),
              header: team.name,
              numeric: true,
              cell: (r: { i: number }) => formatNumber(team[metric][r.i] ?? 0),
            })),
          ]}
        />
      }
    >
      <LineChart
        series={series}
        categories={periods}
        variant={teams.length === 1 ? "area" : "line"}
        curve="monotone"
        formatValue={formatPrs}
        formatTick={formatNumber}
        label={`${selected.title} por time`}
      />
    </ChartCard>
  );
}

const STAGES = ["waiting", "inReview", "approved"] as const;

function TeamsStateChart({ data, isLoading }: { data: TeamComparisonResponse | undefined; isLoading: boolean }) {
  const teams = data?.teams ?? [];
  const series: BarChartSeries[] = STAGES.map((stage) => ({
    id: stage,
    name: STAGE_LABELS[stage],
    color: STAGE_COLORS[stage],
    values: teams.map((t) => t.now[stage]),
  }));
  const busiest = teams.toSorted((a, b) => b.now.total - a.now.total)[0];
  return (
    <ChartCard
      title="Fila de cada time agora"
      description="PRs abertos hoje pelo estado da revisão, do time com mais para o com menos."
      state={chartState(isLoading, teams.some((t) => t.now.total > 0))}
      summary={
        busiest
          ? `Fila de cada time hoje. ${busiest.name} tem a maior: ${formatPrs(busiest.now.total)}, ` +
            `${formatNumber(busiest.now.waiting)} aguardando revisão.`
          : ""
      }
      empty={{
        icon: UsersIcon,
        title: "Nenhum PR aberto nos times",
        description: "Quando os membros dos times abrirem PRs nos repositórios monitorados, eles aparecem aqui.",
      }}
      bodyClassName="min-h-48"
      table={
        <DataTable
          caption="Fila de cada time agora"
          rows={teams}
          rowKey={(t) => String(t.id)}
          columns={[
            { key: "name", header: "Time", cell: (t: Team) => t.name },
            ...STAGES.map((stage) => ({
              key: stage,
              header: STAGE_LABELS[stage],
              numeric: true,
              cell: (t: Team) => formatNumber(t.now[stage]),
            })),
            { key: "total", header: "Total", numeric: true, cell: (t: Team) => formatNumber(t.now.total) },
          ]}
        />
      }
    >
      <BarChart
        series={series}
        categories={teams.map((t) => t.name)}
        layout="stacked"
        orientation="horizontal"
        sort="descending"
        formatValue={formatPrs}
        formatTick={formatNumber}
        label="Fila de cada time agora"
      />
    </ChartCard>
  );
}

function health(team: Team) {
  if (team.now.critical > 0)
    return { label: plural(team.now.critical, "crítico", "críticos"), className: "bg-destructive/12 text-destructive-foreground" };
  if (team.now.warning > 0) return { label: "Em atenção", className: "bg-warning/15 text-warning-foreground" };
  if (team.now.total === 0) return { label: "Fila zerada", className: "bg-success/12 text-success-foreground" };
  return { label: "No prazo", className: "bg-success/12 text-success-foreground" };
}

function TeamStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function TeamScoreCard({ team, color, days }: { team: Team; color: string; days: string[] }) {
  const ref = team.open[weekAgoIndex(team.open.length)];
  const status = health(team);
  const stages: ShareSegment[] = STAGES.map((stage) => ({
    id: stage,
    label: STAGE_LABELS[stage],
    value: team.now[stage],
    color: STAGE_COLORS[stage],
  }));
  return (
    <article
      aria-label={team.name}
      className="relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-4"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: color }} />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-16 size-40 rounded-full opacity-[0.1] blur-2xl"
        style={{ backgroundColor: color }}
      />
      <header className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="truncate text-sm font-medium">{team.name}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {plural(team.members, "pessoa", "pessoas")}
        </span>
        <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>
          {status.label}
        </span>
      </header>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
            {formatNumber(team.now.total)}
          </span>
          <span className="text-xs text-muted-foreground">{team.now.total === 1 ? "PR aberto" : "PRs abertos"}</span>
        </div>
        <Delta
          current={days.length >= 2 ? team.now.total : null}
          previous={ref ?? null}
          better="down"
          against={againstLabel(days)}
        />
      </div>
      <Sparkline
        data={team.open}
        label={`Fila aberta de ${team.name}`}
        variant="area"
        color={color}
        interactive
        formatValue={formatNumber}
      />
      <ShareBar segments={stages} label={`Fila de ${team.name} pelo estado da revisão`} />
      <dl className="grid grid-cols-3 gap-3 border-t pt-3">
        <TeamStat label="Aguardando" value={formatNumber(team.now.waiting)} />
        <TeamStat
          label="1ª revisão"
          value={team.stats.firstReviewMedianHours === null ? "—" : formatHours(team.stats.firstReviewMedianHours)}
        />
        <TeamStat label="Concluídos" value={formatNumber(team.stats.closed)} />
      </dl>
    </article>
  );
}

export function TeamsView({ range }: { range: number }) {
  const { data, isLoading, isError } = useTeamComparison(range);
  const loading = isLoading && !isError;
  const teams = data?.teams ?? [];
  const boardTitleId = useId();

  if (!loading && data && teams.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nenhum time criado</EmptyTitle>
          <EmptyDescription>
            Crie times com membros e repositórios para comparar como cada um está na fila de revisão.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ButtonLink href="/config" variant="outline" size="sm">
            Criar times na Configuração
          </ButtonLink>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isError && !data ? (
        <p role="alert" className="text-sm text-destructive-foreground">
          Não foi possível carregar a comparação entre times. Uma nova tentativa é feita a cada minuto.
        </p>
      ) : null}
      <TeamsTrendChart data={data} isLoading={loading} />
      <section aria-labelledby={boardTitleId} className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={boardTitleId} className="text-sm font-medium">
            Placar dos times
          </h2>
          <p className="text-xs text-muted-foreground">Fila de hoje e medidas dos últimos {range} dias</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
            : teams.map((team, i) => (
                <TeamScoreCard key={team.id} team={team} color={seriesColor(i)} days={data?.days ?? []} />
              ))}
        </div>
      </section>
      <TeamsStateChart data={data} isLoading={loading} />
    </div>
  );
}
