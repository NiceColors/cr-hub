"use client";

import { useId, useState, type ReactNode } from "react";
import {
  BlocksIcon,
  GitMergeIcon,
  LinkIcon,
  RocketIcon,
  ShapesIcon,
} from "lucide-react";
import { BarChart, type BarChartSeries } from "@/components/charts/bar-chart";
import { ChartCard, chartState, DataTable } from "@/components/dashboard/chart-card";
import { formatDayShort, formatHours, formatNumber, plural } from "@/components/dashboard/format";
import { KpiStrip, type Kpi } from "@/components/dashboard/kpi-card";
import { SegmentedControl } from "@/components/segmented-control";
import {
  MUTED_SERIES,
  STAGE_COLORS,
  STAGE_LABELS,
  WORK_KIND_COLORS,
  WORK_KIND_LABELS,
} from "@/components/dashboard/series-colors";
import { ShareBar, ShareLegend, type ShareSegment } from "@/components/dashboard/share-bar";
import { AvatarGroup } from "@/components/motion/avatar-group";
import { ButtonLink } from "@/components/motion/button/base";
import { PROJECT_KIND_ICONS } from "@/components/projects/project-kind";
import { RelativeTime } from "@/components/relative-time";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { UNLINKED_KIND } from "@/domain/dashboard-features";
import { PROJECT_STATUS_LABELS } from "@/domain/project";
import { useFeatureBoard, type FeatureBoardResponse } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

type Feature = FeatureBoardResponse["features"][number];
type StatusFilter = "active" | "done" | "all";

const formatPrs = (value: number) => plural(value, "CR", "CRs");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

function featureKpis(data: FeatureBoardResponse | undefined, range: number): Kpi[] {
  const features = data?.features ?? [];
  const deliveries = data?.deliveries ?? [];
  const days = data?.days ?? [];
  const linked = deliveries.filter((d) => d.id !== UNLINKED_KIND);
  const linkedPerDay = days.map((_, i) => sum(linked.map((d) => d.values[i] ?? 0)));
  const allPerDay = days.map((_, i) => sum(deliveries.map((d) => d.values[i] ?? 0)));
  const linkedTotal = sum(linkedPerDay);
  const allTotal = sum(allPerDay);
  const openLinked = sum(
    (data?.openByKind ?? []).filter((q) => q.id !== UNLINKED_KIND).map((q) => q.total),
  );
  const active = features.filter((f) => f.status === "active");
  return [
    {
      label: "Em andamento",
      icon: RocketIcon,
      value: data ? active.length : null,
      color: "var(--series-1)",
      hint: data ? `${plural(features.length - active.length, "concluído", "concluídos")}` : undefined,
    },
    {
      label: "CRs abertos em projetos",
      icon: BlocksIcon,
      value: data ? openLinked : null,
      color: "var(--series-3)",
      hint: "aguardando, em revisão ou aprovados",
    },
    {
      label: "Entregas de projetos",
      icon: GitMergeIcon,
      value: data ? linkedTotal : null,
      color: "var(--success)",
      spark: linkedPerDay,
      hint: `CRs concluídos em ${range} dias`,
    },
    {
      label: "Entregas com projeto",
      icon: LinkIcon,
      value: data && allTotal > 0 ? linkedTotal / allTotal : null,
      format: (v) => percent.format(v),
      color: "var(--series-5)",
      spark: allPerDay.map((all, i) => (all > 0 ? linkedPerDay[i]! / all : null)),
      hint: allTotal > 0 ? `${formatNumber(linkedTotal)} de ${formatNumber(allTotal)} concluídos` : "nada concluído",
    },
  ];
}

function DeliveriesChart({
  data,
  isLoading,
  className,
}: {
  data: FeatureBoardResponse | undefined;
  isLoading: boolean;
  className?: string;
}) {
  const days = data?.days ?? [];
  const deliveries = data?.deliveries ?? [];
  const series: BarChartSeries[] = deliveries.map((d) => ({
    id: d.id,
    name: WORK_KIND_LABELS[d.id],
    color: WORK_KIND_COLORS[d.id],
    values: d.values,
  }));
  const totals = deliveries.map((d) => ({ id: d.id, total: sum(d.values) }));
  const all = sum(totals.map((t) => t.total));
  const top = totals.filter((t) => t.id !== UNLINKED_KIND).toSorted((a, b) => b.total - a.total)[0];
  return (
    <ChartCard
      className={className}
      title="Entregas por tipo de trabalho"
      description="CRs concluídos por dia, pelo tipo do projeto a que estão vinculados."
      state={chartState(isLoading, all > 0)}
      summary={
        top
          ? `Entregas por tipo de trabalho nos últimos ${plural(days.length, "dia", "dias")}: ` +
            `${formatPrs(all)} concluídos; ${WORK_KIND_LABELS[top.id]} lidera com ${formatNumber(top.total)}.`
          : `${formatPrs(all)} concluídos, nenhum vinculado a projeto.`
      }
      empty={{
        icon: GitMergeIcon,
        title: "Nenhuma entrega no período",
        description: "Os CRs aparecem aqui conforme são mergeados ou recusados.",
      }}
      table={
        <DataTable
          caption="Entregas por tipo de trabalho"
          rows={days.map((day, i) => ({ day, i })).toReversed()}
          rowKey={(r) => r.day}
          columns={[
            { key: "day", header: "Dia", cell: (r) => formatDayShort(r.day) },
            ...deliveries.map((d) => ({
              key: d.id,
              header: WORK_KIND_LABELS[d.id],
              numeric: true,
              cell: (r: { i: number }) => formatNumber(d.values[r.i] ?? 0),
            })),
          ]}
        />
      }
    >
      <BarChart
        series={series}
        categories={days.map(formatDayShort)}
        layout="stacked"
        formatValue={formatPrs}
        formatTick={formatNumber}
        label="Entregas por tipo de trabalho"
      />
    </ChartCard>
  );
}

function QueueByKindCard({ data, isLoading }: { data: FeatureBoardResponse | undefined; isLoading: boolean }) {
  const titleId = useId();
  const queues = data?.openByKind ?? [];
  const segments: ShareSegment[] = queues.map((q) => ({
    id: q.id,
    label: WORK_KIND_LABELS[q.id],
    value: q.total,
    color: WORK_KIND_COLORS[q.id],
  }));
  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isLoading}
      className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <header className="flex flex-col gap-1">
        <h2 id={titleId} className="text-sm font-medium">
          Fila por tipo de trabalho
        </h2>
        <p className="text-xs text-muted-foreground">Onde está o esforço de revisão agora.</p>
      </header>
      {isLoading ? (
        <div aria-hidden className="flex flex-col gap-3">
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : queues.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum CR aberto no momento.</p>
      ) : (
        <>
          <ShareBar segments={segments} label="CRs abertos por tipo de trabalho" />
          <ShareLegend segments={segments} />
          <ul className="mt-auto flex flex-col gap-2 border-t pt-3">
            {queues.map((q) => (
              <li key={q.id} className="flex flex-col gap-1">
                <span className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{WORK_KIND_LABELS[q.id]}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {formatNumber(q.waiting)} · {formatNumber(q.inReview)} · {formatNumber(q.approved)}
                  </span>
                </span>
                <ShareBar
                  className="h-1.5"
                  label={`${WORK_KIND_LABELS[q.id]} pelo estado da revisão`}
                  segments={(["waiting", "inReview", "approved"] as const).map((stage) => ({
                    id: stage,
                    label: STAGE_LABELS[stage],
                    value: q[stage],
                    color: STAGE_COLORS[stage],
                  }))}
                />
              </li>
            ))}
            <li aria-hidden className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
              {(["waiting", "inReview", "approved"] as const).map((stage) => (
                <span key={stage} className="inline-flex items-center gap-1">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[stage] }} />
                  {STAGE_LABELS[stage]}
                </span>
              ))}
            </li>
          </ul>
        </>
      )}
    </section>
  );
}

const FEATURE_STAGES = ["closed", "approved", "inReview", "waiting", "untracked"] as const;

/** Lida como progresso: só o concluído é sólido, o resto vai clareando. */
const FEATURE_STAGE_COLORS: Record<(typeof FEATURE_STAGES)[number], string> = {
  closed: "var(--success)",
  approved: "color-mix(in oklch, var(--success) 45%, transparent)",
  inReview: "var(--chart-3)",
  waiting: "color-mix(in oklch, var(--chart-1) 50%, transparent)",
  untracked: MUTED_SERIES,
};

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-xs tabular-nums">{value}</dd>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = PROJECT_KIND_ICONS[feature.kind];
  const color = WORK_KIND_COLORS[feature.kind];
  const done = feature.status === "done";
  const progress = feature.total > 0 ? feature.stages.closed / feature.total : 0;
  const segments: ShareSegment[] = FEATURE_STAGES.map((stage) => ({
    id: stage,
    label: STAGE_LABELS[stage],
    value: feature.stages[stage],
    color: FEATURE_STAGE_COLORS[stage],
  }));
  return (
    <article
      aria-label={feature.name}
      className={cn(
        "relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-4",
        done && "bg-card/60",
      )}
    >
      <header className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`, color }}
        >
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-sm font-medium" title={feature.name}>
            {feature.name}
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{WORK_KIND_LABELS[feature.kind]}</span>
            <span aria-hidden>·</span>
            <span>{formatPrs(feature.total)}</span>
            {feature.lastActivityAt ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  ativo <RelativeTime iso={new Date(feature.lastActivityAt).toISOString()} />
                </span>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            done ? "bg-success/12 text-success-foreground" : "bg-primary/12 text-info-foreground",
          )}
        >
          {done ? PROJECT_STATUS_LABELS.done : "Em andamento"}
        </span>
      </header>

      <div className="flex flex-col gap-1.5">
        {feature.total > 0 ? (
          <>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">
                {formatNumber(feature.stages.closed)} de {formatPrs(feature.total)} concluídos
              </span>
              <span className="font-mono font-medium tabular-nums">{percent.format(progress)}</span>
            </div>
            <ShareBar segments={segments} label={`Andamento dos CRs de ${feature.name}`} />
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">Nenhum CR vinculado</span>
            <div aria-hidden className="h-2.5 rounded-full border border-dashed" />
          </>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3 border-t pt-3">
        <Meta
          label="Aberto há mais tempo"
          value={feature.oldestOpenHours === null ? "—" : formatHours(feature.oldestOpenHours)}
        />
        <Meta
          label="Ciclo mediano"
          value={feature.cycleMedianHours === null ? "—" : formatHours(feature.cycleMedianHours)}
        />
        <Meta label="Rodadas de ajuste" value={formatNumber(feature.changesCycles)} />
      </dl>

      {feature.repos.length > 0 || feature.authors.length > 0 ? (
        <footer className="flex min-w-0 items-center justify-between gap-3">
          <ul className="flex min-w-0 flex-wrap gap-1" aria-label="Repositórios">
            {feature.repos.slice(0, 3).map((repo) => (
              <li
                key={repo}
                className="max-w-36 truncate rounded-full border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {repo}
              </li>
            ))}
            {feature.repos.length > 3 ? (
              <li className="rounded-full px-1 py-0.5 text-[11px] text-muted-foreground">
                +{feature.repos.length - 3}
              </li>
            ) : null}
          </ul>
          <AvatarGroup
            label="Autores"
            size="sm"
            max={4}
            members={feature.authors.map((author) => ({ id: author, name: author }))}
            className="shrink-0"
          />
        </footer>
      ) : null}
    </article>
  );
}

function FeatureBoardSection({ features, isLoading }: { features: Feature[]; isLoading: boolean }) {
  const titleId = useId();
  const [filter, setFilter] = useState<StatusFilter>("active");
  const counts = {
    active: features.filter((f) => f.status === "active").length,
    done: features.filter((f) => f.status === "done").length,
  };
  const shown = filter === "all" ? features : features.filter((f) => f.status === filter);
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-sm font-medium">
            Projetos e features
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Andamento dos CRs vinculados a cada um:</span>
            {FEATURE_STAGES.slice(0, 4).map((stage) => (
              <span key={stage} className="inline-flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: FEATURE_STAGE_COLORS[stage] }}
                />
                {STAGE_LABELS[stage]}
              </span>
            ))}
          </p>
        </div>
        <SegmentedControl
          label="Situação dos projetos"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: `Ativos ${counts.active}` },
            { value: "done", label: `Concluídos ${counts.done}` },
            { value: "all", label: "Todos" },
          ]}
        />
      </div>
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {filter === "done" ? "Nenhum projeto concluído ainda." : "Nenhum projeto ativo no momento."}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      )}
    </section>
  );
}

export function FeaturesView({ teamId, range }: { teamId: number | null; range: number }) {
  const { data, isLoading, isError } = useFeatureBoard(teamId, range);
  const loading = isLoading && !isError;
  const features = data?.features ?? [];

  if (!loading && data && features.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShapesIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{teamId ? "Nenhum projeto com CRs deste time" : "Nenhum projeto ainda"}</EmptyTitle>
          <EmptyDescription>
            Crie projetos e features na Fila de CRs e vincule os CRs a eles para acompanhar o andamento
            de cada entrega aqui.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ButtonLink href="/" variant="outline" size="sm">
            Abrir a Fila de CRs
          </ButtonLink>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isError && !data ? (
        <p role="alert" className="text-sm text-destructive-foreground">
          Não foi possível carregar os projetos. Uma nova tentativa é feita a cada minuto.
        </p>
      ) : null}
      <KpiStrip items={featureKpis(data, range)} isLoading={loading} className="lg:grid-cols-4" />
      <div className="grid gap-4 lg:grid-cols-3">
        <DeliveriesChart data={data} isLoading={loading} className="lg:col-span-2" />
        <QueueByKindCard data={data} isLoading={loading} />
      </div>
      <FeatureBoardSection features={features} isLoading={loading} />
    </div>
  );
}
