"use client";

import type { ReactNode } from "react";
import { DonutChart, DonutChartCenter, DonutChartLegend, DonutChartPlot } from "@/components/charts/donut-chart";
import { FunnelChart, FunnelChartPlot, FunnelChartSummary } from "@/components/charts/funnel-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { Delta } from "@/components/dashboard/delta";
import { formatDayShort, formatHours, formatNumber, plural } from "@/components/dashboard/format";
import { AGE_COLORS } from "@/components/dashboard/series-colors";
import { RiskBadges } from "@/components/lead/lead-badges";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/motion/card";
import { NotificationStack } from "@/components/motion/notification-stack";
import { RelativeTime } from "@/components/relative-time";
import type { LeadOverviewResponse } from "@/hooks/use-lead-overview";

type Summary = LeadOverviewResponse["summary"];

const formatCount = (value: number) => formatNumber(Math.round(value));

function Kpi({
  label,
  value,
  format = formatCount,
  hint,
  trend,
}: {
  label: string;
  value: number | null;
  format?: (value: number) => string;
  hint?: ReactNode;
  trend?: ReactNode;
}) {
  return (
    <Card size="compact" className="min-w-0 gap-2">
      <CardHeader className="gap-1">
        <CardDescription className="truncate text-xs">{label}</CardDescription>
        <CardTitle className="font-mono text-2xl tabular-nums">
          {value === null ? "—" : <AnimatedNumber value={value} format={format} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-8 flex-col justify-end gap-1 text-xs text-muted-foreground">
        {trend}
        {hint}
      </CardContent>
    </Card>
  );
}

function KpiGrid({ data }: { data: LeadOverviewResponse }) {
  const { counts, period, series } = data.summary;
  const labels = data.days.map(formatDayShort);
  const against = `${plural(data.days.length, "dia", "dias")} anteriores`;
  const spark = (values: number[], label: string, invert = false) =>
    values.length > 1 ? (
      <Sparkline
        data={values}
        labels={labels}
        label={label}
        height={28}
        variant="area"
        showDelta
        invertDelta={invert}
        interactive
        className="text-foreground"
      />
    ) : null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi
        label="PRs abertos"
        value={counts.open}
        trend={spark(series.open, "PRs abertos por dia", true)}
      />
      <Kpi
        label="Acima do SLA crítico"
        value={counts.critical}
        trend={spark(series.critical, "PRs críticos por dia", true)}
      />
      <Kpi
        label="Sem revisor"
        value={counts.noReviewers}
        hint={counts.noReviewers > 0 ? "Indique alguém para revisar." : "Todos têm revisor."}
      />
      <Kpi
        label="Aprovados parados"
        value={counts.approvedIdle}
        hint="Aprovados há mais de 24h e ainda abertos."
      />
      <Kpi
        label="Entregues no período"
        value={period.current.closed}
        trend={spark(series.closed, "PRs concluídos por dia")}
        hint={
          <Delta
            current={period.current.closed}
            previous={period.previous?.closed ?? null}
            better="up"
            against={against}
          />
        }
      />
      <Kpi
        label="Ciclo mediano"
        value={period.current.cycleMedianHours}
        format={formatHours}
        hint={
          period.previous ? (
            <Delta
              current={period.current.cycleMedianHours}
              previous={period.previous.cycleMedianHours}
              better="down"
              against={against}
              format={formatHours}
            />
          ) : (
            "Da abertura à conclusão."
          )
        }
      />
    </div>
  );
}

function QueueHealth({ summary }: { summary: Summary }) {
  const segments = [
    { id: "normal", name: "No prazo", color: AGE_COLORS.normal, value: summary.ageBands.normal },
    { id: "warning", name: "Em atenção", color: AGE_COLORS.warning, value: summary.ageBands.warning },
    { id: "critical", name: "Crítico", color: AGE_COLORS.critical, value: summary.ageBands.critical },
  ];
  const total = summary.counts.open;
  return (
    <Card size="compact">
      <CardHeader>
        <CardTitle>Saúde da fila</CardTitle>
        <CardDescription>PRs abertos agora em cada faixa do SLA do repositório.</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum PR aberto no escopo.</p>
        ) : (
          <DonutChart
            segments={segments}
            formatValue={(v) => plural(v, "PR", "PRs")}
            label={`Saúde da fila: ${summary.ageBands.normal} no prazo, ${summary.ageBands.warning} em atenção e ${summary.ageBands.critical} críticos.`}
          >
            <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <DonutChartPlot>
                <DonutChartCenter totalLabel="abertos" />
              </DonutChartPlot>
              <DonutChartLegend />
            </div>
          </DonutChart>
        )}
      </CardContent>
    </Card>
  );
}

function DeliveryFunnelCard({ summary, days }: { summary: Summary; days: number }) {
  const { funnel } = summary;
  return (
    <Card size="compact">
      <CardHeader>
        <CardTitle>Funil de entrega</CardTitle>
        <CardDescription>
          Dos PRs abertos nos últimos {plural(days, "dia", "dias")}, quantos já avançaram em cada etapa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {funnel.opened === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum PR aberto no período ainda.
          </p>
        ) : (
          <FunnelChart
            direction="horizontal"
            unit="PRs"
            label="Funil de entrega"
            formatValue={formatNumber}
            stages={[
              { id: "opened", label: "Abertos", value: funnel.opened, color: "var(--chart-1)" },
              { id: "reviewed", label: "Revisados", value: funnel.reviewed, color: "var(--chart-3)" },
              { id: "approved", label: "Aprovados", value: funnel.approved, color: "var(--success)" },
              {
                id: "closed",
                label: "Concluídos",
                value: funnel.closed,
                color: "color-mix(in oklch, var(--success) 55%, var(--muted-foreground))",
              },
            ]}
          >
            <FunnelChartPlot />
            <FunnelChartSummary />
          </FunnelChart>
        )}
      </CardContent>
    </Card>
  );
}

function AttentionNow({
  data,
  onViewAll,
}: {
  data: LeadOverviewResponse;
  onViewAll: () => void;
}) {
  const items = data.attention.map((pr) => ({
    id: pr.key,
    title: pr.title,
    description: (
      <span className="flex flex-col gap-1.5">
        <span className="truncate">
          {pr.repository.slug} #{pr.id} · {pr.author.displayName}
        </span>
        <RiskBadges risks={pr.risks} tooltip={false} />
      </span>
    ),
    trailing: <RelativeTime iso={pr.createdOn} className="text-muted-foreground" />,
  }));
  return (
    <Card size="compact" variant="muted" className="gap-3">
      <CardHeader>
        <CardTitle>Atenção agora</CardTitle>
        <CardDescription>
          {data.summary.counts.flagged > 0
            ? `${plural(data.summary.counts.flagged, "PR pede", "PRs pedem")} ação. Passe o mouse ou foque para ver os mais graves.`
            : "Nenhum PR com sinal de risco no escopo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-3">
        <NotificationStack
          items={items}
          maxVisible={5}
          onViewAll={onViewAll}
          collapsedLabel="Atenção agora"
          expandedLabel="Ver todos na aba PRs"
          emptyLabel="Nada pedindo ação"
          className="max-w-none"
          classNames={{ count: "bg-destructive dark:bg-destructive" }}
        />
      </CardContent>
    </Card>
  );
}

export function SummaryTab({
  data,
  onViewAttention,
}: {
  data: LeadOverviewResponse;
  onViewAttention: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid data={data} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AttentionNow data={data} onViewAll={onViewAttention} />
        <QueueHealth summary={data.summary} />
      </div>
      <DeliveryFunnelCard summary={data.summary} days={data.days.length} />
    </div>
  );
}
