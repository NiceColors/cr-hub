"use client";

import { useMemo, useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Checkbox } from "@/components/motion/checkbox";
import { Input } from "@/components/motion/input";
import { Table, type TableColumn } from "@/components/motion/table";
import { SectionHeader } from "@/components/config/section-header";
import { TableSearch, matchesSearch } from "@/components/config/table-search";
import { useRepositories, useSyncRepositories, useUpdateRepository } from "@/hooks/use-config";
import type { Repository } from "@/lib/api/config";
import { fitTableHeight } from "@/lib/table-height";
import { DEFAULT_SLA } from "@/domain/pull-request";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 56;
const MIN_APPROVALS = 0;
const MAX_APPROVALS = 20;

function repositoryRowId(repository: Repository) {
  return repository.uuid;
}

function MonitorCheckbox({ repository }: { repository: Repository }) {
  const update = useUpdateRepository();
  return (
    <Checkbox
      checked={repository.monitored}
      onCheckedChange={(checked) => update.mutate({ uuid: repository.uuid, monitored: checked })}
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
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      disabled={!repository.monitored}
      aria-label={`Mínimo de aprovações para ${repository.name}`}
      className="w-20"
      classNames={{ field: "h-8", input: "font-mono text-sm tabular-nums" }}
    />
  );
}

const MAX_SLA_HOURS = 24 * 30;

function SlaInput({
  repository,
  field,
  placeholder,
  label,
}: {
  repository: Repository;
  field: "slaWarningHours" | "slaCriticalHours";
  placeholder: number;
  label: string;
}) {
  const update = useUpdateRepository();
  const [draft, setDraft] = useState<string | null>(null);
  const current = repository[field];

  function commit() {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isInteger(next) || next < 1 || next > MAX_SLA_HOURS)) return;
    if (next === current) return;
    update.mutate({ uuid: repository.uuid, [field]: next });
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={1}
      max={MAX_SLA_HOURS}
      value={draft ?? (current === null ? "" : String(current))}
      placeholder={String(placeholder)}
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      disabled={!repository.monitored}
      aria-label={`${label} para ${repository.name}, em horas`}
      className="w-20"
      classNames={{ field: "h-8", input: "font-mono text-sm tabular-nums" }}
    />
  );
}

const columns: TableColumn<Repository>[] = [
  {
    key: "monitored",
    header: "Monitorar",
    sortable: true,
    sortValue: (r) => (r.monitored ? 1 : 0),
    width: "130px",
    cell: (r) => <MonitorCheckbox repository={r} />,
  },
  {
    key: "name",
    header: "Repositório",
    sortable: true,
    sortValue: (r) => r.name,
    cell: (r) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("truncate font-medium", !r.monitored && "text-muted-foreground")}>
          {r.name}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">{r.slug}</span>
      </div>
    ),
  },
  {
    key: "minApprovals",
    header: "Mín. aprovações",
    sortable: true,
    sortValue: (r) => r.minApprovals,
    width: "160px",
    cell: (r) => <MinApprovalsInput repository={r} />,
  },
  {
    key: "slaWarningHours",
    header: "Atenção (h)",
    sortable: true,
    sortValue: (r) => r.slaWarningHours ?? DEFAULT_SLA.warningHours,
    width: "130px",
    cell: (r) => (
      <SlaInput
        repository={r}
        field="slaWarningHours"
        placeholder={DEFAULT_SLA.warningHours}
        label="Limite de atenção"
      />
    ),
  },
  {
    key: "slaCriticalHours",
    header: "Crítico (h)",
    sortable: true,
    sortValue: (r) => r.slaCriticalHours ?? DEFAULT_SLA.criticalHours,
    width: "130px",
    cell: (r) => (
      <SlaInput
        repository={r}
        field="slaCriticalHours"
        placeholder={DEFAULT_SLA.criticalHours}
        label="Limite crítico"
      />
    ),
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

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Repositórios do workspace"
        description={
          <>
            <span className="font-mono tabular-nums">{monitoredCount}</span> monitorado(s) de{" "}
            <span className="font-mono tabular-nums">{repositories?.length ?? 0}</span>. O mínimo
            de aprovações define quando um PR conta como aprovado. Os limites de SLA em branco
            usam o padrão de 24h e 72h.
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
              <RefreshCwIcon className={cn("size-3.5", sync.isPending && "animate-spin")} />
              Sincronizar
            </Button>
          </>
        }
      />

      <Table
        data={visible}
        columns={columns}
        getRowId={repositoryRowId}
        defaultSort={{ key: "name", direction: "asc" }}
        rowHeight={ROW_HEIGHT}
        height={fitTableHeight(visible.length, ROW_HEIGHT)}
        loading={isLoading}
        emptyState={
          search
            ? "Nenhum repositório corresponde à busca."
            : "Nenhum repositório. Clique em Sincronizar para importar do Bitbucket."
        }
        className="rounded-2xl"
      />
    </div>
  );
}
