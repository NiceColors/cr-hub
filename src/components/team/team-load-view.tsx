"use client";

import { useMemo, useState } from "react";
import { UsersIcon } from "lucide-react";
import { Table, type TableColumn } from "@/components/motion/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { TeamCombobox } from "@/components/team-combobox";
import { initials } from "@/domain/person-name";
import { leastLoadedMembers, type ReviewLoad } from "@/domain/pull-request";
import { useMembers, useTeams } from "@/hooks/use-config";
import { useReviewLoad } from "@/hooks/use-review-load";
import { useOnCall } from "@/hooks/use-on-call";
import { OnCallStrip } from "@/components/on-call-strip";
import { WeeklyReportPanel } from "@/components/team/weekly-report-panel";
import { fitTableHeight } from "@/lib/table-height";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 52;

type Row = {
  uuid: string;
  displayName: string;
  avatarUrl: string | null;
  load: ReviewLoad;
  leastLoaded: boolean;
  onCall: boolean;
};

function Num({ value, tone }: { value: number; tone?: "warning" | "destructive" }) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        value === 0 && "text-muted-foreground",
        value > 0 && tone === "warning" && "text-warning-foreground",
        value > 0 && tone === "destructive" && "text-destructive-foreground",
      )}
    >
      {value}
    </span>
  );
}

const columns: TableColumn<Row>[] = [
  {
    key: "member",
    header: "Membro",
    sortable: true,
    sortValue: (r) => r.displayName,
    cell: (r) => (
      <div className="flex min-w-0 items-center gap-2">
        <Avatar className="size-6">
          {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[10px]">{initials(r.displayName)}</AvatarFallback>
        </Avatar>
        <span className="truncate">{r.displayName}</span>
        {r.onCall ? (
          <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
            Plantão hoje
          </span>
        ) : null}
        {r.leastLoaded ? (
          <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-1.5 text-[10px] text-success-foreground">
            Menor carga
          </span>
        ) : null}
      </div>
    ),
  },
  {
    key: "pending",
    header: "Para revisar",
    sortable: true,
    align: "right",
    sortValue: (r) => r.load.pending,
    width: "150px",
    cell: (r) => <Num value={r.load.pending} />,
  },
  {
    key: "overdue",
    header: "Acima do SLA",
    sortable: true,
    align: "right",
    sortValue: (r) => r.load.overdue,
    width: "150px",
    cell: (r) => <Num value={r.load.overdue} tone="warning" />,
  },
  {
    key: "authored",
    header: "PRs abertos",
    sortable: true,
    align: "right",
    sortValue: (r) => r.load.authored,
    width: "150px",
    cell: (r) => <Num value={r.load.authored} />,
  },
];

const EMPTY_LOAD: ReviewLoad = { pending: 0, overdue: 0, authored: 0 };

export function TeamLoadView() {
  const [teamId, setTeamId] = useState<number | null>(null);
  const membersQuery = useMembers();
  const teamsData = useTeams().data;
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData]);
  const load = useReviewLoad();
  const onCall = useOnCall();

  const rows = useMemo<Row[]>(() => {
    const team = teamId ? teams.find((t) => t.id === teamId) : null;
    const scope = team ? new Set(team.memberUuids) : null;
    const members = (membersQuery.data?.members ?? []).filter(
      (m) => m.monitored && (!scope || scope.has(m.uuid)),
    );
    const least = new Set(load ? leastLoadedMembers(members.map((m) => m.uuid), load) : []);
    const everyoneTied = least.size === members.length;
    return members.map((m) => ({
      uuid: m.uuid,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
      load: load?.get(m.uuid) ?? EMPTY_LOAD,
      leastLoaded: !everyoneTied && least.has(m.uuid),
      onCall: onCall.onCallUuids.has(m.uuid),
    }));
  }, [membersQuery.data, teams, teamId, load, onCall.onCallUuids]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipe"
        description="Quantos PRs cada membro tem esperando a revisão dele. Use para distribuir revisões e escolher quem chamar."
      />

      <OnCallStrip entries={onCall.entries} teamId={teamId} />

      <TeamCombobox teams={teams} teamId={teamId} onTeamChange={setTeamId} />

      {membersQuery.isError && !membersQuery.data ? (
        <QueryError
          title="Não foi possível carregar a equipe"
          error={membersQuery.error}
          onRetry={() => membersQuery.refetch()}
          retrying={membersQuery.isFetching}
        />
      ) : (
        <Table
          data={rows}
          columns={columns}
          getRowId={(r) => r.uuid}
          defaultSort={{ key: "pending", direction: "desc" }}
          rowHeight={ROW_HEIGHT}
          height={fitTableHeight(rows.length, ROW_HEIGHT, { minRows: 4, maxRows: 14 })}
          loading={membersQuery.isLoading || load === null}
          emptyState={
            <Empty className="p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum membro monitorado neste recorte</EmptyTitle>
                <EmptyDescription>
                  Marque membros como monitorados em Configuração → Membros, ou troque o time.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
          className="rounded-2xl"
        />
      )}
      <p className="text-xs text-muted-foreground">
        “Para revisar” conta PRs abertos em que a pessoa é revisora e ainda não aprovou nem pediu
        mudanças. “Acima do SLA” é a parte deles que já passou do limite de atenção do repositório.
      </p>

      <WeeklyReportPanel />
    </div>
  );
}
