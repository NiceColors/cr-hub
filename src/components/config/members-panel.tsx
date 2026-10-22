"use client";

import { useMemo, useState } from "react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { RefreshCwIcon, ShieldAlertIcon, UserPlusIcon } from "lucide-react";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/config/section-header";
import { TableSearch, matchesSearch } from "@/components/config/table-search";
import {
  useAddMember,
  useMembers,
  useSyncMembers,
  useUpdateMember,
} from "@/hooks/use-config";
import type { Member } from "@/lib/api/config";
import { DATA_GRID_I18N_PT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

function MonitorCheckbox({ member }: { member: Member }) {
  const update = useUpdateMember();
  return (
    <Checkbox
      checked={member.monitored}
      onCheckedChange={(checked) =>
        update.mutate({ uuid: member.uuid, monitored: Boolean(checked) })
      }
      aria-label={`Monitorar ${member.displayName}`}
    />
  );
}

const columns: ColumnDef<DataGridFeatures, Member>[] = [
  {
    id: "monitored",
    accessorFn: (m) => (m.monitored ? 1 : 0),
    header: ({ column }) => <DataGridColumnHeader column={column} title="Monitorar" />,
    sortFn: "basic",
    size: 120,
    cell: ({ row }) => <MonitorCheckbox member={row.original} />,
  },
  {
    id: "displayName",
    accessorFn: (m) => m.displayName,
    header: ({ column }) => <DataGridColumnHeader column={column} title="Membro" />,
    size: 440,
    cell: ({ row }) => {
      const m = row.original;
      return (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-6">
            {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt={m.displayName} /> : null}
            <AvatarFallback className="text-[10px]">
              {m.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={cn("truncate font-medium", !m.monitored && "text-muted-foreground")}>
              {m.displayName}
              {m.nickname ? (
                <span className="ml-2 font-normal text-muted-foreground">@{m.nickname}</span>
              ) : null}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">{m.uuid}</span>
          </div>
        </div>
      );
    },
  },
  {
    id: "source",
    accessorFn: (m) => m.source,
    header: ({ column }) => <DataGridColumnHeader column={column} title="Origem" />,
    size: 140,
    cell: ({ row }) =>
      row.original.source === "manual" ? (
        <Badge variant="outline">Manual</Badge>
      ) : (
        <Badge variant="secondary">Workspace</Badge>
      ),
  },
];

function AddMemberForm() {
  const add = useAddMember();
  const [uuid, setUuid] = useState("");
  const [nickname, setNickname] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = uuid.trim();
    if (!trimmed) return;
    add.mutate(
      { uuid: trimmed, nickname: nickname.trim() || null },
      {
        onSuccess: () => {
          setUuid("");
          setNickname("");
        },
      },
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="member-uuid">UUID</Label>
        <Input
          id="member-uuid"
          value={uuid}
          onChange={(e) => setUuid(e.target.value)}
          placeholder="{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}"
          className="font-mono"
          required
        />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="member-nickname">Nickname (opcional)</Label>
        <Input
          id="member-nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={add.isPending || !uuid.trim()}>
        <UserPlusIcon data-icon="inline-start" />
        Adicionar
      </Button>
    </form>
  );
}

export function MembersPanel() {
  const { data, isLoading } = useMembers();
  const sync = useSyncMembers();
  const [search, setSearch] = useState("");

  const members = data?.members;
  const visible = useMemo(
    () =>
      (members ?? []).filter((m) => matchesSearch(search, m.displayName, m.nickname, m.uuid)),
    [members, search],
  );
  const monitoredCount = members?.filter((m) => m.monitored).length ?? 0;
  const forbidden = sync.data?.forbidden === true;

  const table = useTable({
    features: dataGridFeatures,
    data: visible,
    columns,
    getRowId: (m) => m.uuid,
    initialState: {
      sorting: [{ id: "displayName", desc: false }],
      pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Membros do workspace"
        description={
          <>
            <span className="font-mono tabular-nums">{monitoredCount}</span> monitorado(s) de{" "}
            <span className="font-mono tabular-nums">{members?.length ?? 0}</span>. Só PRs de
            membros monitorados entram na fila.
          </>
        }
        actions={
          <>
            <TableSearch value={search} onChange={setSearch} placeholder="Filtrar membros…" />
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

      {forbidden ? (
        <Alert variant="warning">
          <ShieldAlertIcon />
          <AlertTitle>Permissão insuficiente (403)</AlertTitle>
          <AlertDescription>
            O token não pode listar membros do workspace. Cadastre-os manualmente pelo UUID
            abaixo.
          </AlertDescription>
        </Alert>
      ) : null}

      <DataGrid
        table={table}
        recordCount={visible.length}
        isLoading={isLoading}
        i18n={DATA_GRID_I18N_PT}
        emptyMessage={
          search
            ? "Nenhum membro corresponde à busca."
            : "Nenhum membro. Sincronize ou adicione manualmente."
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

      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Adicionar manualmente"
          description="Use quando o token não tiver permissão para listar o workspace."
        />
        <AddMemberForm />
      </div>
    </div>
  );
}
