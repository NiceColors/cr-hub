"use client";

import { useMemo, useState } from "react";
import { RefreshCwIcon, UserPlusIcon } from "lucide-react";
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/motion/alert";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Button } from "@/components/motion/button/base";
import { Checkbox } from "@/components/motion/checkbox";
import { Input } from "@/components/motion/input";
import { Table, type TableColumn } from "@/components/motion/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/config/section-header";
import { TableSearch, matchesSearch } from "@/components/config/table-search";
import {
  useAddMember,
  useMembers,
  useSyncMembers,
  useUpdateMember,
} from "@/hooks/use-config";
import type { Member } from "@/lib/api/config";
import { fitTableHeight } from "@/lib/table-height";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 56;

function memberRowId(member: Member) {
  return member.uuid;
}

function MonitorCheckbox({ member }: { member: Member }) {
  const update = useUpdateMember();
  return (
    <Checkbox
      checked={member.monitored}
      onCheckedChange={(checked) => update.mutate({ uuid: member.uuid, monitored: checked })}
      aria-label={`Monitorar ${member.displayName}`}
    />
  );
}

const columns: TableColumn<Member>[] = [
  {
    key: "monitored",
    header: "Monitorar",
    sortable: true,
    sortValue: (m) => (m.monitored ? 1 : 0),
    width: "130px",
    cell: (m) => <MonitorCheckbox member={m} />,
  },
  {
    key: "displayName",
    header: "Membro",
    sortable: true,
    sortValue: (m) => m.displayName,
    cell: (m) => (
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
    ),
  },
  {
    key: "source",
    header: "Origem",
    sortable: true,
    sortValue: (m) => m.source,
    width: "150px",
    cell: (m) =>
      m.source === "manual" ? (
        <AnimatedBadge size="sm" showIcon={false}>
          Manual
        </AnimatedBadge>
      ) : (
        <AnimatedBadge status="info" size="sm" showIcon={false}>
          Workspace
        </AnimatedBadge>
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
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end"
    >
      <Input
        label="UUID"
        value={uuid}
        onChange={setUuid}
        placeholder="{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}"
        required
        className="flex-1"
        classNames={{ input: "font-mono text-sm" }}
      />
      <Input
        label="Nickname (opcional)"
        value={nickname}
        onChange={setNickname}
        className="flex-1"
        classNames={{ input: "text-sm" }}
      />
      <Button type="submit" disabled={add.isPending || !uuid.trim()} className="h-11">
        <UserPlusIcon />
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
              <RefreshCwIcon className={cn("size-3.5", sync.isPending && "animate-spin")} />
              Sincronizar
            </Button>
          </>
        }
      />

      <Alert variant="warning" open={forbidden}>
        <AlertIcon />
        <AlertContent>
          <AlertTitle>Permissão insuficiente (403)</AlertTitle>
          <AlertDescription>
            O token não pode listar membros do workspace. Cadastre-os manualmente pelo UUID
            abaixo.
          </AlertDescription>
        </AlertContent>
      </Alert>

      <Table
        data={visible}
        columns={columns}
        getRowId={memberRowId}
        defaultSort={{ key: "displayName", direction: "asc" }}
        rowHeight={ROW_HEIGHT}
        height={fitTableHeight(visible.length, ROW_HEIGHT)}
        loading={isLoading}
        emptyState={
          search
            ? "Nenhum membro corresponde à busca."
            : "Nenhum membro. Sincronize ou adicione manualmente."
        }
        className="rounded-2xl"
      />

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
