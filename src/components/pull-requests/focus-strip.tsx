"use client";

import { useEffect, useEffectEvent } from "react";
import {
  CheckIcon,
  NotebookPenIcon,
  PauseIcon,
  PinIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { Tooltip } from "@/components/motion/tooltip";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { bancadaPath } from "@/components/revisao/bancada-path";
import { useNow } from "@/hooks/use-now";
import {
  elapsedMs,
  FOCUS_LIMIT,
  formatTimer,
  useFocusActions,
  type FocusItem,
} from "@/hooks/use-focus";
import { useReviews } from "@/hooks/use-reviews";
import { formatDuration } from "@/domain/weekly-report";
import { cn } from "@/lib/utils";

function Timer({ item }: { item: FocusItem }) {
  const now = useNow();
  return (
    <span
      className={cn(
        "font-mono text-sm tabular-nums",
        item.timerStartedAt ? "text-primary" : "text-muted-foreground",
      )}
      aria-label={`Tempo de revisão ${formatTimer(elapsedMs(item, now))}`}
    >
      {formatTimer(elapsedMs(item, now))}
    </span>
  );
}

export type FocusStatus = "pending" | "reviewed" | "gone";

const STATUS_HINT: Record<Exclude<FocusStatus, "pending">, string> = {
  reviewed: "Você já revisou. Conclua para registrar o tempo.",
  gone: "Saiu da fila (merge ou recusa).",
};

/** Os PRs escolhidos para revisar hoje, com cronômetro, no topo de "Para mim". */
export function FocusStrip({
  items,
  statusOf,
}: {
  items: FocusItem[];
  statusOf: (item: FocusItem) => FocusStatus;
}) {
  const { act, remove } = useFocusActions();
  const reviews = useReviews();
  const anyRunning = items.some((item) => item.timerStartedAt !== null);

  // Fechar a aba pausa o cronômetro, para ele não seguir contando sozinho.
  const onPageHide = useEffectEvent(() => {
    if (anyRunning) navigator.sendBeacon("/api/focus/pause-all");
  });
  useEffect(() => {
    const handler = () => onPageHide();
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, []);

  return (
    <section aria-label="Foco de hoje" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <PinIcon aria-hidden className="size-3.5 text-primary" />
          Foco de hoje
          <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
            {items.length}/{FOCUS_LIMIT}
          </span>
        </h2>
        {items.length < FOCUS_LIMIT ? (
          <span className="text-xs text-muted-foreground">
            Fixe PRs pelo menu ⋯ da linha ou pelo painel de detalhes.
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <Empty className="flex-row justify-start gap-3 border p-4 text-left">
          <EmptyMedia variant="icon" className="mb-0">
            <PinIcon />
          </EmptyMedia>
          <EmptyDescription className="text-left">
            Escolha até {FOCUS_LIMIT} PRs para revisar hoje. Eles ficam no topo desta lista e o app
            registra quanto tempo você gasta em cada revisão.
          </EmptyDescription>
        </Empty>
      ) : (
        <ol className="grid gap-2 md:grid-cols-3">
          {items.map((item) => {
            const status = statusOf(item);
            const running = item.timerStartedAt !== null;
            const latest = reviews.data?.latest[item.prKey];
            const benchHref = bancadaPath({
              prKey: item.prKey,
              title: item.title,
              url: item.url,
              repoSlug: item.repoSlug,
            });
            return (
              <li
                key={item.id}
                className={cn(
                  "flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-3",
                  running && "border-primary/50 ring-1 ring-primary/30",
                )}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm font-medium hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                      title={item.title}
                    >
                      {item.title}
                    </a>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {item.repoSlug} #{item.prId}
                    </span>
                    {latest ? (
                      <span className="text-[11px] text-muted-foreground">
                        última: {formatDuration(latest.timeSpentMs)}
                      </span>
                    ) : null}
                  </div>
                  <Tooltip content="Tirar do foco (descarta o tempo)">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove.mutate(item.id)}
                      aria-label={`Tirar ${item.repoSlug} #${item.prId} do foco`}
                      className="size-7 shrink-0"
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </Tooltip>
                </div>

                {status !== "pending" ? (
                  <p className="text-xs text-warning-foreground">{STATUS_HINT[status]}</p>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2">
                  <Timer item={item} />
                  <div className="flex items-center gap-1">
                    <Tooltip asLabel content={running ? "Pausar revisão" : "Iniciar revisão"}>
                      <Button
                        variant={running ? "secondary" : "outline"}
                        size="icon"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate({ id: item.id, action: running ? "pause" : "start" })
                        }
                      >
                        {running ? (
                          <PauseIcon className="size-3.5" />
                        ) : (
                          <PlayIcon className="size-3.5" />
                        )}
                      </Button>
                    </Tooltip>
                    <Tooltip asLabel content="Concluir revisão">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate({ id: item.id, action: "complete", href: benchHref })
                        }
                      >
                        <CheckIcon className="size-3.5" />
                      </Button>
                    </Tooltip>
                    <Tooltip asLabel content="Anotar teste">
                      <ButtonLink href={benchHref} variant="ghost" size="icon">
                        <NotebookPenIcon className="size-3.5" />
                      </ButtonLink>
                    </Tooltip>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
