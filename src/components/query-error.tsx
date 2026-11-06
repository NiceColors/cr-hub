"use client";

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/** Falha de carregamento com nova tentativa, no lugar de um skeleton infinito. */
export function QueryError({
  title = "Não foi possível carregar",
  error,
  onRetry,
  retrying = false,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const message = error instanceof Error && error.message ? error.message : null;
  return (
    <Empty role="alert" className={cn("rounded-2xl border border-border bg-card", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          {message ?? "Verifique a conexão com o servidor local e tente de novo."}
        </EmptyDescription>
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
            <RefreshCwIcon className={cn("size-3.5", retrying && "animate-spin")} />
            Tentar de novo
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
