"use client";

import {
  BellIcon,
  BookmarkIcon,
  FolderGit2Icon,
  PlugIcon,
  RefreshCwIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/motion/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { PageHeader } from "@/components/page-header";
import { IntegrationsPanel } from "@/components/config/integrations-panel";
import { MembersPanel } from "@/components/config/members-panel";
import { NotificationsPanel } from "@/components/config/notifications-panel";
import { PollingPanel } from "@/components/config/polling-panel";
import { RepositoriesPanel } from "@/components/config/repositories-panel";
import { TeamsPanel } from "@/components/config/teams-panel";
import { ViewsPanel } from "@/components/config/views-panel";
import {
  useMembers,
  useRepositories,
  useSavedViews,
  useStatus,
  useTeams,
} from "@/hooks/use-config";

function Count({ value }: { value: number | undefined }) {
  return (
    <span className="ml-1.5 rounded-full bg-muted px-1.5 font-mono text-xs text-muted-foreground tabular-nums">
      {value ?? "—"}
    </span>
  );
}

export function ConfigView() {
  const status = useStatus();
  const repositories = useRepositories().data?.repositories;
  const members = useMembers().data?.members;
  const teams = useTeams().data?.teams;
  const views = useSavedViews().data?.views;
  const error = status.data?.error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuração"
        description="Escolha o que monitorar, como ser avisado e com o que integrar."
      />

      <Alert variant="destructive" open={Boolean(error)}>
        <AlertIcon />
        <AlertContent>
          <AlertTitle>
            Erro do Bitbucket <span className="font-mono">{error?.code}</span>
          </AlertTitle>
          <AlertDescription>{error?.message}</AlertDescription>
        </AlertContent>
      </Alert>

      <Tabs defaultValue="repositories" variant="underline">
        <TabsList>
          <TabsTrigger value="repositories" icon={<FolderGit2Icon className="size-4" />}>
            Repositórios
            <Count value={repositories?.filter((r) => r.monitored).length} />
          </TabsTrigger>
          <TabsTrigger value="members" icon={<UserIcon className="size-4" />}>
            Membros
            <Count value={members?.filter((m) => m.monitored).length} />
          </TabsTrigger>
          <TabsTrigger value="teams" icon={<UsersIcon className="size-4" />}>
            Times
            <Count value={teams?.length} />
          </TabsTrigger>
          <TabsTrigger value="views" icon={<BookmarkIcon className="size-4" />}>
            Visões
            <Count value={views?.length} />
          </TabsTrigger>
          <TabsTrigger value="notifications" icon={<BellIcon className="size-4" />}>
            Notificações
          </TabsTrigger>
          <TabsTrigger value="integrations" icon={<PlugIcon className="size-4" />}>
            Integrações
          </TabsTrigger>
          <TabsTrigger value="polling" icon={<RefreshCwIcon className="size-4" />}>
            Atualização
          </TabsTrigger>
        </TabsList>

        <TabsContent value="repositories" className="mt-6">
          <RepositoriesPanel />
        </TabsContent>
        <TabsContent value="members" className="mt-6">
          <MembersPanel />
        </TabsContent>
        <TabsContent value="teams" className="mt-6">
          <TeamsPanel />
        </TabsContent>
        <TabsContent value="views" className="mt-6">
          <ViewsPanel />
        </TabsContent>
        <TabsContent value="notifications" className="mt-6">
          <NotificationsPanel />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsPanel />
        </TabsContent>
        <TabsContent value="polling" className="mt-6">
          <PollingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
