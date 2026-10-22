"use client";

import { useStatus } from "@/hooks/use-config";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function TokenStatus() {
  const { data, isLoading } = useStatus();

  const tone = isLoading
    ? "pending"
    : !data?.tokenValid
      ? "error"
      : data.retryAfterSeconds
        ? "warning"
        : "ok";

  const label =
    tone === "pending"
      ? "Verificando token…"
      : tone === "error"
        ? "Token inválido"
        : tone === "warning"
          ? `Rate limit · ${data?.retryAfterSeconds}s`
          : "Token válido";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          tooltip={`${label} · ${data?.requestsLastHour ?? "—"} req/h`}
          className="cursor-default hover:bg-transparent"
          render={<div role="status" aria-live="polite" />}
        >
          <span className="flex size-4 items-center justify-center">
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                tone === "ok" && "bg-success",
                tone === "warning" && "bg-warning",
                tone === "error" && "bg-destructive",
                tone === "pending" && "bg-muted-foreground/50",
              )}
            />
          </span>
          <span className="text-muted-foreground">{label}</span>
          <span className="ml-auto font-mono text-muted-foreground tabular-nums">
            {data?.requestsLastHour ?? "—"} req/h
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
