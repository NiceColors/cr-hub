"use client";

import { useState } from "react";
import { ShieldCheckIcon } from "lucide-react";
import { useStatus, useVerifyToken } from "@/hooks/use-config";
import { useNow } from "@/hooks/use-now";
import { formatAgePtBR } from "@/domain/time";
import type { Status } from "@/lib/api/config";
import { Button } from "@/components/motion/button/base";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/motion/popover";
import { cn } from "@/lib/utils";

export type TokenTone = "pending" | "ok" | "warning" | "error";

export function describeTokenStatus(
  data: Status | undefined,
  isLoading: boolean,
): { tone: TokenTone; label: string } {
  if (isLoading || !data) return { tone: "pending", label: "Verificando token…" };
  if (data.tokenState === "invalid") return { tone: "error", label: "Token inválido" };
  if (data.tokenState === "unknown") {
    return data.error
      ? { tone: "error", label: "Falha ao verificar token" }
      : { tone: "pending", label: "Verificando token…" };
  }
  if (data.retryAfterSeconds) {
    return { tone: "warning", label: `Rate limit · ${data.retryAfterSeconds}s` };
  }
  if (data.tokenState === "rate_limited") return { tone: "warning", label: "Rate limit" };
  return { tone: "ok", label: "Token válido" };
}

export function TokenDot({ tone }: { tone: TokenTone }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        tone === "ok" && "bg-success",
        tone === "warning" && "bg-warning",
        tone === "error" && "bg-destructive",
        tone === "pending" && "bg-muted-foreground/50",
      )}
    />
  );
}

export function VerifiedAgo({ checkedAt }: { checkedAt: string | null | undefined }) {
  const now = useNow();
  if (!checkedAt) return <>Ainda não verificado</>;
  return (
    <time dateTime={checkedAt} className="tabular-nums">
      Verificado {formatAgePtBR(checkedAt, new Date(now))}
    </time>
  );
}

export function TokenStatus() {
  const { data, isLoading } = useStatus();
  const verify = useVerifyToken();
  const { tone, label } = describeTokenStatus(data, isLoading);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} side="top" align="start">
      <PopoverTrigger>
        <button
          type="button"
          aria-label={`${label}. Abrir opções do token`}
          className="flex min-h-9 w-full min-w-0 items-center gap-2.5 rounded-xl bg-popover px-3 text-left text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid size-5 shrink-0 place-items-center">
            <TokenDot tone={tone} />
          </span>
          <span
            role="status"
            aria-live="polite"
            className="min-w-0 flex-1 truncate text-muted-foreground group-data-[state=collapsed]/sidebar:hidden"
          >
            {label}
          </span>
          <span className="shrink-0 font-mono text-muted-foreground tabular-nums group-data-[state=collapsed]/sidebar:hidden">
            {data?.requestsLastHour ?? "—"} req/h
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <TokenDot tone={tone} />
              {label}
            </span>
            <span className="text-xs text-muted-foreground">
              <VerifiedAgo checkedAt={data?.checkedAt} />
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={verify.isPending}
            onClick={() => {
              verify.mutate();
              setOpen(false);
            }}
          >
            <ShieldCheckIcon />
            Testar token
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
