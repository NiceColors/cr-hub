"use client";

import { formatAgePtBR } from "@/domain/time";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

const absoluteFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const now = useNow();
  return (
    <time
      dateTime={iso}
      title={absoluteFormat.format(new Date(iso))}
      className={cn("tabular-nums", className)}
    >
      {formatAgePtBR(iso, new Date(now))}
    </time>
  );
}
