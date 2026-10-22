"use client";

import {
  FolderGit2Icon,
  RefreshCwIcon,
  TriangleAlertIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DURATION, EASE_IN_OUT } from "@/components/motion/tokens";
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

type ConfigTab = "repositories" | "members" | "teams" | "polling";

const INDICATOR_TRANSITION = { duration: DURATION.base, ease: EASE_IN_OUT };

/** One underline for all tabs, sliding to the active one. */
function TabIndicator({ show }: { show: boolean }) {
  return show ? (
    <motion.span
      layoutId="config-tab-indicator"
      aria-hidden
      className="absolute inset-x-0 -bottom-[5px] h-0.5 bg-foreground"
      transition={INDICATOR_TRANSITION}
    />
  ) : null;
}

const TRIGGER_CLASS = "flex-none after:hidden";

export function ConfigView() {
  const [tab, setTab] = useState<ConfigTab>("repositories");
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

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as ConfigTab)}
        className="gap-6"
      >
        <TabsList variant="line" className="w-full flex-wrap justify-start border-b">
          <TabsTrigger value="repositories" className={TRIGGER_CLASS}>
            <FolderGit2Icon />
            Repositórios
            <Count value={repositories?.filter((r) => r.monitored).length} />
            <TabIndicator show={tab === "repositories"} />
          </TabsTrigger>
          <TabsTrigger value="members" className={TRIGGER_CLASS}>
            <UserIcon />
            Membros
            <Count value={members?.filter((m) => m.monitored).length} />
            <TabIndicator show={tab === "members"} />
          </TabsTrigger>
          <TabsTrigger value="teams" className={TRIGGER_CLASS}>
            <UsersIcon />
            Times
            <Count value={teams?.length} />
            <TabIndicator show={tab === "teams"} />
          </TabsTrigger>
          <TabsTrigger value="polling" className={TRIGGER_CLASS}>
            <RefreshCwIcon />
            Atualização
            <TabIndicator show={tab === "polling"} />
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
