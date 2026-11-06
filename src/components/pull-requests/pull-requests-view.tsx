"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookmarkCheckIcon,
  BookmarkPlusIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  FolderGit2Icon,
  FolderKanbanIcon,
  GitPullRequestIcon,
  InboxIcon,
  LayersIcon,
  ListIcon,
  RefreshCwIcon,
} from "lucide-react";
import type {
  FilterField,
  FilterOperator,
  FilterQuery,
} from "@/components/reui/filters/filters-types";
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/motion/alert";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { StatefulButton } from "@/components/motion/button/stateful";
import { useMutationButtonState } from "@/hooks/use-mutation-button-state";
import { Checkbox } from "@/components/motion/checkbox";
import { Table, type SortState, type TableColumn } from "@/components/motion/table";
import { sortByColumn } from "@/components/motion/table/use-column-sort";
import { SegmentedControl } from "@/components/segmented-control";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { PULL_REQUEST_READ_SCOPE } from "@/lib/bitbucket/scopes";
import { RelativeTime } from "@/components/relative-time";
import { buildPullRequestColumns } from "@/components/pull-requests/pull-request-columns";
import { PullRequestStats } from "@/components/pull-requests/pull-request-stats";
import { PullRequestToolbar } from "@/components/pull-requests/pull-request-toolbar";
import {
  PullRequestActionsProvider,
  PullRequestContextMenu,
} from "@/components/pull-requests/pull-request-actions";
import { PullRequestDrawer } from "@/components/pull-requests/pull-request-drawer";
import { SaveViewDialog } from "@/components/pull-requests/save-view-dialog";
import {
  EMPTY_FILTER_QUERY,
  FILTER_OPERATOR_LABELS_PT,
  NO_TARGET,
  UNLINKED_PROJECT,
  isFilterQuery,
  matchesQuery,
} from "@/components/pull-requests/filter-query";
import {
  groupQueueByProject,
  projectIdFromGroup,
  projectIdsByKey,
  type GroupedQueueRow,
} from "@/components/pull-requests/project-queue";
import { ProjectKindBadge } from "@/components/projects/project-kind";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { PROJECT_KIND_LABELS } from "@/domain/project";
import { useProjects, type Project } from "@/hooks/use-projects";
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
import { useFocus, type FocusItem } from "@/hooks/use-focus";
import { useOnCall } from "@/hooks/use-on-call";
import { OnCallStrip } from "@/components/on-call-strip";
import { FocusStrip, type FocusStatus } from "@/components/pull-requests/focus-strip";
import { QueuePaginationBar } from "@/components/pull-requests/queue-pagination-bar";
import {
  QueueCalendar,
  type QueueCalendarGroup,
} from "@/components/pull-requests/queue-calendar";
import { useQueueLayout, type QueueLayout } from "@/components/pull-requests/queue-layout";
import {
  paginate,
  type QueuePageSize,
} from "@/components/pull-requests/queue-pagination";
import { isAwaitingReviewBy, prKey, targetPriority } from "@/domain/pull-request";
import { DEFAULT_POLL_INTERVAL_SECONDS, type SavedView, type SavedViewInput } from "@/lib/api/config";
import { fitTableHeight } from "@/lib/table-height";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 56;
const NO_PULL_REQUESTS: PullRequestItem[] = [];
const NO_FOCUS: FocusItem[] = [];

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

/** Visões salvas antigas usam `is`/`is_not`; ficam ocultos, mas continuam válidos. */
const REPOSITORY_OPERATORS: FilterOperator[] = [
  { value: "is_any_of", label: FILTER_OPERATOR_LABELS_PT.is_any_of, arity: "many", inverse: "is_none_of" },
  { value: "is_none_of", label: FILTER_OPERATOR_LABELS_PT.is_none_of, arity: "many", inverse: "is_any_of" },
  { value: "is", label: FILTER_OPERATOR_LABELS_PT.is, inverse: "is_not", hidden: true },
  { value: "is_not", label: FILTER_OPERATOR_LABELS_PT.is_not, inverse: "is", hidden: true },
];

function buildFilterFields(
  repositories: { uuid: string; name: string }[],
  pullRequests: PullRequestItem[],
  projects: Project[],
): FilterField[] {
  const authors = new Map<string, string>();
  for (const pr of pullRequests) authors.set(pr.author.uuid, pr.author.displayName);

  return [
    {
      id: "repository",
      label: "Repositório",
      type: "select",
      options: repositories.map((r) => ({ value: r.uuid, label: r.name })),
      operators: REPOSITORY_OPERATORS,
      defaultOperator: "is_any_of",
      placeholder: "Escolha os repositórios",
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
    {
      id: "project",
      label: "Vínculo",
      type: "select",
      options: [
        ...projects
          .toSorted((a, b) => a.name.localeCompare(b.name, "pt"))
          .map((project) => ({
            value: String(project.id),
            label:
              project.status === "done"
                ? `${PROJECT_KIND_LABELS[project.kind]} · ${project.name} · concluído`
                : `${PROJECT_KIND_LABELS[project.kind]} · ${project.name}`,
          })),
        { value: UNLINKED_PROJECT, label: "Sem vínculo" },
      ],
      operators: REPOSITORY_OPERATORS,
      defaultOperator: "is_any_of",
      placeholder: "Escolha o vínculo",
    },
  ];
}

function columnsForQueueRows(
  columns: TableColumn<PullRequestItem>[],
): TableColumn<GroupedQueueRow<PullRequestItem>>[] {
  return columns.map((column) => ({
    key: column.key,
    header: column.header,
    sortable: column.sortable,
    align: column.align,
    width: column.width,
    hideBelow: column.hideBelow,
    truncate: column.truncate,
    cell: column.cell ? (row) => column.cell!(row.item) : undefined,
  }));
}

function ProjectGroupHeading({
  project,
  count,
  onEdit,
}: {
  project: Project | null;
  count: number;
  onEdit?: () => void;
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2 text-sm">
      {project ? <ProjectKindBadge kind={project.kind} /> : null}
      <span className="truncate font-medium">{project ? project.name : "Sem vínculo"}</span>
      {project?.status === "done" ? (
        <span className="text-xs text-muted-foreground">Concluído</span>
      ) : null}
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Editar
        </button>
      ) : null}
    </div>
  );
}

function TabCount({ value, tone }: { value: number; tone?: "attention" }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 font-mono text-xs tabular-nums",
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
  const [groupByProject, setGroupByProject] = useState(false);
  const [layout, setLayout] = useQueueLayout();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<QueuePageSize>(10);
  const [sort, setSort] = useState<SortState | null>(null);
  const pagingKey = `${state.tab}\0${state.teamId ?? ""}\0${state.showSnoozed}\0${groupByProject}\0${JSON.stringify(state.filterQuery)}\0${sort ? `${sort.key}:${sort.direction}` : ""}`;
  const [trackedPagingKey, setTrackedPagingKey] = useState(pagingKey);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const repositoriesQuery = useRepositories();
  const teamsQuery = useTeams();
  const settingsQuery = useSettings();
  const me = useMe();
  const updateView = useUpdateSavedView();
  const meUuid = (hydrated && me.data?.uuid) || null;
  const pollIntervalSeconds = settingsQuery.data?.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
  const jiraBaseUrl = settingsQuery.data?.jiraBaseUrl ?? null;

  const { query, refresh } = usePullRequests({
    teamId: state.teamId,
    refreshIntervalSec: pollIntervalSeconds,
  });
  const refreshState = useMutationButtonState(refresh);

  const data = hydrated ? query.data : undefined;
  const repoErrors = (data?.errors ?? []).filter((error) => error.status !== 429);
  const rateLimited =
    Boolean(data?.rateLimit?.retryAfterSeconds) ||
    (data?.errors ?? []).some((error) => error.status === 429);
  const missingPullRequestScope = Boolean(
    repoErrors.length > 0 &&
      repoErrors.every((error) => error.requiredScopes?.includes(PULL_REQUEST_READ_SCOPE)),
  );
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
  const { projects } = useProjects();
  const projectIndex = useMemo(() => projectIdsByKey(projects), [projects]);

  const filterFields = useMemo(
    () => buildFilterFields(monitoredRepositories, pullRequests, projects),
    [monitoredRepositories, pullRequests, projects],
  );

  const onCall = useOnCall();
  const focus = useFocus();
  const focusItems = hydrated ? focus.items : NO_FOCUS;
  const focusKeys = useMemo(() => new Set(focusItems.map((i) => i.prKey)), [focusItems]);

  const visible = useMemo(() => {
    const filtered = unsnoozed.filter((pr) =>
      matchesQuery(pr, state.filterQuery, { insights, projectIdsByKey: projectIndex }),
    );
    if (state.tab !== "mine") return filtered.sort(byPriorityThenAge);
    // Em "Para mim", os PRs do foco de hoje ficam fixados no topo.
    const pinned = (pr: PullRequestItem) => (focusKeys.has(pullRequestRowId(pr)) ? 0 : 1);
    return filtered.sort((a, b) => pinned(a) - pinned(b) || byPriorityThenAge(a, b));
  }, [unsnoozed, state.filterQuery, state.tab, insights, focusKeys, projectIndex]);

  const columns = useMemo(
    () =>
      buildPullRequestColumns({
        insights,
        jiraBaseUrl,
        suggestFor: onCall.suggestFor,
        focusKeys,
      }),
    [insights, jiraBaseUrl, onCall.suggestFor, focusKeys],
  );
  const groupedColumns = useMemo(() => columnsForQueueRows(columns), [columns]);

  // Ordena a fila inteira antes de paginar; a Table só exibe o indicador.
  const sortedVisible = useMemo(
    () => (sort ? sortByColumn(visible, columns, sort) : visible),
    [visible, columns, sort],
  );

  const groupedRows = useMemo(
    () => groupQueueByProject(sortedVisible, pullRequestRowId, projects, projectIndex),
    [sortedVisible, projects, projectIndex],
  );
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of groupedRows) counts.set(row.groupId, (counts.get(row.groupId) ?? 0) + 1);
    return counts;
  }, [groupedRows]);

  const requestedPage = trackedPagingKey === pagingKey ? page : 1;
  const flatPage = paginate(sortedVisible, requestedPage, pageSize);
  const groupedPage = paginate(groupedRows, requestedPage, pageSize);
  const queuePage = groupByProject ? groupedPage : flatPage;
  if (trackedPagingKey !== pagingKey) {
    setTrackedPagingKey(pagingKey);
    setPage(queuePage.page);
  } else if (queuePage.page !== page) {
    setPage(queuePage.page);
  }
  const projectById = (id: number | null) =>
    id === null ? null : (projects.find((project) => project.id === id) ?? null);

  const groupCalendarDay = (items: PullRequestItem[]): QueueCalendarGroup[] => {
    const blocks: { id: string; items: PullRequestItem[] }[] = [];
    for (const row of groupQueueByProject(items, pullRequestRowId, projects, projectIndex)) {
      const last = blocks.at(-1);
      if (last?.id === row.groupId) last.items.push(row.item);
      else blocks.push({ id: row.groupId, items: [row.item] });
    }
    return blocks.map((block) => {
      const project = projectById(projectIdFromGroup(block.id));
      return {
        ...block,
        label: (
          <ProjectGroupHeading
            project={project}
            count={block.items.length}
            onEdit={project ? () => setEditingProject(project) : undefined}
          />
        ),
      };
    });
  };

  const groupedPageHeaders = groupedPage.items.reduce(
    (count, row, index, rows) =>
      count + (index === 0 || rows[index - 1].groupId !== row.groupId ? 1 : 0),
    0,
  );

  const focusStatus = (item: FocusItem): FocusStatus => {
    const pr = pullRequests.find((p) => pullRequestRowId(p) === item.prKey);
    if (!pr) return "gone";
    const mine = pr.reviewers.find((r) => r.uuid === meUuid);
    return mine && (mine.approved || mine.changesRequested) ? "reviewed" : "pending";
  };

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
          actionsOnTitleRow
          title={activeView ? activeView.name : "Fila de CRs"}
          description={
            activeView
              ? "Visão salva da fila de CRs."
              : "Pull requests abertos pelos membros monitorados. Destinos prioritários primeiro, depois do mais antigo para o mais novo."
          }
          actions={
            <>
              <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                {data ? (
                  <>
                    Atualizado <RelativeTime iso={data.fetchedAt} />
                    {" · "}a cada {pollIntervalSeconds}s
                  </>
                ) : (
                  "Aguardando primeira atualização"
                )}
              </span>
              <StatefulButton
                variant="outline"
                size="sm"
                className="shrink-0 whitespace-nowrap"
                state={refreshState}
                icon={<RefreshCwIcon className="size-3.5" />}
                loadingText="Atualizando"
                successText="Atualizado"
                errorText="Falhou"
                onClick={() => refresh.mutate()}
              >
                Atualizar
              </StatefulButton>
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

        <Alert variant="warning" open={rateLimited}>
          <AlertIcon />
          <AlertContent>
            <AlertTitle>Limite da API do Bitbucket atingido</AlertTitle>
            <AlertDescription>
              A fila segue com os dados já carregados.
              {data?.rateLimit?.retryAfterSeconds ? (
                <>
                  {" "}
                  Nova tentativa em{" "}
                  <span className="font-mono tabular-nums">
                    {data.rateLimit.retryAfterSeconds}s
                  </span>
                  .
                </>
              ) : (
                " Nova tentativa no próximo ciclo."
              )}
            </AlertDescription>
          </AlertContent>
        </Alert>

        <Alert variant="destructive" open={missingPullRequestScope}>
          <AlertIcon />
          <AlertContent>
            <AlertTitle>O token não lê pull requests</AlertTitle>
            <AlertDescription>
              Falta o escopo <span className="font-mono">read:pullrequest:bitbucket</span>. Gere um
              API token com esse escopo e com{" "}
              <span className="font-mono">write:pullrequest:bitbucket</span> e atualize em{" "}
              <Link href="/config">Configuração → Integrações</Link>.
            </AlertDescription>
          </AlertContent>
        </Alert>

        <Alert variant="destructive" open={repoErrors.length > 0 && !missingPullRequestScope}>
          <AlertIcon />
          <AlertContent>
            <AlertTitle>Falha ao consultar {repoErrors.length} repositório(s)</AlertTitle>
            <AlertDescription>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                {repoErrors.map((e) => (
                  <li key={e.repositorySlug} title={e.message}>
                    {e.repositorySlug}
                    {e.status ? ` (${e.status})` : ""}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </AlertContent>
        </Alert>

        <OnCallStrip entries={onCall.entries} teamId={state.teamId} />

        <PullRequestStats pullRequests={visible} insights={insights} isLoading={isInitialLoad} />

        <section aria-label="Pull requests" className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl
              label="Recorte da fila"
              value={state.tab}
              onChange={(tab) => patch({ tab })}
              options={[
                {
                  value: "all",
                  label: "Todos",
                  icon: <LayersIcon />,
                  suffix: <TabCount value={byTab.all.length} />,
                },
                {
                  value: "mine",
                  label: "Para mim",
                  icon: <InboxIcon />,
                  suffix: <TabCount value={byTab.awaiting} tone="attention" />,
                  disabled: !meUuid,
                  title: meUuid ? undefined : "Não foi possível identificar o dono do token",
                },
                {
                  value: "authored",
                  label: "Meus PRs",
                  icon: <GitPullRequestIcon />,
                  suffix: <TabCount value={byTab.authored.length} />,
                  disabled: !meUuid,
                },
              ]}
            />

            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl<QueueLayout>
                label="Visualização da fila"
                value={layout}
                onChange={setLayout}
                options={[
                  { value: "table", label: "Lista", icon: <ListIcon /> },
                  { value: "calendar", label: "Calendário", icon: <CalendarDaysIcon /> },
                ]}
                className="shrink-0"
              />
              <Button
                variant={groupByProject ? "secondary" : "outline"}
                size="sm"
                aria-pressed={groupByProject}
                onClick={() => setGroupByProject((current) => !current)}
              >
                <FolderKanbanIcon className="size-3.5" />
                Por projeto
              </Button>
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
          </div>

          {state.tab === "mine" ? <FocusStrip items={focusItems} statusOf={focusStatus} /> : null}

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

          {layout === "calendar" ? (
            isInitialLoad ? (
              <Skeleton className="h-80 rounded-2xl" aria-label="Carregando calendário" />
            ) : visible.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-6 py-10">
                <QueueEmptyState
                  hasConfig={hasConfig}
                  tab={state.tab}
                  filtered={tabPullRequests.length > 0}
                />
              </div>
            ) : (
              <QueueCalendar
                pullRequests={visible}
                onOpen={(pr) => setPreviewKey(pullRequestRowId(pr))}
                groupDay={groupByProject ? groupCalendarDay : undefined}
                pageSize={pageSize}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(1);
                }}
              />
            )
          ) : groupByProject ? (
            <PullRequestContextMenu
              resolve={(rowId) =>
                groupedPage.items.find(
                  (row) => `${row.groupId}:${pullRequestRowId(row.item)}` === rowId,
                )?.item ?? null
              }
            >
              <Table
                data={groupedPage.items}
                columns={groupedColumns}
                sort={sort}
                onSortChange={setSort}
                manualSort
                getRowId={(row) => `${row.groupId}:${pullRequestRowId(row.item)}`}
                getRowGroup={(row) => {
                  const projectId = projectIdFromGroup(row.groupId);
                  const project =
                    projectId === null ? null : (projects.find((item) => item.id === projectId) ?? null);
                  return {
                    id: row.groupId,
                    label: (
                      <ProjectGroupHeading
                        project={project}
                        count={groupCounts.get(row.groupId) ?? 0}
                        onEdit={project ? () => setEditingProject(project) : undefined}
                      />
                    ),
                  };
                }}
                rowHeight={ROW_HEIGHT}
                height={fitTableHeight(groupedPage.items.length + groupedPageHeaders, ROW_HEIGHT, {
                  minRows: 5,
                  maxRows: pageSize,
                })}
                loading={isInitialLoad}
                onRowClick={(row) => setPreviewKey(pullRequestRowId(row.item))}
                getRowClassName={(row) => (row.item.snooze ? "opacity-60" : undefined)}
                emptyState={
                  <QueueEmptyState
                    hasConfig={hasConfig}
                    tab={state.tab}
                    filtered={tabPullRequests.length > 0}
                  />
                }
                fitContainer
                className="rounded-2xl"
              />
            </PullRequestContextMenu>
          ) : (
            <PullRequestContextMenu
              resolve={(rowId) =>
                flatPage.items.find((pr) => pullRequestRowId(pr) === rowId) ?? null
              }
            >
              <Table
                data={flatPage.items}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                manualSort
                getRowId={pullRequestRowId}
                rowHeight={ROW_HEIGHT}
                height={fitTableHeight(flatPage.items.length, ROW_HEIGHT, {
                  minRows: 5,
                  maxRows: pageSize,
                })}
                loading={isInitialLoad}
                onRowClick={(pr) => setPreviewKey(pullRequestRowId(pr))}
                getRowClassName={(pr) => (pr.snooze ? "opacity-60" : undefined)}
                emptyState={
                  <QueueEmptyState
                    hasConfig={hasConfig}
                    tab={state.tab}
                    filtered={tabPullRequests.length > 0}
                  />
                }
                fitContainer
                className="rounded-2xl"
              />
            </PullRequestContextMenu>
          )}

          {layout === "table" && queuePage.total > 0 ? (
            <QueuePaginationBar
              page={queuePage.page}
              pageCount={queuePage.pageCount}
              pageSize={pageSize}
              start={queuePage.start}
              end={queuePage.end}
              total={queuePage.total}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(1);
              }}
            />
          ) : null}
        </section>
      </div>

      <PullRequestDrawer
        pr={preview}
        insight={preview ? insights[pullRequestRowId(preview)] : undefined}
        jiraBaseUrl={jiraBaseUrl}
        onClose={() => setPreviewKey(null)}
      />

      <ProjectDialog
        open={editingProject !== null}
        project={editingProject}
        onOpenChange={(open) => {
          if (!open) setEditingProject(null);
        }}
        onSaved={() => setEditingProject(null)}
        onDeleted={() => setEditingProject(null)}
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
