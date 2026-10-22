"use client";

import { useState } from "react";
import { SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/config/section-header";
import { useClearCredentials, useCredentials, useSaveCredentials } from "@/hooks/use-config";
import type { Credentials } from "@/lib/api/config";

const SOURCE_LABEL: Record<Credentials["source"], string> = {
  database: "Salvas pelo app",
  env: "Lidas do .env",
  none: "Não configuradas",
};

function CredentialsForm({ initial }: { initial: Credentials }) {
  const save = useSaveCredentials();
  const clear = useClearCredentials();
  const [workspace, setWorkspace] = useState(initial.workspace ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [apiToken, setApiToken] = useState("");
  const pending = save.isPending || clear.isPending;
  const dirty =
    workspace.trim() !== (initial.workspace ?? "") ||
    email.trim() !== (initial.email ?? "") ||
    apiToken.trim() !== "";
  const hasToken = apiToken.trim() !== "" || initial.tokenHint !== null;
  const canSubmit = dirty && workspace.trim() !== "" && email.trim() !== "" && hasToken;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate({
      workspace: workspace.trim(),
      email: email.trim(),
      apiToken: apiToken.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Workspace"
          value={workspace}
          onChange={setWorkspace}
          placeholder="minha-empresa"
          autoComplete="off"
          spellCheck={false}
          classNames={{ input: "font-mono text-sm" }}
        />
        <Input
          label="E-mail da conta"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="voce@empresa.com"
          autoComplete="off"
          classNames={{ input: "text-sm" }}
        />
      </div>
      <Input
        label="API token"
        type="password"
        value={apiToken}
        onChange={setApiToken}
        placeholder={
          initial.tokenHint
            ? `Em uso: ${initial.tokenHint}. Deixe vazio para manter.`
            : "Cole o token do Bitbucket"
        }
        autoComplete="new-password"
        spellCheck={false}
        classNames={{ input: "font-mono text-sm" }}
      />
      <p className="text-xs text-muted-foreground">
        Ao salvar, o app testa as credenciais no Bitbucket antes de trocar as atuais. Elas ficam
        no banco local (<span className="font-mono">.data/</span>) e têm prioridade sobre o{" "}
        <span className="font-mono">.env</span>. O token nunca é enviado de volta ao navegador.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{SOURCE_LABEL[initial.source]}</span>
        <div className="flex items-center gap-2">
          {initial.source === "database" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => clear.mutate()}
            >
              <Trash2Icon className="size-3.5" />
              Voltar ao .env
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={!canSubmit || pending}>
            <SaveIcon className="size-3.5" />
            {save.isPending ? "Validando…" : "Validar e salvar"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function CredentialsPanel() {
  const credentials = useCredentials();
  const data = credentials.data;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Bitbucket"
        description="Workspace, e-mail e API token usados em todas as chamadas ao Bitbucket."
      />
      {!data ? (
        <Skeleton className="h-56 w-full rounded-2xl" />
      ) : data.editable ? (
        <CredentialsForm
          key={`${data.source}|${data.workspace}|${data.email}|${data.tokenHint}`}
          initial={data}
        />
      ) : (
        <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          {SOURCE_LABEL[data.source]}. Para alterar, abra o app pelo próprio computador em{" "}
          <span className="font-mono">http://localhost:{window.location.port}</span>.
        </p>
      )}
    </div>
  );
}
