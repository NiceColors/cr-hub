"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useStatus, useVerifyToken } from "@/hooks/use-config";
import { useNow } from "@/hooks/use-now";
import { formatAgePtBR } from "@/domain/time";
import type { Status } from "@/lib/api/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton
            size="sm"
            aria-label={`${label}. Abrir opções do token`}
            tooltip={{ children: <VerifiedAgo checkedAt={data?.checkedAt} />, hidden: false }}
            render={<DropdownMenuTrigger />}
          >
            <span className="flex size-4 items-center justify-center">
              <TokenDot tone={tone} />
            </span>
            <span role="status" aria-live="polite" className="text-muted-foreground">
              {label}
            </span>
            <span className="ml-auto font-mono text-muted-foreground tabular-nums">
              {data?.requestsLastHour ?? "—"} req/h
            </span>
          </SidebarMenuButton>
          <DropdownMenuContent side="top" align="start" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-foreground">{label}</span>
                <VerifiedAgo checkedAt={data?.checkedAt} />
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={verify.isPending} onClick={() => verify.mutate()}>
              <ShieldCheckIcon />
              Testar token
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
