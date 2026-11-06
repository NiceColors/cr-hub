"use client";

import { useMemo, useState } from "react";
import { ArrowUpRightIcon, BlocksIcon } from "lucide-react";
import { formatHours, formatNumber, plural } from "@/components/dashboard/format";
import { STAGE_COLORS, STAGE_LABELS } from "@/components/dashboard/series-colors";
import { ShareBar, ShareLegend, type ShareSegment } from "@/components/dashboard/share-bar";
import { RiskBadges } from "@/components/lead/lead-badges";
import { PROJECT_KIND_ICONS } from "@/components/projects/project-kind";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { AvatarGroup } from "@/components/motion/avatar-group";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { ButtonLink } from "@/components/motion/button/base";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Timeline } from "@/components/motion/timeline";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { LEAD_LIMITS, type TimelineKind } from "@/domain/lead";
import { PROJECT_KIND_LABELS } from "@/domain/project";
import type { LeadProject } from "@/hooks/use-lead-overview";

type StatusFilter = "active" | "done" | "all";

const STAGES = ["waiting", "inReview", "approved", "closed", "untracked"] as const;

const TIMELINE_LABELS: Record<TimelineKind, string> = {
  opened: "Aberto",
  reviewed: "1ª revisão",
  approved: "Aprovado",
  closed: "Concluído",
};

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function ProjectTitle({ project }: { project: LeadProject }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="min-w-0 truncate">{project.name}</span>
      <span className="hidden shrink-0 items-center gap-1 sm:flex">
        {project.status === "done" ? (
          <AnimatedBadge size="sm" status="success" showIcon={false}>
            Concluído
          </AnimatedBadge>
        ) : null}
        {project.idle ? (
          <AnimatedBadge size="sm" status="warning" showIcon={false}>
            Parado
          </AnimatedBadge>
        ) : null}
        {project.flagged > 0 ? (
          <AnimatedBadge
            size="sm"
            status={project.worst === "critical" ? "danger" : "warning"}
            showIcon={false}
          >
            {plural(project.flagged, "CR em risco", "CRs em risco")}
          </AnimatedBadge>
        ) : null}
      </span>
      <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
        {project.progress === null ? "—" : percent.format(project.progress)}
      </span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function ProjectDetail({ project }: { project: LeadProject }) {
  const segments: ShareSegment[] = STAGES.filter((s) => project.stages[s] > 0).map((stage) => ({
    id: stage,
    label: STAGE_LABELS[stage],
    value: project.stages[stage],
    color: STAGE_COLORS[stage],
  }));
  const events = useMemo(
    () =>
      project.timeline.toReversed().map((event) => ({
        id: `${event.prKey}:${event.kind}`,
        date: new Date(event.at).toISOString(),
        title: event.title,
        meta: (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{
                backgroundColor:
                  event.kind === "closed"
                    ? STAGE_COLORS.closed
                    : event.kind === "approved"
                      ? STAGE_COLORS.approved
                      : event.kind === "reviewed"
                        ? STAGE_COLORS.inReview
                        : STAGE_COLORS.waiting,
              }}
            />
            {TIMELINE_LABELS[event.kind]} · {dateTime.format(event.at)}
          </span>
        ),
      })),
    [project.timeline],
  );

  return (
    <div className="flex flex-col gap-5 pt-1 text-sm text-foreground">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <ShareBar segments={segments} label={`Estágios dos CRs de ${project.name}`} />
          <ShareLegend segments={segments} className="sm:grid sm:grid-cols-2 sm:gap-x-6" />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
          <Stat label="CRs vinculados" value={formatNumber(project.total)} />
          <Stat
            label="CR aberto mais antigo"
            value={project.oldestOpenHours === null ? "—" : formatHours(project.oldestOpenHours)}
          />
          <Stat
            label="Ciclo mediano"
            value={project.cycleMedianHours === null ? "—" : formatHours(project.cycleMedianHours)}
          />
          <Stat
            label="Última atividade"
            value={project.lastActivityAt === null ? "—" : dateTime.format(project.lastActivityAt)}
          />
        </dl>
      </div>

      {project.idle ? (
        <p className="text-xs text-warning-foreground">
          Sem atividade nos CRs há mais de {LEAD_LIMITS.projectIdleDays} dias.
        </p>
      ) : null}

      {project.authors.length > 0 ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Autores</span>
          <AvatarGroup
            size="sm"
            max={6}
            label={`Autores de ${project.name}`}
            members={project.authors.map((name) => ({ id: name, name }))}
          />
        </div>
      ) : null}

      {project.pullRequests.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {project.pullRequests.map((pr) => (
            <li key={pr.prKey} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <a
                href={pr.url}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex min-w-0 flex-1 items-center gap-1 truncate hover:text-primary"
              >
                <span className="truncate">{pr.title}</span>
                <ArrowUpRightIcon aria-hidden className="size-3.5 shrink-0 opacity-0 group-hover:opacity-100" />
              </a>
              <span className="text-xs text-muted-foreground">
                {pr.repoSlug}
                {pr.authorName ? ` · ${pr.authorName}` : ""}
              </span>
              <AnimatedBadge size="sm" status={pr.stage === "closed" ? "success" : "neutral"} showIcon={false}>
                {STAGE_LABELS[pr.stage]}
              </AnimatedBadge>
              {pr.stage !== "closed" && pr.risks.length > 0 ? <RiskBadges risks={pr.risks} max={2} /> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {events.length > 1 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Andamento recente</p>
          <Timeline
            events={events}
            defaultValue={events.at(-1)?.id}
            height={260}
            itemWidth={220}
            years={false}
            cables={false}
            formatDate={(date) => shortDate.format(date)}
            aria-label={`Andamento recente de ${project.name}`}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ProjectsTab({ projects }: { projects: LeadProject[] }) {
  const [status, setStatus] = useState<StatusFilter>("active");
  const [open, setOpen] = useState<string | null>(null);
  const filtered = status === "all" ? projects : projects.filter((p) => p.status === status);

  const counts = {
    active: projects.filter((p) => p.status === "active").length,
    done: projects.filter((p) => p.status === "done").length,
    idle: projects.filter((p) => p.idle).length,
    flagged: projects.filter((p) => p.flagged > 0).length,
  };

  if (projects.length === 0) {
    return (
      <Empty className="rounded-2xl border border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BlocksIcon />
          </EmptyMedia>
          <EmptyTitle>Nenhum projeto no escopo</EmptyTitle>
          <EmptyDescription>
            Vincule CRs a projetos e features na Fila de CRs para acompanhar o andamento aqui.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ButtonLink href="/" variant="outline" size="sm">
            Abrir Fila de CRs
          </ButtonLink>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {plural(counts.active, "ativo", "ativos")}
          {counts.idle > 0 ? `, ${plural(counts.idle, "parado", "parados")}` : ""}
          {counts.flagged > 0 ? `, ${plural(counts.flagged, "com CR em risco", "com CRs em risco")}` : ""}.
        </p>
        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)} variant="segment">
          <TabsList aria-label="Situação dos projetos">
            <TabsTrigger value="active" className="text-xs">
              Ativos
            </TabsTrigger>
            <TabsTrigger value="done" className="text-xs">
              Concluídos
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              Todos
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum projeto nesta situação.
        </p>
      ) : (
        <BouncyAccordion
          value={open}
          onValueChange={setOpen}
          items={filtered.map((project) => {
            const Icon = PROJECT_KIND_ICONS[project.kind];
            return {
              id: String(project.id),
              icon: <Icon aria-label={PROJECT_KIND_LABELS[project.kind]} className="size-4" />,
              title: <ProjectTitle project={project} />,
              description: <ProjectDetail project={project} />,
            };
          })}
          classNames={{ description: "text-sm text-foreground leading-normal" }}
        />
      )}
    </div>
  );
}
