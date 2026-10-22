"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/config/section-header";
import { useSetPollInterval, useSettings, useStatus } from "@/hooks/use-config";
import { POLL_INTERVALS, type PollInterval } from "@/lib/api/config";

export function PollingPanel() {
  const settings = useSettings();
  const status = useStatus();
  const setPoll = useSetPollInterval();
  const current = settings.data?.pollIntervalSeconds;

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
