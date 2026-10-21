"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Frame,
  FramePanel,
  FrameHeader,
  FrameTitle,
  FrameDescription,
} from "@/components/reui/frame";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { useTable, type ColumnDef } from "@tanstack/react-table";

const reposSchema = z.object({
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

const membersSchema = z.object({
  members: z.array(
    z.object({
      uuid: z.string(),
      nickname: z.string().nullable(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      monitored: z.boolean(),
      source: z.string(),
    }),
  ),
});

const teamsSchema = z.object({
  teams: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      createdAt: z.number(),
      memberUuids: z.array(z.string()),
      repositoryUuids: z.array(z.string()),
    }),
  ),
});

const settingsSchema = z.object({ pollIntervalSeconds: z.number() });
const statusSchema = z.object({
  tokenValid: z.boolean(),
  requestsLastHour: z.number(),
  retryAfterSeconds: z.number().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

const syncReposRespSchema = z.object({
  total: z.number(),
  added: z.number(),
  updated: z.number(),
});

const syncMembersRespSchema = z.union([
  z.object({ forbidden: z.literal(true) }),
  z.object({
    forbidden: z.literal(false),
    total: z.number(),
    added: z.number(),
    updated: z.number(),
  }),
]);

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error(`Resposta inválida (${url})`);
  return parsed.data;
}

export function ConfigPage() {
  const qc = useQueryClient();
  const [membersForbidden, setMembersForbidden] = useState(false);

  const reposQ = useQuery({
    queryKey: ["cfg-repositories"],
    queryFn: () => fetchJson("/api/config/repositories", reposSchema),
  });
  const membersQ = useQuery({
    queryKey: ["cfg-members"],
    queryFn: () => fetchJson("/api/config/members", membersSchema),
  });
  const teamsQ = useQuery({
    queryKey: ["cfg-teams"],
    queryFn: () => fetchJson("/api/config/teams", teamsSchema),
  });
  const settingsQ = useQuery({
    queryKey: ["cfg-settings"],
    queryFn: () => fetchJson("/api/config/settings", settingsSchema),
  });
  const statusQ = useQuery({
    queryKey: ["status"],
    queryFn: () => fetchJson("/api/status", statusSchema),
    refetchInterval: 10_000,
  });

  const repos = reposQ.data?.repositories ?? [];
  const members = membersQ.data?.members ?? [];
  const teams = teamsQ.data?.teams ?? [];
  const poll = settingsQ.data?.pollIntervalSeconds ?? 30;

  const monitoredReposCount = repos.filter((r) => r.monitored).length;
  const monitoredMembersCount = members.filter((m) => m.monitored).length;

  const syncRepos = async () => {
    const res = await fetch("/api/bitbucket/repositories/sync", { method: "POST" });
    const json = await res.json();
    const parsed = syncReposRespSchema.safeParse(json);
    if (!parsed.success) throw new Error("Falha ao sincronizar repositórios.");
    toast.success(`Repositórios sincronizados: ${parsed.data.total}`);
    await qc.invalidateQueries({ queryKey: ["cfg-repositories"] });
  };

  const syncMembers = async () => {
    const res = await fetch("/api/bitbucket/members/sync", { method: "POST" });
    const json = await res.json();
    const parsed = syncMembersRespSchema.safeParse(json);
    if (!parsed.success) throw new Error("Falha ao sincronizar membros.");
    if (parsed.data.forbidden) {
      setMembersForbidden(true);
      toast.warning("Token não pode listar membros do workspace (403).");
      return;
    }
    setMembersForbidden(false);
    toast.success(`Membros sincronizados: ${parsed.data.total}`);
    await qc.invalidateQueries({ queryKey: ["cfg-members"] });
  };

  const setPoll = async (sec: number) => {
    const parsed = z.union([z.literal(30), z.literal(60), z.literal(120)]).safeParse(sec);
    if (!parsed.success) return;
    await fetch("/api/config/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pollIntervalSeconds: parsed.data }),
    });
    toast.success("Intervalo de atualização salvo.");
    await qc.invalidateQueries({ queryKey: ["cfg-settings"] });
  };

  type RepoRow = (typeof repos)[number];
  const repoColumns = useMemo<ColumnDef<typeof dataGridFeatures, RepoRow>[]>(
    () => [
      {
        id: "monitored",
        header: "Monitorar",
        accessorFn: (r: RepoRow) => r.monitored,
        cell: (ctx: any) => {
          const r: RepoRow = ctx.row.original;
          return (
            <Checkbox
              checked={r.monitored}
              onCheckedChange={async (checked) => {
                await fetch(`/api/config/repositories/${r.uuid}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ monitored: Boolean(checked) }),
                });
                await qc.invalidateQueries({ queryKey: ["cfg-repositories"] });
              }}
            />
          );
        },
      },
      {
        id: "name",
        header: "Repositório",
        accessorFn: (r: RepoRow) => r.name,
        cell: (ctx: any) => {
          const r: RepoRow = ctx.row.original;
          return (
            <div className="min-w-0">
              <div className="truncate font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.slug}</div>
            </div>
          );
        },
      },
      {
        id: "minApprovals",
        header: "Min. aprovações",
        accessorFn: (r: RepoRow) => r.minApprovals,
        cell: (ctx: any) => {
          const r: RepoRow = ctx.row.original;
          return (
            <Input
              type="number"
              min={0}
              max={20}
              className="h-8 w-20"
              value={r.minApprovals}
              onChange={async (e) => {
                const value = Number(e.target.value);
                if (!Number.isFinite(value)) return;
                await fetch(`/api/config/repositories/${r.uuid}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ minApprovals: value }),
                });
                await qc.invalidateQueries({ queryKey: ["cfg-repositories"] });
              }}
            />
          );
        },
      },
    ],
    [qc],
  );

  const repoTable = useTable({
    features: dataGridFeatures,
    data: repos,
    columns: repoColumns,
  });

  type MemberRow = (typeof members)[number];
  const memberColumns = useMemo<ColumnDef<typeof dataGridFeatures, MemberRow>[]>(
    () => [
      {
        id: "monitored",
        header: "Monitorar",
        accessorFn: (m: MemberRow) => m.monitored,
        cell: (ctx: any) => {
          const m: MemberRow = ctx.row.original;
          return (
            <Checkbox
              checked={m.monitored}
              onCheckedChange={async (checked) => {
                await fetch(`/api/config/members/${m.uuid}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ monitored: Boolean(checked) }),
                });
                await qc.invalidateQueries({ queryKey: ["cfg-members"] });
              }}
            />
          );
        },
      },
      {
        id: "displayName",
        header: "Membro",
        accessorFn: (m: MemberRow) => m.displayName,
        cell: (ctx: any) => {
          const m: MemberRow = ctx.row.original;
          return (
            <div className="min-w-0">
              <div className="truncate font-medium">{m.displayName}</div>
              <div className="text-xs text-muted-foreground">{m.uuid}</div>
            </div>
          );
        },
      },
      {
        id: "source",
        header: "Origem",
        accessorFn: (m: MemberRow) => m.source,
        cell: (ctx: any) => {
          const m: MemberRow = ctx.row.original;
          return (
            <Badge variant={(m.source === "manual" ? "warning-light" : "secondary") as any} radius="full">
              {m.source}
            </Badge>
          );
        },
      },
    ],
    [qc],
  );

  const memberTable = useTable({
    features: dataGridFeatures,
    data: members,
    columns: memberColumns,
  });

  const [manualUuid, setManualUuid] = useState("");
  const [manualNickname, setManualNickname] = useState("");
  const addManual = async () => {
    const uuid = manualUuid.trim();
    if (!uuid) return;
    await fetch("/api/config/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uuid, nickname: manualNickname.trim() || null }),
    });
    toast.success("Membro adicionado.");
    setManualUuid("");
    setManualNickname("");
    await qc.invalidateQueries({ queryKey: ["cfg-members"] });
  };

  // Teams (CRUD)
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const editingTeam = teams.find((t) => t.id === editingTeamId) ?? null;
  const [teamName, setTeamName] = useState("");
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [teamRepos, setTeamRepos] = useState<string[]>([]);

  const openCreateTeam = () => {
    setEditingTeamId(null);
    setTeamName("");
    setTeamMembers([]);
    setTeamRepos([]);
    setTeamDialogOpen(true);
  };
  const openEditTeam = (id: number) => {
    const t = teams.find((x) => x.id === id);
    if (!t) return;
    setEditingTeamId(id);
    setTeamName(t.name);
    setTeamMembers([...t.memberUuids]);
    setTeamRepos([...t.repositoryUuids]);
    setTeamDialogOpen(true);
  };

  const saveTeam = async () => {
    const payload = {
      name: teamName.trim() || "Sem nome",
      memberUuids: teamMembers,
      repositoryUuids: teamRepos,
    };
    if (editingTeamId) {
      await fetch(`/api/config/teams/${editingTeamId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Time salvo.");
    } else {
      await fetch("/api/config/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Time criado.");
    }
    setTeamDialogOpen(false);
    await qc.invalidateQueries({ queryKey: ["cfg-teams"] });
  };

  const deleteTeam = async () => {
    if (!editingTeamId) return;
    await fetch(`/api/config/teams/${editingTeamId}`, { method: "DELETE" });
    toast.success("Time excluído.");
    setTeamDialogOpen(false);
    await qc.invalidateQueries({ queryKey: ["cfg-teams"] });
  };

  const monitoredRepos = useMemo(
    () => repos.filter((r) => r.monitored),
    [repos],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuração</h1>
        <p className="text-sm text-muted-foreground">
          Repositórios, membros, times e intervalo de atualização.
        </p>
      </div>

      <Frame spacing="sm">
        <FramePanel>
          <FrameHeader>
            <FrameTitle>Status</FrameTitle>
            <FrameDescription>
              Token válido:{" "}
              <span className={statusQ.data?.tokenValid ? "text-success" : "text-destructive"}>
                {statusQ.data?.tokenValid ? "sim" : "não"}
              </span>
              {" · "}
              Requests/h: {statusQ.data?.requestsLastHour ?? "—"}
              {statusQ.data?.retryAfterSeconds ? (
                <>
                  {" · "}Rate limit: {statusQ.data.retryAfterSeconds}s
                </>
              ) : null}
            </FrameDescription>
          </FrameHeader>
        </FramePanel>
        {statusQ.data?.error ? (
          <FramePanel>
            <Alert variant="destructive">
              <AlertTitle>{statusQ.data.error.code}</AlertTitle>
              <AlertDescription>{statusQ.data.error.message}</AlertDescription>
            </Alert>
          </FramePanel>
        ) : null}
      </Frame>

      <Tabs defaultValue="repos" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="repos">Repositórios</TabsTrigger>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="teams">Times</TabsTrigger>
          <TabsTrigger value="update">Atualização</TabsTrigger>
        </TabsList>

        <TabsContent value="repos" className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Repositórios do workspace</div>
              <div className="text-xs text-muted-foreground">
                {monitoredReposCount} monitorado(s) de {repos.length}
              </div>
            </div>
            <Button onClick={() => void syncRepos()} variant="secondary">
              Sincronizar lista
            </Button>
          </div>

          <div className="mt-3">
            <DataGrid table={repoTable as any} recordCount={repos.length} tableLayout={{ dense: true, rowBorder: true, width: "fixed" }}>
              <DataGridContainer className="rounded-lg border border-border bg-background">
                <DataGridTable />
              </DataGridContainer>
            </DataGrid>
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Membros do workspace</div>
              <div className="text-xs text-muted-foreground">
                {monitoredMembersCount} monitorado(s) de {members.length}
              </div>
            </div>
            <Button onClick={() => void syncMembers()} variant="secondary">
              Sincronizar lista
            </Button>
          </div>

          {membersForbidden ? (
            <div className="mt-3">
              <Alert variant="warning">
                <AlertTitle>Permissão insuficiente (403)</AlertTitle>
                <AlertDescription>
                  Seu token não pode listar membros do workspace. Cadastre manualmente por UUID ou nickname.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <div className="mt-3">
            <DataGrid table={memberTable as any} recordCount={members.length} tableLayout={{ dense: true, rowBorder: true, width: "fixed" }}>
              <DataGridContainer className="rounded-lg border border-border bg-background">
                <DataGridTable />
              </DataGridContainer>
            </DataGrid>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label>UUID</Label>
              <Input value={manualUuid} onChange={(e) => setManualUuid(e.target.value)} placeholder='"{...}"' />
            </div>
            <div className="flex-1">
              <Label>Nickname (opcional)</Label>
              <Input value={manualNickname} onChange={(e) => setManualNickname(e.target.value)} />
            </div>
            <Button onClick={() => void addManual()}>Adicionar</Button>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Times</div>
              <div className="text-xs text-muted-foreground">
                Times definem escopo por membros e, opcionalmente, por repositórios (vazio = todos os repos monitorados).
              </div>
            </div>
            <Button onClick={openCreateTeam}>Novo time</Button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => openEditTeam(t.id)}
                className="rounded-lg border border-border bg-background p-3 text-left hover:bg-muted/40"
              >
                <div className="text-sm font-medium">{t.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t.memberUuids.length} membro(s) ·{" "}
                  {t.repositoryUuids.length ? `${t.repositoryUuids.length} repo(s) filtrado(s)` : "todos os repos monitorados"}
                </div>
              </button>
            ))}
            {teams.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum time cadastrado.</div>
            ) : null}
          </div>

          <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTeam ? "Editar time" : "Novo time"}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </div>

                <div className="grid gap-2">
                  <div className="text-sm font-medium">Membros</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {members.filter((m) => m.monitored).map((m) => {
                      const checked = teamMembers.includes(m.uuid);
                      return (
                        <label key={m.uuid} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setTeamMembers((prev) =>
                                v ? [...prev, m.uuid] : prev.filter((x) => x !== m.uuid),
                              )
                            }
                          />
                          <span className="truncate">{m.displayName}</span>
                        </label>
                      );
                    })}
                  </div>
                  {members.filter((m) => m.monitored).length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Nenhum membro monitorado ainda (aba Membros).
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <div className="text-sm font-medium">Filtro de repositórios (opcional)</div>
                  <div className="text-xs text-muted-foreground">
                    Se vazio, o time considera todos os repositórios monitorados.
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {monitoredRepos.map((r) => {
                      const checked = teamRepos.includes(r.uuid);
                      return (
                        <label key={r.uuid} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setTeamRepos((prev) =>
                                v ? [...prev, r.uuid] : prev.filter((x) => x !== r.uuid),
                              )
                            }
                          />
                          <span className="truncate">{r.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  {editingTeam ? (
                    <Button variant="destructive" onClick={() => void deleteTeam()}>
                      Excluir
                    </Button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setTeamDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => void saveTeam()}>Salvar</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="update" className="mt-4">
          <Frame spacing="sm">
            <FramePanel>
              <FrameHeader>
                <FrameTitle>Intervalo de atualização</FrameTitle>
                <FrameDescription>
                  Usado no polling automático e no TTL do cache do servidor.
                </FrameDescription>
              </FrameHeader>
              <div className="flex items-center justify-between gap-3 px-4 pb-4">
                <div className="text-sm text-muted-foreground">
                  Atual: <span className="font-medium">{poll}s</span>
                </div>
                <select
                  value={String(poll)}
                  onChange={(e) => void setPoll(Number(e.target.value))}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="30">30s</option>
                  <option value="60">60s</option>
                  <option value="120">120s</option>
                </select>
              </div>
            </FramePanel>
            <FramePanel>
              <FrameHeader>
                <FrameTitle>Contadores</FrameTitle>
                <FrameDescription>
                  Requests feitas na última hora (janela deslizante em memória).
                </FrameDescription>
              </FrameHeader>
              <div className="px-4 pb-4 text-sm">
                Requests/h:{" "}
                <span className="font-medium tabular-nums">
                  {statusQ.data?.requestsLastHour ?? "—"}
                </span>
              </div>
            </FramePanel>
          </Frame>
        </TabsContent>
      </Tabs>
    </div>
  );
}

