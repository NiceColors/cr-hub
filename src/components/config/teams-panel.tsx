"use client";

import { useState } from "react";
import { ChevronRightIcon, PlusIcon, UsersIcon } from "lucide-react";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Button } from "@/components/motion/button/base";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/config/section-header";
import { TeamDialog } from "@/components/config/team-dialog";
import { useMembers, useRepositories, useTeams } from "@/hooks/use-config";
import type { Team } from "@/lib/api/config";

export function TeamsPanel() {
  const teamsQuery = useTeams();
  const members = useMembers().data?.members ?? [];
  const repositories = useRepositories().data?.repositories ?? [];
  const [dialog, setDialog] = useState<{ open: boolean; team: Team | null }>({
    open: false,
    team: null,
  });

  const teams = teamsQuery.data?.teams ?? [];
  const memberNames = new Map(members.map((m) => [m.uuid, m.displayName]));

  const openCreate = () => setDialog({ open: true, team: null });
  const openEdit = (team: Team) => setDialog({ open: true, team });

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Times"
        description="Times recortam a fila por membros e, opcionalmente, por repositórios."
        actions={
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-3.5" />
            Novo time
          </Button>
        }
      />

      {teamsQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : teams.length === 0 ? (
        <Empty className="border py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum time</EmptyTitle>
            <EmptyDescription>
              Crie um time para filtrar a fila pelos PRs de um grupo específico.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <PlusIcon className="size-3.5" />
              Criar primeiro time
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {teams.map((team) => {
            const names = team.memberUuids
              .map((uuid) => memberNames.get(uuid))
              .filter(Boolean)
              .join(", ");
            return (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => openEdit(team)}
                  className="group flex w-full items-center gap-4 px-4 py-3 text-left outline-none transition-colors duration-fast ease-out hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium">{team.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {names || "Sem membros"}
                    </span>
                  </div>
                  <AnimatedBadge status="info" size="sm" showIcon={false}>
                    {`${team.memberUuids.length} membro(s)`}
                  </AnimatedBadge>
                  <AnimatedBadge size="sm" showIcon={false}>
                    {team.repositoryUuids.length
                      ? `${team.repositoryUuids.length} repo(s)`
                      : "Todos os repos"}
                  </AnimatedBadge>
                  <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <TeamDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        team={dialog.team}
        members={members}
        repositories={repositories}
      />
    </div>
  );
}
