"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { usePullRequests } from "@/hooks/usePullRequests";
import { formatAgePtBR } from "@/domain/time";
import {
  useTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Badge } from "@/components/reui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Filters } from "@/components/reui/filters/filters";
import type { FilterQuery, FilterRule } from "@/components/reui/filters/filters-types";

const repositoriesSchema = z.object({
  repositories: z.array(
    z.object({
      uuid: z.string(),
      slug: z.string(),
      name: z.string(),
      monitored: z.boolean(),
      minApprovals: z.number(),
    }),
  ),
});

const teamsSchema = z.object({
  teams: z.array(z.object({ id: z.number(), name: z.string() })),
});

const settingsSchema = z.object({ pollIntervalSeconds: z.number() });

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error(`Resposta inválida (${url})`);
  return parsed.data;
}

function ageLabel(iso: string) {
  return formatAgePtBR(iso);
}

function stateBadgeVariant(state: string) {
  switch (state) {
    case "approved":
      return "success";
    case "changes_requested":
      return "destructive";
    case "in_review":
      return "info";
    case "waiting":
    default:
      return "secondary";
  }
}

function stateLabel(state: string) {
  switch (state) {
    case "approved":
      return "Aprovado";
    case "changes_requested":
      return "Mudanças pedidas";
    case "in_review":
      return "Em revisão";
    case "waiting":
    default:
      return "Aguardando";
  }
}

export function PullRequestsPage() {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [filtersQuery, setFiltersQuery] = useState<FilterQuery>({
    id: "root",
    type: "group",
    combinator: "and",
    rules: [],
  });
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void nowTick;

  const reposQ = useQuery({
    queryKey: ["config-repositories"],
    queryFn: () => fetchJson("/api/config/repositories", repositoriesSchema),
  });
  const teamsQ = useQuery({
    queryKey: ["config-teams"],
    queryFn: () => fetchJson("/api/config/teams", teamsSchema),
  });
  const settingsQ = useQuery({
    queryKey: ["config-settings"],
    queryFn: () => fetchJson("/api/config/settings", settingsSchema),
  });

  const pollIntervalSeconds = settingsQ.data?.pollIntervalSeconds ?? 30;

  const { query: prsQ, refreshNow } = usePullRequests({
    filters: { teamId: selectedTeamId },
    refreshIntervalSec: pollIntervalSeconds,
  });

  const monitoredRepos = useMemo(
    () => (reposQ.data?.repositories ?? []).filter((r) => r.monitored),
    [reposQ.data],
  );

  const filterFields = useMemo(() => {
    const repoOptions = monitoredRepos.map((r) => ({
      value: r.uuid,
      label: r.name,
      data: r,
    }));
    const authorOptions = (prsQ.data?.pullRequests ?? []).map((p) => ({
      value: p.author.uuid,
      label: p.author.displayName,
      data: p.author,
    }));
    // dedup autores
    const seen = new Set<string>();
    const uniqueAuthors = authorOptions.filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });

    return [
      {
        id: "repository",
        label: "Repositório",
        type: "select" as const,
        options: repoOptions,
        placeholder: "Escolha um repositório",
      },
      {
        id: "author",
        label: "Autor",
        type: "select" as const,
        options: uniqueAuthors,
        placeholder: "Escolha um autor",
      },
    ];
  }, [monitoredRepos, prsQ.data?.pullRequests]);

  const { selectedRepoUuids, selectedAuthorUuids } = useMemo(() => {
    const repo = new Set<string>();
    const author = new Set<string>();

    function walk(rules: Array<FilterRule<any> | any>) {
      for (const node of rules) {
        if (!node) continue;
        if (node.type === "group") walk(node.rules ?? []);
        if (node.type !== "rule") continue;
        const path0 = node.path?.[0];
        const op = node.operator;
        const v = node.value;
        const addValue = (set: Set<string>, value: unknown) => {
          if (typeof value === "string" && value) set.add(value);
        };
        const addMany = (set: Set<string>, value: unknown) => {
          if (Array.isArray(value)) value.forEach((x) => addValue(set, x));
        };

        if (path0 === "repository") {
          if (op === "is") addValue(repo, v);
          if (op === "is_any_of") addMany(repo, v);
        }
        if (path0 === "author") {
          if (op === "is") addValue(author, v);
          if (op === "is_any_of") addMany(author, v);
        }
      }
    }

    walk(filtersQuery.rules);
    return {
      selectedRepoUuids: repo,
      selectedAuthorUuids: author,
    };
  }, [filtersQuery]);

  const filtered = useMemo(() => {
    const prs = prsQ.data?.pullRequests ?? [];
    const byRepo =
      selectedRepoUuids.size > 0
        ? prs.filter((p) => selectedRepoUuids.has(p.repository.uuid))
        : prs;
    const byAuthor =
      selectedAuthorUuids.size > 0
        ? byRepo.filter((p) => selectedAuthorUuids.has(p.author.uuid))
        : byRepo;
    return byAuthor;
  }, [prsQ.data, selectedRepoUuids, selectedAuthorUuids]);

  const summary = useMemo(() => {
    const over24 = filtered.filter(
      (p) => p.ageBand === "warning" || p.ageBand === "critical",
    ).length;
    const over72 = filtered.filter((p) => p.ageBand === "critical").length;
    return { over24, over72 };
  }, [filtered]);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdOn", desc: false },
  ]);

  type Row = (typeof filtered)[number];
  type Features = typeof dataGridFeatures;

  const columns = useMemo<ColumnDef<Features, Row>[]>(() => {
    return [
      {
        id: "createdOn",
        accessorFn: (row: Row) => row.createdOn,
        header: "Idade",
        cell: (ctx: any) => {
          const pr: Row = ctx.row.original;
          const variant =
            pr.ageBand === "critical"
              ? "destructive"
              : pr.ageBand === "warning"
                ? "warning"
                : "secondary";
          const aria =
            pr.ageBand === "critical"
              ? "Aberto há mais de 72 horas"
              : pr.ageBand === "warning"
                ? "Aberto há mais de 24 horas"
                : undefined;

          return (
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  pr.ageBand === "critical"
                    ? "bg-destructive"
                    : pr.ageBand === "warning"
                      ? "bg-warning"
                      : "bg-muted-foreground/40"
                }`}
                aria-label={aria}
              />
              <span
                className={
                  pr.ageBand === "critical"
                    ? "text-destructive"
                    : pr.ageBand === "warning"
                      ? "text-warning-foreground"
                      : ""
                }
              >
                {ageLabel(pr.createdOn)}
              </span>
              {pr.ageBand !== "normal" ? (
                <Badge variant={variant as any} size="sm" radius="full">
                  {pr.ageBand === "critical" ? "&gt;72h" : "&gt;24h"}
                </Badge>
              ) : null}
            </div>
          );
        },
        sortingFn: (a: any, b: any) =>
          Date.parse(a.original.createdOn) - Date.parse(b.original.createdOn),
      },
      {
        id: "title",
        accessorFn: (row: Row) => row.title,
        header: "Pull request",
        cell: (ctx: any) => {
          const pr: Row = ctx.row.original;
          return (
            <div className="min-w-0">
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate font-medium hover:underline"
                title={pr.title}
              >
                {pr.title}
              </a>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {pr.repository.slug} · #{pr.id}
              </div>
            </div>
          );
        },
      },
      {
        id: "author",
        accessorFn: (row: Row) => row.author.displayName,
        header: "Autor",
        cell: (ctx: any) => {
          const pr: Row = ctx.row.original;
          const initial = pr.author.displayName.trim().slice(0, 1).toUpperCase();
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                {pr.author.avatarUrl ? (
                  <AvatarImage src={pr.author.avatarUrl} alt={pr.author.displayName} />
                ) : null}
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <span className="truncate">{pr.author.displayName}</span>
            </div>
          );
        },
      },
      {
        id: "approvals",
        accessorFn: (row: Row) => row.approvals,
        header: "Aprov.",
        cell: (ctx: any) => {
          const pr: Row = ctx.row.original;
          const ok = pr.approvals >= pr.minApprovals;
          return (
            <Badge
              variant={(ok ? "success-light" : "secondary") as any}
              size="default"
              radius="full"
            >
              {pr.approvals}/{pr.minApprovals}
            </Badge>
          );
        },
      },
      {
        id: "state",
        accessorFn: (row: Row) => row.reviewState,
        header: "Estado",
        cell: (ctx: any) => {
          const pr: Row = ctx.row.original;
          const variant = stateBadgeVariant(pr.reviewState);
          return (
            <Badge variant={variant as any} radius="full">
              {stateLabel(pr.reviewState)}
            </Badge>
          );
        },
      },
    ];
  }, []);

  const table = useTable({
    features: dataGridFeatures,
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const fetchedAt = prsQ.data?.fetchedAt ? new Date(prsQ.data.fetchedAt) : null;
  const updatedAgo = fetchedAt ? ageLabel(fetchedAt.toISOString()) : "—";

  const hasConfig = monitoredRepos.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fila de CRs</h1>
          <p className="text-sm text-muted-foreground">
            Pull Requests abertos dos usuários monitorados.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tooltip>
            <TooltipTrigger className="text-xs text-muted-foreground">
              Atualizado: {updatedAgo}
            </TooltipTrigger>
            <TooltipContent>
              {fetchedAt ? fetchedAt.toLocaleString("pt-BR") : "Sem atualização"}
            </TooltipContent>
          </Tooltip>
          <button
            onClick={() => void refreshNow()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            disabled={prsQ.isFetching}
          >
            Atualizar agora
          </button>
        </div>
      </div>

      {!hasConfig ? (
        <Alert variant="warning">
          <AlertTitle>Configuração incompleta</AlertTitle>
          <AlertDescription>
            Nenhum repositório monitorado ainda. Vá em{" "}
            <Link href="/config" className="underline">
              Configuração
            </Link>{" "}
            para sincronizar e selecionar.
          </AlertDescription>
        </Alert>
      ) : null}

      {prsQ.data?.rateLimit?.retryAfterSeconds ? (
        <Alert variant="warning">
          <AlertTitle>Limite da API atingido</AlertTitle>
          <AlertDescription>
            Nova tentativa em {prsQ.data.rateLimit.retryAfterSeconds}s.
          </AlertDescription>
        </Alert>
      ) : null}

      {prsQ.data?.errors?.length ? (
        <Alert variant="destructive">
          <AlertTitle>Falhas por repositório</AlertTitle>
          <AlertDescription>
            {prsQ.data.errors
              .map(
                (e) =>
                  `${e.repositorySlug}${e.status ? ` (${e.status})` : ""}`,
              )
              .join(", ")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Time</span>
          <select
            value={selectedTeamId ?? ""}
            onChange={(e) =>
              setSelectedTeamId(e.target.value ? Number(e.target.value) : null)
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {(teamsQ.data?.teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <div className="mb-1 text-xs text-muted-foreground">Filtros</div>
          <Filters
            fields={filterFields as any}
            query={filtersQuery as any}
            onQueryChange={(q) => setFiltersQuery(q as any)}
            showClear
            size="sm"
          />
        </div>

        <div className="rounded-lg border border-border bg-background p-3 text-sm sm:col-span-1">
          <div className="text-xs text-muted-foreground">Resumo</div>
          <div className="mt-0.5 font-medium">
            {filtered.length} abertos ·{" "}
            <span className="text-warning-foreground">{summary.over24}</span>{" "}
            &gt; 24h ·{" "}
            <span className="text-destructive">{summary.over72}</span> &gt; 72h
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Polling: {pollIntervalSeconds}s
          </div>
        </div>
      </div>

      <DataGrid
        table={table as any}
        recordCount={filtered.length}
        isLoading={prsQ.isLoading || prsQ.isFetching}
        tableLayout={{
          dense: true,
          rowBorder: true,
          headerSticky: false,
          headerBorder: true,
          width: "fixed",
        }}
      >
        <DataGridContainer className="rounded-lg border border-border bg-background">
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>
    </div>
  );
}

