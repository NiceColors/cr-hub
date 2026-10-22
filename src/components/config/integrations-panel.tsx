"use client";

import { useState } from "react";
import { SaveIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CredentialsPanel } from "@/components/config/credentials-panel";
import { SectionHeader } from "@/components/config/section-header";
import { useSetJira, useSettings } from "@/hooks/use-config";
import type { JiraSettings } from "@/lib/api/config";

function JiraForm({ initial }: { initial: JiraSettings }) {
  const save = useSetJira();
  const [baseUrl, setBaseUrl] = useState(initial.jiraBaseUrl ?? "");
  const [projectKeys, setProjectKeys] = useState(initial.jiraProjectKeys ?? "");
  const dirty =
    baseUrl.trim() !== (initial.jiraBaseUrl ?? "") ||
    projectKeys.trim() !== (initial.jiraProjectKeys ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate({
      jiraBaseUrl: baseUrl.trim() || null,
      jiraProjectKeys: projectKeys.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="URL do Jira"
          type="url"
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder="https://empresa.atlassian.net"
          classNames={{ input: "text-sm" }}
        />
        <Input
          label="Projetos (opcional)"
          value={projectKeys}
          onChange={setProjectKeys}
          placeholder="FUND, OPS"
          classNames={{ input: "font-mono text-sm uppercase" }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        A chave (ex.: <span className="font-mono">FUND-123</span>) é procurada primeiro no título e
        depois na branch de origem. Listar os projetos evita falsos positivos como{" "}
        <span className="font-mono">UTF-8</span>. Sem URL, a chave aparece sem link.
      </p>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
          <SaveIcon className="size-3.5" />
          Salvar
        </Button>
      </div>
    </form>
  );
}

export function IntegrationsPanel() {
  const settings = useSettings();
  return (
    <div className="flex flex-col gap-8">
      <CredentialsPanel />
      <div className="flex flex-col gap-4">
        <SectionHeader
          title="Jira"
          description="Liga cada PR à issue correspondente, sem precisar abrir o Bitbucket."
        />
        {settings.data ? (
          <JiraForm
            key={`${settings.data.jiraBaseUrl}|${settings.data.jiraProjectKeys}`}
            initial={settings.data}
          />
        ) : (
          <Skeleton className="h-40 w-full rounded-2xl" />
        )}
      </div>
    </div>
  );
}
