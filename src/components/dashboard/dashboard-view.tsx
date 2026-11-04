"use client";

import { useState } from "react";
import {
  CalendarDaysIcon,
  ChartAreaIcon,
  ChartColumnIcon,
  FolderGit2Icon,
  HourglassIcon,
  TimerIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { PageHeader } from "@/components/page-header";
import { AgeChart } from "@/components/dashboard/age-chart";
import { FirstReviewChart } from "@/components/dashboard/first-review-chart";
import { QueueChart } from "@/components/dashboard/queue-chart";
import { RepositoriesChart } from "@/components/dashboard/repositories-chart";
import { ReviewActivityChart } from "@/components/dashboard/review-activity-chart";
import { ReviewLoadChart } from "@/components/dashboard/review-load-chart";
import { ThroughputChart } from "@/components/dashboard/throughput-chart";
import { useTeams } from "@/hooks/use-config";
import { useDashboard, type DashboardResponse } from "@/hooks/use-dashboard";

const ALL_TEAMS = "all";

type ChartTab =
  | "queue"
  | "age"
  | "repositories"
  | "first-review"
  | "throughput"
  | "load"
  | "activity";

const TABS: { value: ChartTab; label: string; Icon: LucideIcon }[] = [
  { value: "queue", label: "Fila", Icon: ChartAreaIcon },
  { value: "age", label: "Idade", Icon: HourglassIcon },
  { value: "repositories", label: "Repositórios", Icon: FolderGit2Icon },
  { value: "first-review", label: "Primeira revisão", Icon: TimerIcon },
  { value: "throughput", label: "Throughput", Icon: ChartColumnIcon },
  { value: "load", label: "Carga por pessoa", Icon: UsersRoundIcon },
  { value: "activity", label: "Atividade", Icon: CalendarDaysIcon },
];

export function DashboardView() {
  const [teamId, setTeamId] = useState<number | null>(null);
  const [tab, setTab] = useState<ChartTab>("queue");
  const teams = useTeams().data?.teams ?? [];
  const { data, isLoading, isError } = useDashboard(teamId);
  const loading = isLoading && !isError;

  const items = [
    { value: ALL_TEAMS, label: "Todos os times" },
    ...teams.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Tendências da fila de revisão nos últimos 30 dias, a partir do histórico gravado a cada atualização."
        actions={
          <Select
            value={teamId === null ? ALL_TEAMS : String(teamId)}
            onValueChange={(value) => setTeamId(value === ALL_TEAMS ? null : Number(value))}
            className="z-30 w-full sm:w-52"
          >
            <SelectTrigger className="h-8 py-0">
              <span className="flex min-w-0 items-center gap-2">
                <UsersIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="sr-only">Time:</span>
                <SelectValue className="truncate" />
              </span>
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isError && !data ? (
        <p role="alert" className="text-sm text-destructive-foreground">
          Não foi possível carregar o histórico. Uma nova tentativa é feita a cada minuto.
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as ChartTab)} variant="underline">
        <TabsList aria-label="Gráfico exibido">
          {TABS.map(({ value, label, Icon }) => (
            <TabsTrigger key={value} value={value} icon={<Icon aria-hidden className="size-4" />}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {/* Só o gráfico da aba ativa fica montado: ele se mede visível e repete a entrada. */}
            {tab === value ? renderChart(value, { data, isLoading: loading, teamId }) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function renderChart(
  tab: ChartTab,
  props: { data: DashboardResponse | undefined; isLoading: boolean; teamId: number | null },
) {
  const { data, isLoading, teamId } = props;
  switch (tab) {
    case "queue":
      return <QueueChart data={data} isLoading={isLoading} />;
    case "age":
      return <AgeChart data={data} isLoading={isLoading} />;
    case "repositories":
      return <RepositoriesChart data={data} isLoading={isLoading} />;
    case "first-review":
      return <FirstReviewChart data={data} isLoading={isLoading} />;
    case "throughput":
      return <ThroughputChart data={data} isLoading={isLoading} />;
    case "load":
      return <ReviewLoadChart teamId={teamId} />;
    case "activity":
      return <ReviewActivityChart data={data} isLoading={isLoading} />;
  }
}
