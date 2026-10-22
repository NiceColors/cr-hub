"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookmarkCheckIcon,
  BookmarkPlusIcon,
  CircleCheckIcon,
  FolderGit2Icon,
  GitPullRequestIcon,
  InboxIcon,
  LayersIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { FilterField, FilterQuery } from "@/components/reui/filters/filters-types";
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/motion/alert";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { Checkbox } from "@/components/motion/checkbox";
import { Table } from "@/components/motion/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
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
import { buildPullRequestColumns } from "@/components/pull-requests/pull-request-columns";
import { PullRequestStats } from "@/components/pull-requests/pull-request-stats";
import { PullRequestToolbar } from "@/components/pull-requests/pull-request-toolbar";
import { PullRequestActionsProvider } from "@/components/pull-requests/pull-request-actions";
import { PullRequestDrawer } from "@/components/pull-requests/pull-request-drawer";
import { SaveViewDialog } from "@/components/pull-requests/save-view-dialog";
import {
  EMPTY_FILTER_QUERY,
  NO_TARGET,
  isFilterQuery,
  matchesQuery,
} from "@/components/pull-requests/filter-query";
import {
  useRepositories,
  useSavedViews,
  useSettings,
  useTeams,
  useUpdateSavedView,
} from "@/hooks/use-config";
import {
  useMe,
  usePullRequestInsights,
  usePullRequests,
  type PullRequestItem,
} from "@/hooks/use-pull-requests";
import { useHydrated } from "@/hooks/use-hydrated";
import { isAwaitingReviewBy, prKey, targetPriority } from "@/domain/pull-request";
import type { SavedView, SavedViewInput } from "@/lib/api/config";
import { fitTableHeight } from "@/lib/table-height";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 56;
const NO_PULL_REQUESTS: PullRequestItem[] = [];

type QueueTab = SavedViewInput["tab"];

type QueueState = {
  tab: QueueTab;
  teamId: number | null;
  filterQuery: FilterQuery;
  showSnoozed: boolean;
};

const DEFAULT_STATE: QueueState = {
  tab: "all",
  teamId: null,
  filterQuery: EMPTY_FILTER_QUERY,
  showSnoozed: false,
};

function stateFromView(view: SavedView): QueueState {
  return {
    tab: view.tab,
    teamId: view.teamId,
    filterQuery: isFilterQuery(view.filterQuery) ? view.filterQuery : EMPTY_FILTER_QUERY,
    showSnoozed: view.showSnoozed,
  };
}

function sameState(a: QueueState, b: QueueState) {
  return (
    a.tab === b.tab &&
    a.teamId === b.teamId &&
    a.showSnoozed === b.showSnoozed &&
    JSON.stringify(a.filterQuery) === JSON.stringify(b.filterQuery)
  );
}

function pullRequestRowId(pr: PullRequestItem) {
  return prKey(pr.repository.uuid, pr.id);
}

/** Destinos prioritários primeiro (hotfix, produção, release), depois do mais antigo ao mais novo. */
function byPriorityThenAge(a: PullRequestItem, b: PullRequestItem) {
  return (
    targetPriority(a.targetKind) - targetPriority(b.targetKind) ||
    Date.parse(a.createdOn) - Date.parse(b.createdOn)
  );
}

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
    {
      id: "target",
      label: "Destino",
      type: "select",
      options: [
        { value: "hotfix", label: "hotfix/*" },
        { value: "production", label: "master / main" },
        { value: "release", label: "release/*" },
        { value: NO_TARGET, label: "Outras branches" },
      ],
      placeholder: "Escolha o destino",
    },
    {
      id: "size",
      label: "Tamanho",
      type: "select",
      options: [
        { value: "P", label: "P (até 50 linhas)" },
        { value: "M", label: "M (até 250)" },
        { value: "G", label: "G (até 1000)" },
        { value: "GG", label: "GG (acima de 1000)" },
      ],
      placeholder: "Escolha o tamanho",
    },
    {
      id: "state",
      label: "Estado",
      type: "select",
      options: [
        { value: "waiting", label: "Aguardando" },
        { value: "in_review", label: "Em revisão" },
        { value: "changes_requested", label: "Mudanças pedidas" },
        { value: "approved", label: "Aprovado" },
      ],
      placeholder: "Escolha o estado",
    },
  ];
}

function TabCount({ value, tone }: { value: number; tone?: "attention" }) {
  return (
    <span
      className={cn(
        "ml-1.5 rounded-full px-1.5 font-mono text-xs tabular-nums",
        tone === "attention" && value > 0
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

export function PullRequestsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const viewId = viewParam && /^\d+$/.test(viewParam) ? Number(viewParam) : null;

  const hydrated = useHydrated();
  const viewsQuery = useSavedViews();
  const activeView = hydrated
    ? (viewsQuery.data?.views.find((v) => v.id === viewId) ?? null)
    : null;

  const [state, setState] = useState<QueueState>(DEFAULT_STATE);
  const [appliedViewId, setAppliedViewId] = useState<number | null>(null);
  if (activeView && appliedViewId !== activeView.id) {
    setAppliedViewId(activeView.id);
    setState(stateFromView(activeView));
  } else if (!viewId && appliedViewId !== null) {
    setAppliedViewId(null);
    setState(DEFAULT_STATE);
  }
  const patch = (next: Partial<QueueState>) => setState((s) => ({ ...s, ...next }));

  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  const repositoriesQuery = useRepositories();
  const teamsQuery = useTeams();
  const settingsQuery = useSettings();
  const me = useMe();
  const updateView = useUpdateSavedView();
  const meUuid = (hydrated && me.data?.uuid) || null;
  const pollIntervalSeconds = settingsQuery.data?.pollIntervalSeconds ?? 30;
  const jiraBaseUrl = settingsQuery.data?.jiraBaseUrl ?? null;

  const { query, refresh } = usePullRequests({
    teamId: state.teamId,
    refreshIntervalSec: pollIntervalSeconds,
  });

  const data = hydrated ? query.data : undefined;
  const pullRequests = data?.pullRequests ?? NO_PULL_REQUESTS;
  const fetchedAtMs = data ? Date.parse(data.fetchedAt) : 0;

  const repositoriesData = hydrated ? repositoriesQuery.data : undefined;
  const monitoredRepositories = useMemo(
    () => (repositoriesData?.repositories ?? []).filter((r) => r.monitored),
    [repositoriesData],
  );

  const byTab = useMemo(() => {
    const all: PullRequestItem[] = [];
    const mine: PullRequestItem[] = [];
    const authored: PullRequestItem[] = [];
    let awaiting = 0;
    for (const pr of pullRequests) {
      if (pr.authorMonitored) all.push(pr);
      if (meUuid && pr.author.uuid === meUuid) authored.push(pr);
      if (
        meUuid &&
        pr.author.uuid !== meUuid &&
        pr.reviewers.some((r) => r.uuid === meUuid && !r.approved && !r.changesRequested)
      ) {
        mine.push(pr);
        if (isAwaitingReviewBy(pr, meUuid, fetchedAtMs)) awaiting++;
      }
    }
    return { all, mine, authored, awaiting };
  }, [pullRequests, meUuid, fetchedAtMs]);

  const tabPullRequests = byTab[state.tab];
  const unsnoozed = useMemo(
    () => (state.showSnoozed ? tabPullRequests : tabPullRequests.filter((pr) => !pr.snooze)),
    [tabPullRequests, state.showSnoozed],
  );
  const snoozedHidden = tabPullRequests.length - unsnoozed.length;

  const insights = usePullRequestInsights(unsnoozed);

  const filterFields = useMemo(
    () => buildFilterFields(monitoredRepositories, pullRequests),
    [monitoredRepositories, pullRequests],
  );

  const visible = useMemo(
    () =>
      unsnoozed
        .filter((pr) => matchesQuery(pr, state.filterQuery, { insights }))
        .sort(byPriorityThenAge),
    [unsnoozed, state.filterQuery, insights],
  );

  const columns = useMemo(
    () => buildPullRequestColumns({ insights, jiraBaseUrl }),
    [insights, jiraBaseUrl],
  );

  const preview = previewKey
    ? (pullRequests.find((pr) => pullRequestRowId(pr) === previewKey) ?? null)
    : null;

  const configLoaded = repositoriesData !== undefined;
  const hasConfig = monitoredRepositories.length > 0;
  const isInitialLoad = !hydrated || query.isLoading || repositoriesQuery.isLoading;
  const viewDirty = activeView ? !sameState(state, stateFromView(activeView)) : false;
  const draft = {
    tab: state.tab,
    teamId: state.teamId,
    filterQuery: state.filterQuery,
    showSnoozed: state.showSnoozed,
  };

  return (
    <PullRequestActionsProvider
      meUuid={meUuid}
      onOpenPreview={(pr) => setPreviewKey(pullRequestRowId(pr))}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title={activeView ? activeView.name : "Fila de CRs"}
          description={
            activeView
              ? "Visão salva da fila de CRs."
              : "Pull requests abertos pelos membros monitorados. Destinos prioritários primeiro, depois do mais antigo para o mais novo."
          }
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
                <RefreshCwIcon className={cn("size-3.5", refresh.isPending && "animate-spin")} />
                Atualizar
              </Button>
            </>
          }
        />

        <Alert variant="warning" open={configLoaded && !hasConfig}>
          <AlertIcon />
          <AlertContent>
            <AlertTitle>Configuração incompleta</AlertTitle>
            <AlertDescription>
              Nenhum repositório monitorado. Sincronize e selecione os repositórios em{" "}
              <Link href="/config">Configuração</Link>.
            </AlertDescription>
          </AlertContent>
        </Alert>

        <Alert variant="warning" open={Boolean(data?.rateLimit?.retryAfterSeconds)}>
          <AlertIcon />
          <AlertContent>
            <AlertTitle>Limite da API do Bitbucket atingido</AlertTitle>
            <AlertDescription>
              Nova tentativa em{" "}
              <span className="font-mono tabular-nums">{data?.rateLimit?.retryAfterSeconds}s</span>.
            </AlertDescription>
          </AlertContent>
        </Alert>

        <Alert variant="destructive" open={Boolean(data?.errors.length)}>
          <AlertIcon />
          <AlertContent>
            <AlertTitle>Falha ao consultar {data?.errors.length} repositório(s)</AlertTitle>
            <AlertDescription>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                {data?.errors.map((e) => (
                  <li key={e.repositorySlug} title={e.message}>
                    {e.repositorySlug}
                    {e.status ? ` (${e.status})` : ""}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </AlertContent>
        </Alert>

        <PullRequestStats pullRequests={visible} insights={insights} isLoading={isInitialLoad} />

        <section aria-label="Pull requests" className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={state.tab}
              onValueChange={(value) => patch({ tab: value as QueueTab })}
              variant="segment"
            >
              <TabsList aria-label="Recorte da fila" className="border border-border">
                <TabsTrigger
                  value="all"
                  icon={<LayersIcon className="size-4" />}
                  className="px-3 py-1 text-xs"
                >
                  Todos
                  <TabCount value={byTab.all.length} />
                </TabsTrigger>
                <TabsTrigger
                  value="mine"
                  icon={<InboxIcon className="size-4" />}
                  className="px-3 py-1 text-xs"
                  disabled={!meUuid}
                  title={meUuid ? undefined : "Não foi possível identificar o dono do token"}
                >
                  Para mim
                  <TabCount value={byTab.awaiting} tone="attention" />
                </TabsTrigger>
                <TabsTrigger
                  value="authored"
                  icon={<GitPullRequestIcon className="size-4" />}
                  className="px-3 py-1 text-xs"
                  disabled={!meUuid}
                >
                  Meus PRs
                  <TabCount value={byTab.authored.length} />
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Checkbox
              checked={state.showSnoozed}
              onCheckedChange={(checked) => patch({ showSnoozed: checked })}
              label={
                snoozedHidden > 0 && !state.showSnoozed
                  ? `Mostrar silenciados (${snoozedHidden})`
                  : "Mostrar silenciados"
              }
              className="text-sm"
            />
          </div>

          <PullRequestToolbar
            teams={teamsQuery.data?.teams ?? []}
            teamId={state.teamId}
            onTeamChange={(teamId) => patch({ teamId })}
            fields={filterFields}
            query={state.filterQuery}
            onQueryChange={(filterQuery) => patch({ filterQuery })}
            actions={
              activeView && viewDirty ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updateView.isPending}
                  onClick={() => updateView.mutate({ id: activeView.id, input: draft })}
                >
                  <BookmarkCheckIcon className="size-3.5" />
                  Atualizar visão
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setSaveOpen(true)}>
                  <BookmarkPlusIcon className="size-3.5" />
                  Salvar visão
                </Button>
              )
            }
          />

          <Table
            data={visible}
            columns={columns}
            getRowId={pullRequestRowId}
            rowHeight={ROW_HEIGHT}
            height={fitTableHeight(visible.length, ROW_HEIGHT, { minRows: 5, maxRows: 14 })}
            loading={isInitialLoad}
            onRowClick={(pr) => setPreviewKey(pullRequestRowId(pr))}
            getRowLabel={(pr) => `Ver detalhes de ${pr.repository.slug} #${pr.id}: ${pr.title}`}
            getRowClassName={(pr) => (pr.snooze ? "opacity-60" : undefined)}
            emptyState={
              <QueueEmptyState
                hasConfig={hasConfig}
                tab={state.tab}
                filtered={tabPullRequests.length > 0}
              />
            }
            className="rounded-2xl"
          />
        </section>
      </div>

      <PullRequestDrawer
        pr={preview}
        insight={preview ? insights[pullRequestRowId(preview)] : undefined}
        jiraBaseUrl={jiraBaseUrl}
        onClose={() => setPreviewKey(null)}
      />

      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        draft={draft}
        onSaved={(id) => router.push(`/?view=${id}`)}
      />
    </PullRequestActionsProvider>
  );
}

const EMPTY_COPY: Record<QueueTab, { title: string; description: string }> = {
  all: {
    title: "Fila zerada",
    description: "Nenhum pull request aberto pelos membros monitorados.",
  },
  mine: {
    title: "Nada esperando por você",
    description: "Nenhum PR com revisão sua pendente nos repositórios monitorados.",
  },
  authored: {
    title: "Nenhum PR seu aberto",
    description: "Seus pull requests abertos nos repositórios monitorados aparecem aqui.",
  },
};

function QueueEmptyState({
  hasConfig,
  tab,
  filtered,
}: {
  hasConfig: boolean;
  tab: QueueTab;
  filtered: boolean;
}) {
  if (!hasConfig) {
    return (
      <Empty className="p-0">
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
          <ButtonLink href="/config" size="sm">
            Ir para Configuração
          </ButtonLink>
        </EmptyContent>
      </Empty>
    );
  }

  const copy = EMPTY_COPY[tab];
  return (
    <Empty className="p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleCheckIcon />
        </EmptyMedia>
        <EmptyTitle>{filtered ? "Nenhum PR neste filtro" : copy.title}</EmptyTitle>
        <EmptyDescription>
          {filtered
            ? "Ajuste ou limpe os filtros, ou mostre os silenciados, para ver os demais."
            : copy.description}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
