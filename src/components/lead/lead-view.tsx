"use client";

import { useState } from "react";
import {
  ActivityIcon,
  BlocksIcon,
  GitPullRequestIcon,
  LayoutGridIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { plural } from "@/components/dashboard/format";
import { LeadPullRequestDrawer } from "@/components/lead/lead-pull-request-drawer";
import { PeopleTab } from "@/components/lead/people-tab";
import { ProjectsTab } from "@/components/lead/projects-tab";
import { ACTIONABLE_RISKS, PullRequestsTab } from "@/components/lead/pull-requests-tab";
import { SummaryTab } from "@/components/lead/summary-tab";
import { TeamsTab } from "@/components/lead/teams-tab";
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from "@/components/motion/alert";
import { Loader } from "@/components/motion/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { TextShimmer } from "@/components/motion/text-shimmer";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { RelativeTime } from "@/components/relative-time";
import { DASHBOARD_RANGES, type DashboardRange } from "@/domain/dashboard";
import { useLeadOverview, type LeadOverviewResponse } from "@/hooks/use-lead-overview";

const ALL_TEAMS = "all";
const DEFAULT_RANGE: DashboardRange = 14;

type View = "summary" | "teams" | "projects" | "prs" | "people";

const VIEWS: { value: View; label: string; Icon: LucideIcon }[] = [
  { value: "summary", label: "Resumo", Icon: LayoutGridIcon },
  { value: "teams", label: "Times", Icon: UsersRoundIcon },
  { value: "projects", label: "Projetos", Icon: BlocksIcon },
  { value: "prs", label: "PRs", Icon: GitPullRequestIcon },
  { value: "people", label: "Pessoas", Icon: ActivityIcon },
];

function LoadingState() {
  return (
    <div
      role="status"
      className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-border"
    >
      <Loader label="Carregando painel" />
      <TextShimmer className="text-sm">Cruzando fila, histórico, times e projetos…</TextShimmer>
    </div>
  );
}

export function LeadView() {
  const [view, setView] = useState<View>("summary");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [range, setRange] = useState<DashboardRange>(DEFAULT_RANGE);
  const [prFilters, setPrFilters] = useState<string[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const lead = useLeadOverview(teamId, range);
  const data = lead.data;
  const teams = data?.teams ?? [];
  const team = teamId ? teams.find((t) => t.id === teamId) : null;

  const teamItems = [
    { value: ALL_TEAMS, label: "Todos os times" },
    ...teams.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Painel do líder"
        description={
          <>
            Times, projetos e PRs {team ? `de ${team.name} ` : ""}em um só lugar, com o que pede ação
            primeiro.
            {data ? (
              <>
                {" "}
                Fila atualizada <RelativeTime iso={data.fetchedAt} />.
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Select
              value={teamId === null ? ALL_TEAMS : String(teamId)}
              onValueChange={(value) => setTeamId(value === ALL_TEAMS ? null : Number(value))}
              className="z-30 w-full sm:w-48"
            >
              <SelectTrigger className="h-8 py-0">
                <span className="flex min-w-0 items-center gap-2">
                  <UsersIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="sr-only">Time:</span>
                  <SelectValue className="truncate" />
                </span>
              </SelectTrigger>
              <SelectContent>
                {teamItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs
              value={String(range)}
              onValueChange={(v) => setRange(Number(v) as DashboardRange)}
              variant="segment"
            >
              <TabsList aria-label="Período">
                {DASHBOARD_RANGES.map((days) => (
                  <TabsTrigger
                    key={days}
                    value={String(days)}
                    title={`Últimos ${days} dias`}
                    className="px-2.5 py-1 text-xs tabular-nums"
                  >
                    {days}d
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </>
        }
      />

      {data ? <Notices data={data} /> : null}

      {lead.isError && !data ? (
        <QueryError
          title="Não foi possível carregar o painel"
          error={lead.error}
          onRetry={() => void lead.refetch()}
          retrying={lead.isFetching}
        />
      ) : !data ? (
        <LoadingState />
      ) : (
        <Tabs value={view} onValueChange={(v) => setView(v as View)} variant="underline">
          <TabsList aria-label="Visão do painel">
            {VIEWS.map(({ value, label, Icon }) => (
              <TabsTrigger key={value} value={value} icon={<Icon aria-hidden className="size-4" />}>
                {label}
                {value === "prs" && data.summary.counts.flagged > 0 ? (
                  <span className="ml-1.5 rounded-full bg-destructive/10 px-1.5 font-mono text-[10px] text-destructive tabular-nums">
                    {data.summary.counts.flagged}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {VIEWS.map(({ value }) => (
            <TabsContent key={value} value={value} className="mt-5">
              {view === value ? (
                <ViewBody
                  view={value}
                  data={data}
                  teamId={teamId}
                  onTeamChange={setTeamId}
                  prFilters={prFilters}
                  onPrFiltersChange={setPrFilters}
                  onOpen={setOpenKey}
                  onViewAttention={() => {
                    setPrFilters(ACTIONABLE_RISKS);
                    setView("prs");
                  }}
                />
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <LeadPullRequestDrawer prKey={openKey} onOpen={setOpenKey} onClose={() => setOpenKey(null)} />
    </div>
  );
}

function Notices({ data }: { data: LeadOverviewResponse }) {
  return (
    <>
      <Alert variant="warning" open={data.rateLimited}>
        <AlertIcon />
        <AlertContent>
          <AlertTitle>Limite de requisições do Bitbucket</AlertTitle>
          <AlertDescription>
            A fila mostrada é a última que deu para buscar. Ela volta a atualizar sozinha.
          </AlertDescription>
        </AlertContent>
      </Alert>
      <Alert variant="warning" open={data.failedRepos > 0}>
        <AlertIcon />
        <AlertContent>
          <AlertTitle>
            {plural(data.failedRepos, "repositório falhou", "repositórios falharam")} na última busca
          </AlertTitle>
          <AlertDescription>
            Os números podem estar incompletos. Veja os detalhes na Fila de CRs.
          </AlertDescription>
        </AlertContent>
      </Alert>
    </>
  );
}

function ViewBody({
  view,
  data,
  teamId,
  onTeamChange,
  prFilters,
  onPrFiltersChange,
  onOpen,
  onViewAttention,
}: {
  view: View;
  data: LeadOverviewResponse;
  teamId: number | null;
  onTeamChange: (teamId: number | null) => void;
  prFilters: string[];
  onPrFiltersChange: (filters: string[]) => void;
  onOpen: (key: string) => void;
  onViewAttention: () => void;
}) {
  switch (view) {
    case "summary":
      return <SummaryTab data={data} onViewAttention={onViewAttention} />;
    case "teams":
      return <TeamsTab teams={data.teams} days={data.days} teamId={teamId} onTeamChange={onTeamChange} />;
    case "projects":
      return <ProjectsTab projects={data.projects} />;
    case "prs":
      return (
        <PullRequestsTab
          pullRequests={data.pullRequests}
          teams={data.teams}
          filters={prFilters}
          onFiltersChange={onPrFiltersChange}
          onOpen={(pr) => onOpen(pr.key)}
        />
      );
    case "people":
      return <PeopleTab people={data.people} teamId={teamId} />;
  }
}
