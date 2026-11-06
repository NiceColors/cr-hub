"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLinkIcon,
  FolderGit2Icon,
  GitBranchIcon,
  GlobeIcon,
  LockIcon,
  RefreshCwIcon,
  UsersIcon,
} from "lucide-react";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { StatefulButton } from "@/components/motion/button/stateful";
import { useMutationButtonState } from "@/hooks/use-mutation-button-state";
import {
  AdaptiveStepper,
  AdaptiveStepperDecrement,
  AdaptiveStepperIncrement,
  AdaptiveStepperValue,
} from "@/components/motion/adaptive-stepper";
import { Switch } from "@/components/motion/switch";
import { SegmentedControl } from "@/components/segmented-control";
import { Input } from "@/components/motion/input";
import { SectionHeader } from "@/components/config/section-header";
import { TableSearch, matchesSearch } from "@/components/config/table-search";
import { QueryError } from "@/components/query-error";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepositories, useSyncRepositories, useUpdateRepository } from "@/hooks/use-config";
import type { Repository } from "@/lib/api/config";
import { formatAgePtBR } from "@/domain/time";
import { DEFAULT_SLA } from "@/domain/pull-request";
import { cn } from "@/lib/utils";

const MIN_APPROVALS = 0;
const MAX_APPROVALS = 20;
const MAX_SLA_HOURS = 24 * 30;

type Scope = "all" | "monitored" | "idle";
type SortKey = "name" | "queue" | "updated";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Nome" },
  { value: "queue", label: "Fila" },
  { value: "updated", label: "Atualização" },
];

function formatWhen(iso: string | number | null) {
  if (iso === null) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatAgePtBR(date.toISOString());
}

function monogram(name: string) {
  const parts = name.split(/[\s/_-]+/).filter(Boolean);
  const raw = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return raw.toUpperCase();
}

function languageLabel(language: string) {
  return language.replace(/(^|[\s-])(\p{L})/gu, (_match, sep: string, char: string) => sep + char.toUpperCase());
}

function MonitorSwitch({ repository }: { repository: Repository }) {
  const update = useUpdateRepository();
  return (
    <span className="flex items-center gap-2 text-sm">
      <Switch
        size="sm"
        checked={repository.monitored}
        onCheckedChange={(checked) => update.mutate({ uuid: repository.uuid, monitored: checked })}
        aria-label={`Monitorar ${repository.name}`}
      />
      <span
        aria-hidden
        className={cn(repository.monitored ? "font-medium" : "text-muted-foreground")}
      >
        {repository.monitored ? "Na fila" : "Fora da fila"}
      </span>
    </span>
  );
}

const APPROVALS_SAVE_DELAY_MS = 500;

function MinApprovalsStepper({ repository }: { repository: Repository }) {
  const update = useUpdateRepository();
  const [draft, setDraft] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  // Cliques seguidos viram uma gravação só.
  function change(value: number) {
    setDraft(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (value !== repository.minApprovals) {
        update.mutate(
          { uuid: repository.uuid, minApprovals: value },
          { onSettled: () => setDraft(null) },
        );
      } else {
        setDraft(null);
      }
    }, APPROVALS_SAVE_DELAY_MS);
  }

  return (
    <Field label="Aprovações" className="col-span-2">
      <div className="h-9 w-[10.125rem]">
        <AdaptiveStepper
          value={draft ?? repository.minApprovals}
          onValueChange={change}
          min={MIN_APPROVALS}
          max={MAX_APPROVALS}
          disabled={!repository.monitored}
          aria-label={`Mínimo de aprovações para ${repository.name}`}
          className="origin-top-left scale-75"
        >
          <AdaptiveStepperDecrement />
          <AdaptiveStepperValue className="font-mono" />
          <AdaptiveStepperIncrement />
        </AdaptiveStepper>
      </div>
    </Field>
  );
}

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
    <Field label={label}>
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
        className="w-full"
        classNames={{ field: "h-8", input: "font-mono text-sm tabular-nums" }}
      />
    </Field>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Count({ value }: { value: number }) {
  return <span className="font-mono text-muted-foreground tabular-nums">{value}</span>;
}

function CatalogStats({
  total,
  monitored,
  openPullRequests,
  projects,
}: {
  total: number;
  monitored: number;
  openPullRequests: number;
  projects: number;
}) {
  const items = [
    { label: "No workspace", value: total, hint: "importados" },
    { label: "Na fila", value: monitored, hint: "monitorados" },
    { label: "PRs vistos", value: openPullRequests, hint: "ainda abertos" },
    { label: "Projetos", value: projects, hint: "no Bitbucket" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-card px-4 py-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-medium tabular-nums">{item.value}</span>
            <span className="text-xs text-muted-foreground">{item.hint}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RepositoryCard({ repository, index }: { repository: Repository; index: number }) {
  const updated = formatWhen(repository.updatedOn);
  const hasRemoteDetails = Boolean(
    repository.description || repository.language || repository.mainBranch || repository.projectName,
  );
  const visibleTeams = repository.teams.slice(0, 3);
  const hiddenTeams = repository.teams.length - visibleTeams.length;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card [content-visibility:auto] [contain-intrinsic-size:auto_220px]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards",
        !repository.monitored && "opacity-80",
      )}
      style={index < 8 ? { animationDelay: `${index * 40}ms` } : undefined}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          repository.monitored ? "bg-primary" : "bg-border",
        )}
        aria-hidden
      />
      <div className="grid gap-5 p-4 pl-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-start gap-3">
            <div
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted font-mono text-sm font-medium"
            >
              {monogram(repository.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="truncate text-base font-semibold text-balance">{repository.name}</h3>
                <MonitorSwitch repository={repository} />
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">{repository.slug}</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="font-mono text-2xl font-medium tabular-nums leading-none">
                {repository.openPullRequests}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {repository.openPullRequests === 1 ? "PR aberto" : "PRs abertos"}
              </p>
            </div>
          </div>

          <p className="text-sm text-pretty text-muted-foreground">
            {repository.description ||
              (hasRemoteDetails
                ? "Este repositório não tem descrição no Bitbucket."
                : "Sincronize para trazer descrição, linguagem, branch e projeto.")}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {repository.language ? (
              <AnimatedBadge status="info" size="sm" showIcon={false}>
                {languageLabel(repository.language)}
              </AnimatedBadge>
            ) : null}
            {repository.isPrivate === true ? (
              <AnimatedBadge size="sm" icon={<LockIcon className="size-3" />} showIcon>
                Privado
              </AnimatedBadge>
            ) : null}
            {repository.isPrivate === false ? (
              <AnimatedBadge size="sm" icon={<GlobeIcon className="size-3" />} showIcon>
                Público
              </AnimatedBadge>
            ) : null}
            {repository.mainBranch ? (
              <AnimatedBadge size="sm" icon={<GitBranchIcon className="size-3" />} showIcon>
                {repository.mainBranch}
              </AnimatedBadge>
            ) : null}
            {repository.projectName ? (
              <AnimatedBadge size="sm" showIcon={false}>
                {repository.projectKey ? `${repository.projectKey} · ${repository.projectName}` : repository.projectName}
              </AnimatedBadge>
            ) : null}
            {updated ? (
              <span className="text-xs text-muted-foreground">Atualizado {updated}</span>
            ) : null}
          </div>

          {repository.teams.length > 0 || repository.htmlUrl ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {repository.teams.length > 0 ? (
                <>
                  <UsersIcon className="size-3.5 text-muted-foreground" aria-hidden />
                  {visibleTeams.map((team) => (
                    <AnimatedBadge key={team.id} size="sm" showIcon={false}>
                      {team.name}
                    </AnimatedBadge>
                  ))}
                  {hiddenTeams > 0 ? (
                    <span className="text-xs text-muted-foreground tabular-nums">+{hiddenTeams}</span>
                  ) : null}
                </>
              ) : null}
              {repository.htmlUrl ? (
                <a
                  href={repository.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Bitbucket
                  <ExternalLinkIcon className="size-3" />
                </a>
              ) : null}
            </div>
          ) : null}

          <p className="font-mono text-sm tabular-nums text-muted-foreground sm:hidden">
            {repository.openPullRequests}{" "}
            {repository.openPullRequests === 1 ? "PR aberto" : "PRs abertos"}
          </p>
        </div>

        <div
          className={cn(
            "grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3",
            !repository.monitored && "opacity-60",
          )}
        >
          <MinApprovalsStepper repository={repository} />
          <SlaInput
            repository={repository}
            field="slaWarningHours"
            placeholder={DEFAULT_SLA.warningHours}
            label="Atenção (h)"
          />
          <SlaInput
            repository={repository}
            field="slaCriticalHours"
            placeholder={DEFAULT_SLA.criticalHours}
            label="Crítico (h)"
          />
        </div>
      </div>
    </article>
  );
}

export function RepositoriesPanel() {
  const repositoriesQuery = useRepositories();
  const { data, isLoading } = repositoriesQuery;
  const sync = useSyncRepositories();
  const syncState = useMutationButtonState(sync);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [language, setLanguage] = useState<string | null>(null);

  const repositories = data?.repositories;
  const monitoredCount = repositories?.filter((repo) => repo.monitored).length ?? 0;
  const idleCount = (repositories?.length ?? 0) - monitoredCount;
  const openPullRequests =
    repositories?.reduce((sum, repo) => sum + repo.openPullRequests, 0) ?? 0;
  const lastSync = repositories?.reduce<number | null>((latest, repo) => {
    if (repo.syncedAt === null) return latest;
    return latest === null || repo.syncedAt > latest ? repo.syncedAt : latest;
  }, null);

  const projectCount = useMemo(() => {
    const names = new Set<string>();
    for (const repo of repositories ?? []) {
      if (repo.projectName) names.add(repo.projectName);
    }
    return names.size;
  }, [repositories]);

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const repo of repositories ?? []) {
      if (!repo.language) continue;
      counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
    }
    return [...counts.entries()].toSorted(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"),
    );
  }, [repositories]);

  const visible = useMemo(() => {
    const filtered = (repositories ?? []).filter((repo) => {
      if (scope === "monitored" && !repo.monitored) return false;
      if (scope === "idle" && repo.monitored) return false;
      if (language && repo.language !== language) return false;
      return matchesSearch(
        search,
        repo.name,
        repo.slug,
        repo.description,
        repo.language,
        repo.mainBranch,
        repo.projectName,
        repo.projectKey,
        ...repo.teams.map((team) => team.name),
      );
    });
    return filtered.toSorted((a, b) => {
      if (sort === "queue") {
        return b.openPullRequests - a.openPullRequests || a.name.localeCompare(b.name, "pt");
      }
      if (sort === "updated") {
        const left = a.updatedOn ? Date.parse(a.updatedOn) : 0;
        const right = b.updatedOn ? Date.parse(b.updatedOn) : 0;
        return right - left || a.name.localeCompare(b.name, "pt");
      }
      return a.name.localeCompare(b.name, "pt");
    });
  }, [repositories, search, scope, language, sort]);

  const syncedLabel = formatWhen(lastSync ?? null);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Repositórios do workspace"
        description={
          syncedLabel
            ? `Catálogo sincronizado ${syncedLabel}. A fila usa o mínimo de aprovações e os limites de SLA de cada repositório.`
            : "Importe o workspace e defina quais repositórios entram na fila, com quantas aprovações e em quanto tempo."
        }
        actions={
          <StatefulButton
            variant="outline"
            size="sm"
            state={syncState}
            icon={<RefreshCwIcon className="size-3.5" />}
            loadingText="Sincronizando"
            successText="Sincronizado"
            errorText="Falhou"
            onClick={() => sync.mutate()}
          >
            Sincronizar
          </StatefulButton>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : repositoriesQuery.isError && !data ? (
        <QueryError
          title="Não foi possível carregar os repositórios"
          error={repositoriesQuery.error}
          onRetry={() => repositoriesQuery.refetch()}
          retrying={repositoriesQuery.isFetching}
        />
      ) : (
        <>
          <CatalogStats
            total={repositories?.length ?? 0}
            monitored={monitoredCount}
            openPullRequests={openPullRequests}
            projects={projectCount}
          />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <TableSearch
                value={search}
                onChange={setSearch}
                placeholder="Nome, slug, linguagem, time…"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <SegmentedControl
                  label="Filtrar repositórios"
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: "all", label: "Todos", suffix: <Count value={repositories?.length ?? 0} /> },
                    { value: "monitored", label: "Monitorados", suffix: <Count value={monitoredCount} /> },
                    { value: "idle", label: "Fora da fila", suffix: <Count value={idleCount} /> },
                  ]}
                />
                <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
                <SegmentedControl label="Ordenar repositórios" value={sort} onChange={setSort} options={SORTS} />
              </div>
            </div>

            {languages.length > 0 ? (
              <div role="group" aria-label="Filtrar por linguagem" className="flex gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  aria-pressed={language === null}
                  onClick={() => setLanguage(null)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors duration-fast ease-out",
                    language === null
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  Todas as linguagens
                </button>
                {languages.map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={language === name}
                    onClick={() => setLanguage((current) => (current === name ? null : name))}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors duration-fast ease-out",
                      language === name
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {languageLabel(name)}
                    <span className="font-mono tabular-nums">{count}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <Empty className="border py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderGit2Icon />
                </EmptyMedia>
                <EmptyTitle>
                  {repositories?.length
                    ? "Nenhum repositório neste recorte"
                    : "Nenhum repositório"}
                </EmptyTitle>
                <EmptyDescription>
                  {repositories?.length
                    ? "Troque o filtro ou limpe a busca para ver o restante do workspace."
                    : "Sincronize para importar os repositórios do Bitbucket."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((repository, index) => (
                <RepositoryCard key={repository.uuid} repository={repository} index={index} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
