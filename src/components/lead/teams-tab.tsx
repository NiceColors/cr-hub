"use client";

import { useMemo } from "react";
import { UsersRoundIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { StatusBar, StatusBarPlot, StatusBarTooltip } from "@/components/charts/status-bar";
import { formatDayShort, formatHours, formatNumber, plural } from "@/components/dashboard/format";
import { HEALTH_COLORS, HealthBadge } from "@/components/lead/lead-badges";
import { AvatarGroup } from "@/components/motion/avatar-group";
import { ButtonLink } from "@/components/motion/button/base";
import {
  Card,
  CARD_TARGET_CLASS,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/motion/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { HEALTH_LABELS, type HealthStatus } from "@/domain/lead";
import { useMembers } from "@/hooks/use-config";
import type { LeadTeam } from "@/hooks/use-lead-overview";
import { useOnCall } from "@/hooks/use-on-call";
import { cn } from "@/lib/utils";

const HEALTH_STATUSES = (["ok", "attention", "critical"] as const).map((id) => ({
  id,
  label: HEALTH_LABELS[id],
  color: HEALTH_COLORS[id],
}));

const STATUS_ORDER: Record<HealthStatus, number> = { critical: 0, attention: 1, ok: 2 };

function Count({ label, value, tone }: { label: string; value: number; tone?: "warning" | "danger" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-lg tabular-nums",
          value === 0 && "text-muted-foreground",
          value > 0 && tone === "warning" && "text-warning-foreground",
          value > 0 && tone === "danger" && "text-destructive",
        )}
      >
        {formatNumber(value)}
      </dd>
    </div>
  );
}

function TeamCard({
  team,
  days,
  selected,
  onSelect,
  people,
  onCallUuid,
}: {
  team: LeadTeam;
  days: string[];
  selected: boolean;
  onSelect: () => void;
  people: Map<string, { name: string; src?: string }>;
  onCallUuid: string | null;
}) {
  const labels = days.map(formatDayShort);
  const members = team.memberUuids.flatMap((uuid) => {
    const person = people.get(uuid);
    return person ? [{ id: uuid, name: uuid === onCallUuid ? `${person.name} (plantão hoje)` : person.name, src: person.src }] : [];
  });
  const onCallFirst = members.toSorted((a, b) => Number(b.id === onCallUuid) - Number(a.id === onCallUuid));
  const onCall = onCallUuid ? people.get(onCallUuid) : null;

  return (
    <Card interactive selected={selected} size="compact" className="min-w-0">
      <CardHeader>
        <CardTitle className="truncate">
          <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className={cn(CARD_TARGET_CLASS, "text-left outline-none")}
          >
            {team.name}
          </button>
        </CardTitle>
        <CardDescription>
          {plural(team.memberUuids.length, "pessoa", "pessoas")}
          {onCall ? ` · plantão: ${onCall.name}` : ""}
        </CardDescription>
        <CardAction>
          <HealthBadge status={team.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-4 gap-2">
          <Count label="Abertos" value={team.counts.open} />
          <Count label="Críticos" value={team.counts.critical} tone="danger" />
          <Count label="Sem revisor" value={team.counts.noReviewers} tone="warning" />
          <Count label="Aprov. parados" value={team.counts.approvedIdle} tone="warning" />
        </dl>
        <div className="relative z-10 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] text-muted-foreground">
              Entregas por dia · {formatNumber(team.stats.closed)} no período
            </p>
            {team.closed.length > 1 ? (
              <Sparkline
                data={team.closed}
                labels={labels}
                label={`Entregas por dia de ${team.name}`}
                variant="area"
                height={32}
                interactive
                className="text-foreground"
              />
            ) : (
              <p className="text-xs text-muted-foreground">Sem histórico suficiente.</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Ciclo mediano</p>
            <p className="font-mono text-sm tabular-nums">
              {team.stats.cycleMedianHours === null ? "—" : formatHours(team.stats.cycleMedianHours)}
            </p>
          </div>
        </div>
        {team.daily.length > 0 ? (
          <StatusBar
            className="relative z-10 space-y-1"
            label={`Saúde diária de ${team.name}`}
            statuses={HEALTH_STATUSES}
            data={team.daily.map((d) => ({
              id: d.day,
              label: formatDayShort(d.day),
              status: d.status,
              description: `${plural(d.open, "PR aberto", "PRs abertos")}, ${plural(d.critical, "crítico", "críticos")}`,
            }))}
          >
            <StatusBarPlot barClassName="h-5" />
            <StatusBarTooltip />
          </StatusBar>
        ) : null}
      </CardContent>
      {members.length > 0 ? (
        <CardFooter className="relative z-10">
          <AvatarGroup members={onCallFirst} size="sm" max={6} label={`Pessoas de ${team.name}`} />
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function TeamsTab({
  teams,
  days,
  teamId,
  onTeamChange,
}: {
  teams: LeadTeam[];
  days: string[];
  teamId: number | null;
  onTeamChange: (teamId: number | null) => void;
}) {
  const members = useMembers().data?.members;
  const { entries } = useOnCall();
  const people = useMemo(
    () =>
      new Map(
        (members ?? []).map((m) => [m.uuid, { name: m.displayName, src: m.avatarUrl ?? undefined }]),
      ),
    [members],
  );
  const onCallByTeam = useMemo(() => new Map(entries.map((e) => [e.teamId, e.today.uuid])), [entries]);
  const ordered = useMemo(
    () =>
      teams.toSorted(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          b.counts.critical - a.counts.critical ||
          a.name.localeCompare(b.name, "pt-BR"),
      ),
    [teams],
  );

  if (teams.length === 0) {
    return (
      <Empty className="rounded-2xl border border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersRoundIcon />
          </EmptyMedia>
          <EmptyTitle>Nenhum time cadastrado</EmptyTitle>
          <EmptyDescription>
            Crie times com pessoas e repositórios para acompanhar a saúde de cada um.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ButtonLink href="/config" variant="outline" size="sm">
            Abrir Configuração
          </ButtonLink>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {teamId === null
          ? "Escolha um time para filtrar as outras abas por ele."
          : "Filtrando as outras abas pelo time selecionado. Clique de novo para ver todos."}
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            days={days}
            selected={team.id === teamId}
            onSelect={() => onTeamChange(team.id === teamId ? null : team.id)}
            people={people}
            onCallUuid={onCallByTeam.get(team.id) ?? null}
          />
        ))}
      </div>
    </div>
  );
}
