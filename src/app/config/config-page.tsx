"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const bitbucketReposSchema = z.object({
  repos: z.array(z.object({ slug: z.string(), name: z.string() })),
});
const configReposSchema = z.object({
  repos: z.array(z.object({ slug: z.string(), name: z.string() })),
});

const bitbucketMembersSchema = z.object({
  forbidden: z.boolean(),
  members: z.array(
    z.object({
      uuid: z.string(),
      nickname: z.string().nullable().optional(),
      displayName: z.string().nullable().optional(),
      avatarUrl: z.string().nullable().optional(),
    }),
  ),
});

const configMembersSchema = z.object({
  users: z.array(
    z.object({
      uuid: z.string(),
      nickname: z.string().nullable().optional(),
      displayName: z.string().nullable().optional(),
      avatarUrl: z.string().nullable().optional(),
    }),
  ),
});

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

const settingsSchema = z.object({ refreshIntervalSec: z.number() });
const requestStatsSchema = z.object({ requestsLastHour: z.number() });

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error(`Resposta inválida (${url})`);
  return parsed.data;
}

export function ConfigPage() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const bbReposQ = useQuery({
    queryKey: ["bb-repos"],
    queryFn: () => fetchJson("/api/bitbucket/repos", bitbucketReposSchema),
  });
  const cfgReposQ = useQuery({
    queryKey: ["cfg-repos"],
    queryFn: () => fetchJson("/api/config/repos", configReposSchema),
  });

  const bbMembersQ = useQuery({
    queryKey: ["bb-members"],
    queryFn: () => fetchJson("/api/bitbucket/members", bitbucketMembersSchema),
  });
  const cfgMembersQ = useQuery({
    queryKey: ["cfg-members"],
    queryFn: () => fetchJson("/api/config/members", configMembersSchema),
  });

  const squadsQ = useQuery({
    queryKey: ["cfg-squads"],
    queryFn: () => fetchJson("/api/config/squads", squadsSchema),
  });

  const settingsQ = useQuery({
    queryKey: ["cfg-settings"],
    queryFn: () => fetchJson("/api/config/settings", settingsSchema),
  });

  const statsQ = useQuery({
    queryKey: ["request-stats"],
    queryFn: () => fetchJson("/api/config/request-stats", requestStatsSchema),
    refetchInterval: 10_000,
  });

  const monitoredRepoSlugs = new Set((cfgReposQ.data?.repos ?? []).map((r) => r.slug));
  const monitoredUserUuids = new Set((cfgMembersQ.data?.users ?? []).map((u) => u.uuid));

  const [repoSelection, setRepoSelection] = useState<Record<string, boolean>>({});
  const [memberSelection, setMemberSelection] = useState<Record<string, boolean>>({});

  const repos = bbReposQ.data?.repos ?? [];
  const members = bbMembersQ.data?.members ?? [];

  useEffect(() => {
    if (!repos.length) return;
    setRepoSelection((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const r of repos) {
        if (next[r.slug] === undefined) next[r.slug] = monitoredRepoSlugs.has(r.slug);
      }
      return next;
    });
  }, [repos, cfgReposQ.data?.repos]);

  useEffect(() => {
    if (!members.length) return;
    setMemberSelection((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const m of members) {
        if (next[m.uuid] === undefined) next[m.uuid] = monitoredUserUuids.has(m.uuid);
      }
      return next;
    });
  }, [members, cfgMembersQ.data?.users]);

  const [manualUuid, setManualUuid] = useState("");
  const [manualNickname, setManualNickname] = useState("");

  const [newSquadName, setNewSquadName] = useState("");
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);

  const selectedSquad = (squadsQ.data?.squads ?? []).find((s) => s.id === selectedSquadId) ?? null;
  const [editSquadName, setEditSquadName] = useState("");
  const [editSquadMembers, setEditSquadMembers] = useState<string[]>([]);
  const [editSquadRepos, setEditSquadRepos] = useState<string[]>([]);

  const monitoredUsers = cfgMembersQ.data?.users ?? [];
  const monitoredRepos = cfgReposQ.data?.repos ?? [];

  const refreshIntervalSec = settingsQ.data?.refreshIntervalSec ?? 30;

  const saveRepos = async () => {
    const selected = repos.filter((r) => repoSelection[r.slug]);
    setSaving(true);
    try {
      await fetch("/api/config/repos", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repos: selected }),
      });
      await qc.invalidateQueries({ queryKey: ["cfg-repos"] });
      await qc.invalidateQueries({ queryKey: ["config-repos"] });
    } finally {
      setSaving(false);
    }
  };

  const saveMembers = async (users: typeof monitoredUsers) => {
    setSaving(true);
    try {
      await fetch("/api/config/members", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ users }),
      });
      await qc.invalidateQueries({ queryKey: ["cfg-members"] });
    } finally {
      setSaving(false);
    }
  };

  const onSaveSelectedMembers = async () => {
    const selectedFromBb = members
      .filter((m) => memberSelection[m.uuid])
      .map((m) => ({
        uuid: m.uuid,
        nickname: m.nickname ?? null,
        displayName: m.displayName ?? null,
        avatarUrl: m.avatarUrl ?? null,
      }));

    // mantém também os usuários que já estavam monitorados (incl. manuais) e não existem na lista do endpoint
    const keepManual = monitoredUsers.filter((u) => !members.some((m) => m.uuid === u.uuid));
    await saveMembers([...selectedFromBb, ...keepManual]);
  };

  const addManualMember = async () => {
    const schema = z.object({
      uuid: z.string().min(1),
      nickname: z.string().optional(),
    });
    const parsed = schema.safeParse({ uuid: manualUuid.trim(), nickname: manualNickname.trim() || undefined });
    if (!parsed.success) return;

    const next = [
      ...monitoredUsers.filter((u) => u.uuid !== parsed.data.uuid),
      { uuid: parsed.data.uuid, nickname: parsed.data.nickname ?? null, displayName: null, avatarUrl: null },
    ];
    await saveMembers(next);
    setManualUuid("");
    setManualNickname("");
  };

  const saveSettings = async (sec: number) => {
    const schema = z.union([z.literal(30), z.literal(60), z.literal(120)]);
    const parsed = schema.safeParse(sec);
    if (!parsed.success) return;
    setSaving(true);
    try {
      await fetch("/api/config/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshIntervalSec: parsed.data }),
      });
      await qc.invalidateQueries({ queryKey: ["cfg-settings"] });
      await qc.invalidateQueries({ queryKey: ["config-settings"] });
    } finally {
      setSaving(false);
    }
  };

  const createSquad = async () => {
    const name = newSquadName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await fetch("/api/config/squads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, memberUuids: [], repoFilterSlugs: [] }),
      });
      setNewSquadName("");
      await qc.invalidateQueries({ queryKey: ["cfg-squads"] });
    } finally {
      setSaving(false);
    }
  };

  const startEditSquad = (id: number) => {
    setSelectedSquadId(id);
    const s = (squadsQ.data?.squads ?? []).find((x) => x.id === id);
    if (!s) return;
    setEditSquadName(s.name);
    setEditSquadMembers([...s.memberUuids]);
    setEditSquadRepos([...s.repoFilterSlugs]);
  };

  const saveSquadEdits = async () => {
    if (!selectedSquad) return;
    setSaving(true);
    try {
      await fetch(`/api/config/squads/${selectedSquad.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editSquadName.trim() || selectedSquad.name,
          memberUuids: editSquadMembers,
          repoFilterSlugs: editSquadRepos,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["cfg-squads"] });
    } finally {
      setSaving(false);
    }
  };

  const deleteSquad = async () => {
    if (!selectedSquad) return;
    setSaving(true);
    try {
      await fetch(`/api/config/squads/${selectedSquad.id}`, { method: "DELETE" });
      setSelectedSquadId(null);
      await qc.invalidateQueries({ queryKey: ["cfg-squads"] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuração</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Selecione repositórios e usuários monitorados, defina squads e o intervalo de atualização.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Rate limit</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Requests feitas na última hora (contagem local).
            </div>
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {statsQ.data?.requestsLastHour ?? "—"}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Intervalo de atualização</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Usado no polling automático e no TTL do cache do servidor.
            </div>
          </div>
          <select
            value={String(refreshIntervalSec)}
            onChange={(e) => void saveSettings(Number(e.target.value))}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            disabled={saving}
          >
            <option value="30">30s</option>
            <option value="60">60s</option>
            <option value="120">120s</option>
          </select>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Repositórios monitorados</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Fonte: Bitbucket (workspace). Selecione os repositórios que entram na busca de PRs.
            </div>
          </div>
          <button
            className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            onClick={() => void saveRepos()}
            disabled={saving}
          >
            Salvar
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {repos.map((r) => (
            <label key={r.slug} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(repoSelection[r.slug])}
                onChange={(e) =>
                  setRepoSelection((s) => ({ ...s, [r.slug]: e.target.checked }))
                }
              />
              <span className="truncate" title={r.slug}>
                {r.name} <span className="text-xs text-zinc-500">({r.slug})</span>
              </span>
            </label>
          ))}
          {bbReposQ.isLoading ? (
            <div className="text-sm text-zinc-500">Carregando…</div>
          ) : null}
          {bbReposQ.isError ? (
            <div className="text-sm text-red-600">
              Falha ao carregar repositórios.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Usuários monitorados</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Fonte: membros do workspace. Se o endpoint retornar 403, você pode cadastrar manualmente.
            </div>
          </div>
          <button
            className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            onClick={() => void onSaveSelectedMembers()}
            disabled={saving || bbMembersQ.data?.forbidden === true}
            title={bbMembersQ.data?.forbidden ? "Endpoint de membros bloqueado (403)" : undefined}
          >
            Salvar
          </button>
        </div>

        {bbMembersQ.data?.forbidden ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-50">
            O Bitbucket retornou 403 ao listar membros do workspace. Cadastre manualmente por UUID (obrigatório) e nickname (opcional).
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={manualUuid}
                onChange={(e) => setManualUuid(e.target.value)}
                placeholder='UUID (ex: "{...}")'
                className="h-10 flex-1 rounded-md border border-amber-300 bg-white px-3 text-sm dark:border-amber-800/60 dark:bg-zinc-950"
              />
              <input
                value={manualNickname}
                onChange={(e) => setManualNickname(e.target.value)}
                placeholder="Nickname (opcional)"
                className="h-10 flex-1 rounded-md border border-amber-300 bg-white px-3 text-sm dark:border-amber-800/60 dark:bg-zinc-950"
              />
              <button
                onClick={() => void addManualMember()}
                className="h-10 rounded-md bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                disabled={saving}
              >
                Adicionar
              </button>
            </div>
          </div>
        ) : null}

        {!bbMembersQ.data?.forbidden ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {members.map((m) => (
              <label key={m.uuid} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(memberSelection[m.uuid])}
                  onChange={(e) =>
                    setMemberSelection((s) => ({ ...s, [m.uuid]: e.target.checked }))
                  }
                />
                <span className="truncate" title={m.uuid}>
                  {m.displayName ?? m.nickname ?? m.uuid}
                </span>
              </label>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Atualmente monitorados ({monitoredUsers.length})
          </div>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {monitoredUsers.map((u) => (
              <li key={u.uuid} className="truncate text-zinc-700 dark:text-zinc-200" title={u.uuid}>
                {u.displayName ?? u.nickname ?? u.uuid}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-medium">Times / Squads</div>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Um squad tem nome, membros (N:N) e filtro opcional de repositórios. Se o filtro estiver vazio, o squad considera todos os repos monitorados.
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={newSquadName}
            onChange={(e) => setNewSquadName(e.target.value)}
            placeholder="Nome do novo squad"
            className="h-10 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
          <button
            onClick={() => void createSquad()}
            className="h-10 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            disabled={saving}
          >
            Criar
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Squads</div>
            <ul className="mt-2 flex flex-col gap-1">
              {(squadsQ.data?.squads ?? []).map((s) => (
                <li key={s.id}>
                  <button
                    className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      selectedSquadId === s.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                    }`}
                    onClick={() => startEditSquad(s.id)}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
              {squadsQ.isLoading ? (
                <li className="text-sm text-zinc-500">Carregando…</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Editar</div>
            {selectedSquad ? (
              <div className="mt-2 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Nome</span>
                  <input
                    value={editSquadName}
                    onChange={(e) => setEditSquadName(e.target.value)}
                    className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </label>

                <div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Membros
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {monitoredUsers.map((u) => {
                      const checked = editSquadMembers.includes(u.uuid);
                      return (
                        <label key={u.uuid} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setEditSquadMembers((prev) =>
                                e.target.checked
                                  ? [...prev, u.uuid]
                                  : prev.filter((x) => x !== u.uuid),
                              );
                            }}
                          />
                          <span className="truncate" title={u.uuid}>
                            {u.displayName ?? u.nickname ?? u.uuid}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Filtro de repositórios (opcional)
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {monitoredRepos.map((r) => {
                      const checked = editSquadRepos.includes(r.slug);
                      return (
                        <label key={r.slug} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setEditSquadRepos((prev) =>
                                e.target.checked
                                  ? [...prev, r.slug]
                                  : prev.filter((x) => x !== r.slug),
                              );
                            }}
                          />
                          <span className="truncate" title={r.slug}>
                            {r.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => void saveSquadEdits()}
                    className="h-10 flex-1 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    disabled={saving}
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => void deleteSquad()}
                    className="h-10 rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                    disabled={saving}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-zinc-500">
                Selecione um squad para editar.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <div className="font-medium text-zinc-900 dark:text-zinc-50">
          Dica
        </div>
        <div className="mt-1">
          O app busca PRs apenas via rotas do servidor (Route Handlers). O token do Bitbucket nunca vai para o browser.
        </div>
      </section>
    </div>
  );
}

