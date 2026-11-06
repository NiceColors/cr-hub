"use client";

import { ShieldCheckIcon } from "lucide-react";
import { StatefulButton } from "@/components/motion/button/stateful";
import { useMutationButtonState } from "@/hooks/use-mutation-button-state";
import { SegmentedControl } from "@/components/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/config/section-header";
import { TokenStatusMark, describeTokenStatus } from "@/components/token-status";
import {
  useSetPollInterval,
  useSettings,
  useStatus,
  useVerifyToken,
} from "@/hooks/use-config";
import { POLL_INTERVALS, type PollInterval } from "@/lib/api/config";

const INTERVAL_OPTIONS = POLL_INTERVALS.map((sec) => ({
  value: String(sec),
  label: <span className="font-mono">{sec}s</span>,
}));

export function PollingPanel() {
  const settings = useSettings();
  const status = useStatus();
  const setPoll = useSetPollInterval();
  const verify = useVerifyToken();
  const verifyState = useMutationButtonState(verify);
  const current = settings.data?.pollIntervalSeconds;
  const token = describeTokenStatus(status.data, status.isLoading);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Atualização"
        description="Intervalo da atualização automática da fila e validade do cache no servidor."
      />

      <div className="divide-y overflow-hidden rounded-2xl border bg-card">
        <section className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Intervalo de atualização</h3>
            <p className="text-xs text-muted-foreground">
              O padrão é 1 minuto. A fila só atualiza com esta aba visível; se o
              intervalo passar em segundo plano, a próxima consulta espera você voltar.
            </p>
          </div>
          {settings.isLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <SegmentedControl
              label="Intervalo de atualização"
              value={current ? String(current) : ""}
              onChange={(value) => {
                const next = Number(value) as PollInterval;
                if (next && next !== current) setPoll.mutate(next);
              }}
              options={INTERVAL_OPTIONS}
              className="self-start sm:self-auto"
            />
          )}
        </section>

        <section className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              Token do Bitbucket
              <TokenStatusMark
                tone={token.tone}
                label={token.label}
                checkedAt={status.data?.checkedAt}
              />
            </h3>
            <p className="text-xs text-muted-foreground">
              Derivado das chamadas já feitas ao Bitbucket. O teste manual consulta a API no
              máximo uma vez a cada 5 minutos.
            </p>
          </div>
          <StatefulButton
            variant="outline"
            size="sm"
            className="shrink-0 self-start whitespace-nowrap sm:self-auto"
            state={verifyState}
            icon={<ShieldCheckIcon className="size-3.5" />}
            loadingText="Testando"
            successText="Testado"
            errorText="Falhou"
            onClick={() => verify.mutate()}
          >
            Testar token
          </StatefulButton>
        </section>

        <section className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Requisições na última hora</h3>
            <p className="text-xs text-muted-foreground">
              Uma por atualização da fila no intervalo, com a aba aberta, ou por
              Atualizar. Não conta cada repositório.
            </p>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {status.data?.requestsLastHour ?? "—"}
          </p>
        </section>

        {status.data?.retryAfterSeconds ? (
          <section className="flex items-center justify-between gap-3 px-4 py-4">
            <h3 className="text-sm font-medium">Limite da API atingido</h3>
            <p className="font-mono text-sm text-warning-foreground tabular-nums">
              nova tentativa em {status.data.retryAfterSeconds}s
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
