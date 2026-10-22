"use client";

import { useMemo, useState } from "react";
import { UsersIcon } from "lucide-react";
import { Table, type TableColumn } from "@/components/motion/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { initials } from "@/components/pull-requests/pull-request-columns";
import { leastLoadedMembers, type ReviewLoad } from "@/domain/pull-request";
import { useMembers, useTeams } from "@/hooks/use-config";
import { useReviewLoad } from "@/hooks/use-review-load";
import { fitTableHeight } from "@/lib/table-height";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 52;
const ALL_TEAMS = "all";

type Row = {
  uuid: string;
  displayName: string;
  avatarUrl: string | null;
  load: ReviewLoad;
  leastLoaded: boolean;
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
        {r.leastLoaded ? (
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
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
    }));
  }, [membersQuery.data, teams, teamId, load]);

  const items = [
    { value: ALL_TEAMS, label: "Todos os times" },
    ...teams.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipe"
        description="Quantos PRs cada membro tem esperando a revisão dele. Use para distribuir revisões e escolher quem chamar."
      />

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

      <Table
        data={rows}
        columns={columns}
        getRowId={(r) => r.uuid}
        defaultSort={{ key: "pending", direction: "desc" }}
        rowHeight={ROW_HEIGHT}
        height={fitTableHeight(rows.length, ROW_HEIGHT, { minRows: 4, maxRows: 14 })}
        loading={membersQuery.isLoading || load === null}
        emptyState="Nenhum membro monitorado neste recorte."
        className="rounded-2xl"
      />
      <p className="text-xs text-muted-foreground">
        “Para revisar” conta PRs abertos em que a pessoa é revisora e ainda não aprovou nem pediu
        mudanças. “Acima do SLA” é a parte deles que já passou do limite de atenção do repositório.
      </p>
    </div>
  );
}
