"use client";

import {
  FolderGit2Icon,
  RefreshCwIcon,
  TriangleAlertIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { MembersPanel } from "@/components/config/members-panel";
import { PollingPanel } from "@/components/config/polling-panel";
import { RepositoriesPanel } from "@/components/config/repositories-panel";
import { TeamsPanel } from "@/components/config/teams-panel";
import { useMembers, useRepositories, useStatus, useTeams } from "@/hooks/use-config";

function Count({ value }: { value: number | undefined }) {
  return (
    <span className="rounded-sm bg-muted px-1.5 font-mono text-xs text-muted-foreground tabular-nums">
      {value ?? "—"}
    </span>
  );
}

export function ConfigView() {
  const status = useStatus();
  const repositories = useRepositories().data?.repositories;
  const members = useMembers().data?.members;
  const teams = useTeams().data?.teams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuração"
        description="Escolha o que monitorar: repositórios, membros, times e frequência de atualização."
      />

      {status.data?.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>
            Erro do Bitbucket <span className="font-mono">{status.data.error.code}</span>
          </AlertTitle>
          <AlertDescription>{status.data.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="repositories" className="gap-6">
        <TabsList variant="line" className="w-full flex-wrap justify-start border-b">
          <TabsTrigger value="repositories" className="flex-none">
            <FolderGit2Icon />
            Repositórios
            <Count value={repositories?.filter((r) => r.monitored).length} />
          </TabsTrigger>
          <TabsTrigger value="members" className="flex-none">
            <UserIcon />
            Membros
            <Count value={members?.filter((m) => m.monitored).length} />
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex-none">
            <UsersIcon />
            Times
            <Count value={teams?.length} />
          </TabsTrigger>
          <TabsTrigger value="polling" className="flex-none">
            <RefreshCwIcon />
            Atualização
          </TabsTrigger>
        </TabsList>

        <TabsContent value="repositories">
          <RepositoriesPanel />
        </TabsContent>
        <TabsContent value="members">
          <MembersPanel />
        </TabsContent>
        <TabsContent value="teams">
          <TeamsPanel />
        </TabsContent>
        <TabsContent value="polling">
          <PollingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
