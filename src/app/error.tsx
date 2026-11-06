"use client";

import { useEffect } from "react";
import { HomeIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <Empty role="alert" className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Algo deu errado nesta página</EmptyTitle>
        <EmptyDescription>
          O erro foi registrado no console. Tente de novo; se persistir, volte à fila.
          {digest ? (
            <span className="mt-1 block font-mono text-xs">Código: {digest}</span>
          ) : null}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button size="sm" onClick={() => retry()}>
          <RefreshCwIcon className="size-3.5" />
          Tentar de novo
        </Button>
        <ButtonLink href="/" variant="outline" size="sm">
          <HomeIcon className="size-3.5" />
          Ir para a fila
        </ButtonLink>
      </EmptyContent>
    </Empty>
  );
}
