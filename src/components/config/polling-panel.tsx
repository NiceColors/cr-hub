"use client";

import { ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/config/section-header";
import { TokenDot, VerifiedAgo, describeTokenStatus } from "@/components/token-status";
import {
  useSetPollInterval,
  useSettings,
  useStatus,
  useVerifyToken,
} from "@/hooks/use-config";
import { POLL_INTERVALS, type PollInterval } from "@/lib/api/config";

export function PollingPanel() {
  const settings = useSettings();
  const status = useStatus();
  const setPoll = useSetPollInterval();
  const verify = useVerifyToken();
  const current = settings.data?.pollIntervalSeconds;
  const token = describeTokenStatus(status.data, status.isLoading);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Atualização"
        description="Intervalo do polling automático da fila e TTL do cache no servidor."
      />

      <dl className="divide-y overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium">Intervalo de polling</dt>
            <p className="text-xs text-muted-foreground">
              Intervalos menores consomem mais da cota da API do Bitbucket.
            </p>
          </div>
          <dd>
            {settings.isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                value={current ? [String(current)] : []}
                onValueChange={(value) => {
                  const next = Number(value[0]) as PollInterval;
                  if (next && next !== current) setPoll.mutate(next);
                }}
                aria-label="Intervalo de polling"
              >
                {POLL_INTERVALS.map((sec) => (
                  <ToggleGroupItem key={sec} value={String(sec)} className="font-mono">
                    {sec}s
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </dd>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium">Token do Bitbucket</dt>
            <p className="text-xs text-muted-foreground">
              Derivado das chamadas já feitas ao Bitbucket. O teste manual consulta a API no
              máximo uma vez a cada 5 minutos.
            </p>
          </div>
          <dd className="flex items-center gap-3">
            <span className="flex flex-col items-end gap-0.5 text-sm">
              <span className="flex items-center gap-2">
                <TokenDot tone={token.tone} />
                {token.label}
              </span>
              <span className="text-xs text-muted-foreground">
                <VerifiedAgo checkedAt={status.data?.checkedAt} />
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => verify.mutate()}
              disabled={verify.isPending}
            >
              <ShieldCheckIcon data-icon="inline-start" />
              Testar token
            </Button>
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium">Requisições na última hora</dt>
            <p className="text-xs text-muted-foreground">
              Janela deslizante em memória, reiniciada com o servidor.
            </p>
          </div>
          <dd className="font-mono text-2xl font-semibold tabular-nums">
            {status.data?.requestsLastHour ?? "—"}
          </dd>
        </div>

        {status.data?.retryAfterSeconds ? (
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <dt className="text-sm font-medium">Rate limit ativo</dt>
            <dd className="font-mono text-sm text-warning-foreground tabular-nums">
              nova tentativa em {status.data.retryAfterSeconds}s
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
