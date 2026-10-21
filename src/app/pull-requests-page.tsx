"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { usePullRequests } from "@/hooks/usePullRequests";
import {
  ageMs,
  filterPullRequestsBySquad,
  formatAgePtBR,
  sortOldestFirst,
  summarizeReviewState,
  type Squad,
} from "@/lib/domain/pullRequests";

const reposSchema = z.object({
  repos: z.array(z.object({ slug: z.string(), name: z.string() })),
});

const settingsSchema = z.object({ refreshIntervalSec: z.number() });

const squadsSchema = z.object({
  squads: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      memberUuids: z.array(z.string()),
      repoFilterSlugs: z.array(z.string()),
    }),
  ),
});

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error(`Resposta inválida (${url})`);
  return parsed.data;
}

export function PullRequestsPage() {
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
  const [selectedRepoSlug, setSelectedRepoSlug] = useState<string | null>(null);

  const reposQ = useQuery({
    queryKey: ["config-repos"],
    queryFn: () => fetchJson("/api/config/repos", reposSchema),
  });
  const squadsQ = useQuery({
    queryKey: ["config-squads"],
    queryFn: () => fetchJson("/api/config/squads", squadsSchema),
  });
  const settingsQ = useQuery({
    queryKey: ["config-settings"],
    queryFn: () => fetchJson("/api/config/settings", settingsSchema),
  });

  const refreshIntervalSec = settingsQ.data?.refreshIntervalSec ?? 30;

  const { query: prsQ, refreshNow } = usePullRequests({
    filters: { squadId: selectedSquadId, repoSlug: selectedRepoSlug },
    refreshIntervalSec,
  });

  const squads: Squad[] = useMemo(() => {
    return (squadsQ.data?.squads ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      memberUuids: s.memberUuids,
      repoFilterSlugs: s.repoFilterSlugs,
    }));
  }, [squadsQ.data]);

  const selectedSquad = squads.find((s) => s.id === selectedSquadId) ?? null;
  const monitoredRepos = reposQ.data?.repos ?? [];

  const sorted = useMemo(() => {
    const prs = prsQ.data?.pullRequests ?? [];
    // redundância intencional: o servidor já filtra, mas mantemos o domínio puro testável
    const bySquad = filterPullRequestsBySquad(prs, selectedSquad);
    const byRepo = selectedRepoSlug
      ? bySquad.filter((p) => p.repoSlug === selectedRepoSlug)
      : bySquad;
    return sortOldestFirst(byRepo);
  }, [prsQ.data, selectedSquad, selectedRepoSlug]);

  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const effectiveNowMs = nowMs ?? prsQ.data?.generatedAtMs ?? 0;
  const lastUpdatedSec = prsQ.data
    ? Math.max(0, Math.floor((effectiveNowMs - prsQ.data.generatedAtMs) / 1000))
    : null;

  const hasConfig = monitoredRepos.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Pull Requests abertos
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Centralize seus CRs abertos e evite que se percam no chat.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {lastUpdatedSec === null
              ? "Ainda não atualizado"
              : `Última atualização há ${lastUpdatedSec}s`}
          </div>
          <button
            onClick={() => void refreshNow()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            disabled={prsQ.isFetching}
          >
            Atualizar agora
          </button>
        </div>
      </div>

      {!hasConfig && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          Você ainda não selecionou repositórios para monitorar. Vá em{" "}
          <Link href="/config" className="font-medium underline">
            Configuração
          </Link>{" "}
          para começar.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Time/Squad
          </span>
          <select
            value={selectedSquadId ?? ""}
            onChange={(e) =>
              setSelectedSquadId(e.target.value ? Number(e.target.value) : null)
            }
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <option value="">Todos</option>
            {squads.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Repositório
          </span>
          <select
            value={selectedRepoSlug ?? ""}
            onChange={(e) => setSelectedRepoSlug(e.target.value || null)}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <option value="">Todos</option>
            {monitoredRepos.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Intervalo de atualização
          </div>
          <div className="mt-0.5 font-medium">{refreshIntervalSec}s</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Configure em{" "}
            <Link href="/config" className="underline">
              /config
            </Link>
            .
          </div>
        </div>
      </div>

      {prsQ.data?.rateLimit?.retryAfterSeconds ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-50">
          Limite da API atingido, nova tentativa em{" "}
          <span className="font-medium">
            {prsQ.data.rateLimit.retryAfterSeconds}s
          </span>
          .
        </div>
      ) : null}

      {prsQ.data?.errors?.length ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="font-medium">Falhas por repositório</div>
          <ul className="mt-2 list-disc pl-5 text-zinc-600 dark:text-zinc-300">
            {prsQ.data.errors.map((e) => (
              <li key={e.repoSlug}>
                <span className="font-medium">{e.repoSlug}</span>: {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-medium dark:border-zinc-800">
          {sorted.length === 0
            ? "Nenhum PR aberto encontrado"
            : `${sorted.length} PR(s) aberto(s)`}
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {sorted.map((pr) => {
            const ms = ageMs(pr.createdOn, effectiveNowMs);
            const age = formatAgePtBR(ms);
            const { approvals, changesRequested } = summarizeReviewState(
              pr.participants,
            );
            const over24h = ms >= 24 * 60 * 60 * 1000;
            const over72h = ms >= 72 * 60 * 60 * 1000;
            const accent = over72h
              ? "border-l-4 border-red-500"
              : over24h
                ? "border-l-4 border-amber-500"
                : "border-l-4 border-transparent";

            return (
              <li key={`${pr.repoSlug}-${pr.id}`} className={`px-4 py-3 ${accent}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-medium hover:underline"
                      title={pr.title}
                    >
                      {pr.title}
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                        {pr.repoName}
                      </span>
                      <span>{age}</span>
                      <span>
                        {approvals} aprovação(ões)
                        {changesRequested ? " • changes requested" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pr.author.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pr.author.avatarUrl}
                        alt={pr.author.displayName ?? pr.author.nickname ?? "Autor"}
                        className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                    )}
                    <div className="text-right text-xs">
                      <div className="font-medium">
                        {pr.author.displayName ?? pr.author.nickname ?? pr.author.uuid}
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        autor
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

