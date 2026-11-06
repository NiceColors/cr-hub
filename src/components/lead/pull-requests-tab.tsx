"use client";

import { useMemo, useState } from "react";
import { RiskBadges } from "@/components/lead/lead-badges";
import { AvatarGroup, Avatar } from "@/components/motion/avatar-group";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectInput,
  MultiSelectItem,
  MultiSelectLabel,
  MultiSelectList,
  MultiSelectEmpty,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/motion/multi-select";
import { Pagination } from "@/components/motion/pagination";
import { Table, type SortState, type TableColumn } from "@/components/motion/table";
import { AgeIndicator, ReviewStateBadge } from "@/components/pull-requests/review-state";
import { RelativeTime } from "@/components/relative-time";
import { plural } from "@/components/dashboard/format";
import { RISK_KINDS, RISK_LABELS, RISK_SEVERITY, type RiskKind } from "@/domain/lead";
import type { LeadPullRequestRow, LeadTeam } from "@/hooks/use-lead-overview";
import { fitTableHeight } from "@/lib/table-height";

const ROW_HEIGHT = 56;
const PAGE_SIZE = 25;
const TEAM_PREFIX = "team:";
const DEFAULT_SORT: SortState = { key: "risks", direction: "desc" };

/** Os sinais que pedem ação, para o atalho "Atenção agora". */
export const ACTIONABLE_RISKS: RiskKind[] = RISK_KINDS.filter((k) => RISK_SEVERITY[k] !== "info");

function buildColumns(teamNames: Map<number, string>): TableColumn<LeadPullRequestRow>[] {
  return [
    {
      key: "title",
      header: "PR",
      sortable: true,
      sortValue: (pr) => pr.title.toLocaleLowerCase("pt-BR"),
      cell: (pr) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{pr.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {pr.repository.slug} #{pr.id}
            {pr.destinationBranch ? ` → ${pr.destinationBranch}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "author",
      header: "Autor",
      sortable: true,
      width: "170px",
      sortValue: (pr) => pr.author.displayName,
      cell: (pr) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={pr.author.displayName} src={pr.author.avatarUrl ?? undefined} size="sm" />
          <span className="truncate">{pr.author.displayName}</span>
        </span>
      ),
    },
    {
      key: "teams",
      header: "Time",
      width: "130px",
      sortable: true,
      sortValue: (pr) => pr.teamIds.map((id) => teamNames.get(id) ?? "").join(", "),
      cell: (pr) => (
        <span className="truncate text-muted-foreground">
          {pr.teamIds.length ? pr.teamIds.map((id) => teamNames.get(id)).join(", ") : "—"}
        </span>
      ),
    },
    {
      key: "age",
      header: "Idade",
      width: "120px",
      sortable: true,
      sortValue: (pr) => -Date.parse(pr.createdOn),
      cell: (pr) => (
        <span className="flex items-center gap-2">
          <AgeIndicator band={pr.ageBand} />
          <RelativeTime iso={pr.createdOn} />
        </span>
      ),
    },
    {
      key: "state",
      header: "Estado",
      width: "140px",
      sortable: true,
      truncate: false,
      sortValue: (pr) => pr.reviewState,
      cell: (pr) => <ReviewStateBadge state={pr.reviewState} />,
    },
    {
      key: "reviewers",
      header: "Revisores",
      width: "130px",
      truncate: false,
      sortable: true,
      sortValue: (pr) => pr.reviewers.length,
      cell: (pr) =>
        pr.reviewers.length ? (
          <AvatarGroup
            size="sm"
            max={3}
            label={`Revisores de ${pr.title}`}
            members={pr.reviewers.map((r) => ({
              id: r.uuid,
              name: `${r.displayName}${r.approved ? " (aprovou)" : r.changesRequested ? " (pediu mudanças)" : ""}`,
              src: r.avatarUrl ?? undefined,
            }))}
          />
        ) : (
          <span className="text-xs text-muted-foreground">Ninguém</span>
        ),
    },
    {
      key: "risks",
      header: "Riscos",
      width: "250px",
      truncate: false,
      sortable: true,
      sortValue: (pr) => pr.score,
      cell: (pr) => <RiskBadges risks={pr.risks} max={2} />,
    },
  ];
}

export function PullRequestsTab({
  pullRequests,
  teams,
  filters,
  onFiltersChange,
  onOpen,
}: {
  pullRequests: LeadPullRequestRow[];
  teams: LeadTeam[];
  filters: string[];
  onFiltersChange: (filters: string[]) => void;
  onOpen: (pr: LeadPullRequestRow) => void;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(DEFAULT_SORT);
  const teamNames = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const columns = useMemo(() => buildColumns(teamNames), [teamNames]);

  const riskFilter = filters.filter((f) => !f.startsWith(TEAM_PREFIX)) as RiskKind[];
  const teamFilter = filters.filter((f) => f.startsWith(TEAM_PREFIX)).map((f) => Number(f.slice(TEAM_PREFIX.length)));

  const filtered = pullRequests.filter(
    (pr) =>
      (riskFilter.length === 0 || pr.risks.some((r) => riskFilter.includes(r))) &&
      (teamFilter.length === 0 || pr.teamIds.some((id) => teamFilter.includes(id))),
  );
  const sortColumn = sort ? columns.find((c) => c.key === sort.key) : undefined;
  const sorted = sortColumn?.sortValue
    ? filtered.toSorted((a, b) => {
        const va = sortColumn.sortValue!(a);
        const vb = sortColumn.sortValue!(b);
        const order =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb), "pt-BR");
        return sort!.direction === "asc" ? order : -order;
      })
    : filtered;
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MultiSelect
          value={filters}
          onValueChange={(next) => {
            onFiltersChange(next);
            setPage(1);
          }}
          className="w-full max-w-xl"
        >
          <MultiSelectTrigger>
            <MultiSelectValue placeholder={null} />
            <MultiSelectInput aria-label="Buscar riscos e times" placeholder="Filtrar por risco ou time" />
          </MultiSelectTrigger>
          <MultiSelectContent>
            <MultiSelectList ariaLabel="Filtros">
              <MultiSelectGroup>
                <MultiSelectLabel>Riscos</MultiSelectLabel>
                {RISK_KINDS.map((kind) => (
                  <MultiSelectItem key={kind} value={kind} textValue={RISK_LABELS[kind]}>
                    {RISK_LABELS[kind]}
                  </MultiSelectItem>
                ))}
              </MultiSelectGroup>
              {teams.length > 0 ? (
                <MultiSelectGroup>
                  <MultiSelectLabel>Times</MultiSelectLabel>
                  {teams.map((team) => (
                    <MultiSelectItem key={team.id} value={`${TEAM_PREFIX}${team.id}`} textValue={team.name}>
                      {team.name}
                    </MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              ) : null}
              <MultiSelectEmpty>Nenhum filtro encontrado.</MultiSelectEmpty>
            </MultiSelectList>
          </MultiSelectContent>
        </MultiSelect>
        <p className="text-sm text-muted-foreground tabular-nums">
          {plural(filtered.length, "PR", "PRs")}
          {filtered.length !== pullRequests.length ? ` de ${pullRequests.length}` : ""}
        </p>
      </div>

      <Table
        data={rows}
        columns={columns}
        getRowId={(pr) => pr.key}
        rowHeight={ROW_HEIGHT}
        height={fitTableHeight(rows.length, ROW_HEIGHT, { maxRows: 12 })}
        fitContainer
        resizable
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        manualSort
        onRowClick={onOpen}
        getRowLabel={(pr) => `Abrir detalhes de ${pr.title}`}
        getRowClassName={(pr) => (pr.snoozed ? "opacity-60" : undefined)}
        emptyState={
          <p className="py-8 text-center text-sm text-muted-foreground">
            {pullRequests.length === 0 ? "Nenhum PR aberto no escopo." : "Nenhum PR com esses filtros."}
          </p>
        }
      />

      {totalPages > 1 ? (
        <div className="flex justify-center">
          <Pagination totalPages={totalPages} page={current} onPageChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}
