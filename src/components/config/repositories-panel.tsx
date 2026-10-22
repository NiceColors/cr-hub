"use client";

import { useMemo, useState } from "react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { RefreshCwIcon } from "lucide-react";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/config/section-header";
import { TableSearch, matchesSearch } from "@/components/config/table-search";
import { useRepositories, useSyncRepositories, useUpdateRepository } from "@/hooks/use-config";
import type { Repository } from "@/lib/api/config";
import { DATA_GRID_I18N_PT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const MIN_APPROVALS = 0;
const MAX_APPROVALS = 20;

function MonitorCheckbox({ repository }: { repository: Repository }) {
  const update = useUpdateRepository();
  return (
    <Checkbox
      checked={repository.monitored}
      onCheckedChange={(checked) =>
        update.mutate({ uuid: repository.uuid, monitored: Boolean(checked) })
      }
      aria-label={`Monitorar ${repository.name}`}
    />
  );
}

function MinApprovalsInput({ repository }: { repository: Repository }) {
  const update = useUpdateRepository();
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const value = Number(draft);
    setDraft(null);
    if (!Number.isInteger(value) || value < MIN_APPROVALS || value > MAX_APPROVALS) return;
    if (value === repository.minApprovals) return;
    update.mutate({ uuid: repository.uuid, minApprovals: value });
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={MIN_APPROVALS}
      max={MAX_APPROVALS}
      value={draft ?? String(repository.minApprovals)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      disabled={!repository.monitored}
      aria-label={`Mínimo de aprovações para ${repository.name}`}
      className="h-8 w-20 font-mono tabular-nums"
    />
  );
}

const columns: ColumnDef<DataGridFeatures, Repository>[] = [
  {
    id: "monitored",
    accessorFn: (r) => (r.monitored ? 1 : 0),
    header: ({ column }) => <DataGridColumnHeader column={column} title="Monitorar" />,
    sortFn: "basic",
    size: 120,
    cell: ({ row }) => <MonitorCheckbox repository={row.original} />,
  },
  {
    id: "name",
    accessorFn: (r) => r.name,
    header: ({ column }) => <DataGridColumnHeader column={column} title="Repositório" />,
    size: 420,
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "truncate font-medium",
            !row.original.monitored && "text-muted-foreground",
          )}
        >
          {row.original.name}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {row.original.slug}
        </span>
      </div>
    ),
  },
  {
    id: "minApprovals",
    accessorFn: (r) => r.minApprovals,
    header: ({ column }) => <DataGridColumnHeader column={column} title="Mín. aprovações" />,
    sortFn: "basic",
    size: 160,
    cell: ({ row }) => <MinApprovalsInput repository={row.original} />,
  },
];

export function RepositoriesPanel() {
  const { data, isLoading } = useRepositories();
  const sync = useSyncRepositories();
  const [search, setSearch] = useState("");

  const repositories = data?.repositories;
  const visible = useMemo(
    () => (repositories ?? []).filter((r) => matchesSearch(search, r.name, r.slug)),
    [repositories, search],
  );
  const monitoredCount = repositories?.filter((r) => r.monitored).length ?? 0;

  const table = useTable({
    features: dataGridFeatures,
    data: visible,
    columns,
    getRowId: (r) => r.uuid,
    initialState: {
      sorting: [{ id: "name", desc: false }],
      pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Repositórios do workspace"
        description={
          <>
            <span className="font-mono tabular-nums">{monitoredCount}</span> monitorado(s) de{" "}
            <span className="font-mono tabular-nums">{repositories?.length ?? 0}</span>. O mínimo
            de aprovações define quando um PR conta como aprovado.
          </>
        }
        actions={
          <>
            <TableSearch value={search} onChange={setSearch} placeholder="Filtrar repositórios…" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                className={cn(sync.isPending && "animate-spin")}
              />
              Sincronizar
            </Button>
          </>
        }
      />

      <DataGrid
        table={table}
        recordCount={visible.length}
        isLoading={isLoading}
        i18n={DATA_GRID_I18N_PT}
        emptyMessage={
          search
            ? "Nenhum repositório corresponde à busca."
            : "Nenhum repositório. Clique em Sincronizar para importar do Bitbucket."
        }
        tableLayout={{
          dense: true,
          rowBorder: true,
          headerBorder: true,
          headerBackground: true,
          width: "fixed",
        }}
      >
        <DataGridContainer className="rounded-lg border bg-card">
          <DataGridTable />
        </DataGridContainer>
        {visible.length > PAGE_SIZE ? <DataGridPagination /> : null}
      </DataGrid>
    </div>
  );
}
