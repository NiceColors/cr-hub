"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTable, type SortingState } from "@tanstack/react-table";
import {
  CircleCheckIcon,
  FolderGit2Icon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import type { FilterField, FilterQuery } from "@/components/reui/filters/filters-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/page-header";
import { RelativeTime } from "@/components/relative-time";
import { pullRequestColumns } from "@/components/pull-requests/pull-request-columns";
import { PullRequestStats } from "@/components/pull-requests/pull-request-stats";
import { PullRequestToolbar } from "@/components/pull-requests/pull-request-toolbar";
import {
  EMPTY_FILTER_QUERY,
  matchesQuery,
} from "@/components/pull-requests/filter-query";
import { useRepositories, useSettings, useTeams } from "@/hooks/use-config";
import { usePullRequests, type PullRequestItem } from "@/hooks/use-pull-requests";
import { DATA_GRID_I18N_PT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const NO_PULL_REQUESTS: PullRequestItem[] = [];

function buildFilterFields(
  repositories: { uuid: string; name: string }[],
  pullRequests: PullRequestItem[],
): FilterField[] {
  const authors = new Map<string, string>();
  for (const pr of pullRequests) authors.set(pr.author.uuid, pr.author.displayName);

  return [
    {
      id: "repository",
      label: "Repositório",
      type: "select",
      options: repositories.map((r) => ({ value: r.uuid, label: r.name })),
      placeholder: "Escolha um repositório",
    },
    {
      id: "author",
      label: "Autor",
      type: "select",
      options: [...authors].map(([value, label]) => ({ value, label })),
      placeholder: "Escolha um autor",
    },
  ];
}

export function PullRequestsView() {
  const [teamId, setTeamId] = useState<number | null>(null);
  const [filterQuery, setFilterQuery] = useState<FilterQuery>(EMPTY_FILTER_QUERY);
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdOn", desc: false }]);

  const repositoriesQuery = useRepositories();
  const teamsQuery = useTeams();
  const settingsQuery = useSettings();
  const pollIntervalSeconds = settingsQuery.data?.pollIntervalSeconds ?? 30;

  const { query, refresh } = usePullRequests({
    teamId,
    refreshIntervalSec: pollIntervalSeconds,
  });

  const pullRequests = query.data?.pullRequests ?? NO_PULL_REQUESTS;

  const monitoredRepositories = useMemo(
    () => (repositoriesQuery.data?.repositories ?? []).filter((r) => r.monitored),
    [repositoriesQuery.data],
  );

  const filterFields = useMemo(
    () => buildFilterFields(monitoredRepositories, pullRequests),
    [monitoredRepositories, pullRequests],
  );

  const visible = useMemo(
    () => pullRequests.filter((pr) => matchesQuery(pr, filterQuery)),
    [pullRequests, filterQuery],
  );

  const table = useTable({
    features: dataGridFeatures,
    data: visible,
    columns: pullRequestColumns,
    getRowId: (pr) => `${pr.repository.uuid}:${pr.id}`,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } },
  });

  const configLoaded = repositoriesQuery.isSuccess;
  const hasConfig = monitoredRepositories.length > 0;
  const isInitialLoad = query.isLoading || repositoriesQuery.isLoading;
  const data = query.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fila de CRs"
        description="Pull requests abertos pelos membros monitorados, do mais antigo para o mais novo."
        actions={
          <>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {data ? (
                <>
                  Atualizado <RelativeTime iso={data.fetchedAt} />
                  {" · "}a cada {pollIntervalSeconds}s
                </>
              ) : (
                "Aguardando primeira atualização"
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                className={cn(refresh.isPending && "animate-spin")}
              />
              Atualizar
            </Button>
          </>
        }
      />

      {configLoaded && !hasConfig ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Configuração incompleta</AlertTitle>
          <AlertDescription>
            Nenhum repositório monitorado. Sincronize e selecione os repositórios em{" "}
            <Link href="/config">Configuração</Link>.
          </AlertDescription>
        </Alert>
      ) : null}

      {data?.rateLimit?.retryAfterSeconds ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Limite da API do Bitbucket atingido</AlertTitle>
          <AlertDescription>
            Nova tentativa em{" "}
            <span className="font-mono tabular-nums">{data.rateLimit.retryAfterSeconds}s</span>.
          </AlertDescription>
        </Alert>
      ) : null}

      {data?.errors.length ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Falha ao consultar {data.errors.length} repositório(s)</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
              {data.errors.map((e) => (
                <li key={e.repositorySlug} title={e.message}>
                  {e.repositorySlug}
                  {e.status ? ` (${e.status})` : ""}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <PullRequestStats pullRequests={visible} isLoading={isInitialLoad} />

      <section aria-label="Pull requests" className="flex flex-col gap-3">
        <PullRequestToolbar
          teams={teamsQuery.data?.teams ?? []}
          teamId={teamId}
          onTeamChange={setTeamId}
          fields={filterFields}
          query={filterQuery}
          onQueryChange={setFilterQuery}
        />

        <DataGrid
          table={table}
          recordCount={visible.length}
          isLoading={isInitialLoad}
          i18n={DATA_GRID_I18N_PT}
          emptyMessage={
            <QueueEmptyState hasConfig={hasConfig} filtered={pullRequests.length > 0} />
          }
          tableLayout={{
            dense: true,
            rowBorder: true,
            headerBorder: true,
            headerBackground: true,
            headerSticky: true,
            width: "fixed",
          }}
        >
          <DataGridContainer className="rounded-lg border bg-card">
            <DataGridTable />
          </DataGridContainer>
          {visible.length > PAGE_SIZE ? <DataGridPagination /> : null}
        </DataGrid>
      </section>
    </div>
  );
}

function QueueEmptyState({ hasConfig, filtered }: { hasConfig: boolean; filtered: boolean }) {
  if (!hasConfig) {
    return (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderGit2Icon />
          </EmptyMedia>
          <EmptyTitle>Nenhum repositório monitorado</EmptyTitle>
          <EmptyDescription>
            Sincronize os repositórios do workspace e escolha quais acompanhar.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" render={<Link href="/config" />} nativeButton={false}>
            Ir para Configuração
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleCheckIcon />
        </EmptyMedia>
        <EmptyTitle>{filtered ? "Nenhum PR neste filtro" : "Fila zerada"}</EmptyTitle>
        <EmptyDescription>
          {filtered
            ? "Ajuste ou limpe os filtros para ver os demais pull requests."
            : "Nenhum pull request aberto pelos membros monitorados."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
