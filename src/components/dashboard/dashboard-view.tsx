"use client";

import { useState } from "react";
import {
  ActivityIcon,
  BlocksIcon,
  LayoutGridIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { PageHeader } from "@/components/page-header";
import { FeaturesView } from "@/components/dashboard/features-view";
import { OverviewView } from "@/components/dashboard/overview-view";
import { ReviewActivityChart } from "@/components/dashboard/review-activity-chart";
import { ReviewLoadChart } from "@/components/dashboard/review-load-chart";
import { SegmentedControl } from "@/components/segmented-control";
import { TeamCombobox } from "@/components/team-combobox";
import { TeamsView } from "@/components/dashboard/teams-view";
import {
  DASHBOARD_RANGES,
  DEFAULT_DASHBOARD_RANGE,
  type DashboardRange,
} from "@/domain/dashboard";
import { useTeams } from "@/hooks/use-config";
import { useDashboard, type DashboardResponse } from "@/hooks/use-dashboard";

type View = "overview" | "teams" | "features" | "people";

const VIEWS: { value: View; label: string; Icon: LucideIcon; description: string }[] = [
  {
    value: "overview",
    label: "Visão geral",
    Icon: LayoutGridIcon,
    description: "Saúde da fila de revisão, tempos e fluxo de entregas.",
  },
  {
    value: "teams",
    label: "Times",
    Icon: UsersRoundIcon,
    description: "Todos os times lado a lado, nos mesmos dias e nas mesmas medidas.",
  },
  {
    value: "features",
    label: "Features",
    Icon: BlocksIcon,
    description: "Projetos e features em andamento e o que já foi entregue em cada um.",
  },
  {
    value: "people",
    label: "Pessoas",
    Icon: ActivityIcon,
    description: "Carga de revisão de cada pessoa e a cadência das revisões.",
  },
];

const RANGE_OPTIONS = DASHBOARD_RANGES.map((days) => ({
  value: String(days) as `${DashboardRange}`,
  label: `${days}d`,
  title: `Últimos ${days} dias`,
}));

export function DashboardView() {
  const [view, setView] = useState<View>("overview");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [range, setRange] = useState<DashboardRange>(DEFAULT_DASHBOARD_RANGE);
  const teams = useTeams().data?.teams ?? [];
  const dashboard = useDashboard(teamId, range);
  const loading = dashboard.isLoading && !dashboard.isError;
  const current = VIEWS.find((v) => v.value === view)!;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`${current.description} Últimos ${range} dias, a partir do histórico gravado a cada atualização.`}
        actions={
          <>
            {view === "teams" ? null : (
              <TeamCombobox
                teams={teams}
                teamId={teamId}
                onTeamChange={setTeamId}
                className="sm:w-48"
              />
            )}
            <SegmentedControl
              label="Período"
              value={String(range) as `${DashboardRange}`}
              onChange={(value) => setRange(Number(value) as DashboardRange)}
              options={RANGE_OPTIONS}
            />
          </>
        }
      />

      {dashboard.isError && !dashboard.data ? (
        <p role="alert" className="text-sm text-destructive-foreground">
          Não foi possível carregar o histórico. Uma nova tentativa é feita a cada minuto.
        </p>
      ) : null}

      <Tabs value={view} onValueChange={(v) => setView(v as View)} variant="underline">
        <TabsList aria-label="Visão do dashboard">
          {VIEWS.map(({ value, label, Icon }) => (
            <TabsTrigger key={value} value={value} icon={<Icon aria-hidden className="size-4" />}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {VIEWS.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-5">
            {/* Só a visão ativa fica montada: seus gráficos se medem visíveis e repetem a entrada. */}
            {view === value
              ? renderView(value, { data: dashboard.data, isLoading: loading, teamId, range })
              : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function renderView(
  view: View,
  props: {
    data: DashboardResponse | undefined;
    isLoading: boolean;
    teamId: number | null;
    range: DashboardRange;
  },
) {
  const { data, isLoading, teamId, range } = props;
  switch (view) {
    case "overview":
      return <OverviewView data={data} isLoading={isLoading} range={range} />;
    case "teams":
      return <TeamsView range={range} />;
    case "features":
      return <FeaturesView teamId={teamId} range={range} />;
    case "people":
      return (
        <div className="flex flex-col gap-4">
          <ReviewLoadChart teamId={teamId} />
          <ReviewActivityChart data={data} isLoading={isLoading} />
        </div>
      );
  }
}
