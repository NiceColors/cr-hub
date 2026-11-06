"use client";

import { ShieldCheckIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/domain/person-name";
import type { OnCallEntry } from "@/hooks/use-on-call";

/** Revisor de plantão de cada time com escala, em destaque. */
export function OnCallStrip({
  entries,
  teamId,
}: {
  entries: OnCallEntry[];
  /** Com um time selecionado, mostra só a escala dele. */
  teamId?: number | null;
}) {
  const visible = teamId ? entries.filter((e) => e.teamId === teamId) : entries;
  if (visible.length === 0) return null;

  return (
    <section
      aria-label="Revisor de plantão hoje"
      className="flex flex-wrap items-stretch gap-2"
    >
      {visible.map((entry) => (
        <div
          key={entry.teamId}
          className="flex min-w-0 items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2"
        >
          <ShieldCheckIcon aria-hidden className="size-4 shrink-0 text-primary" />
          <Avatar className="size-7">
            {entry.today.avatarUrl ? <AvatarImage src={entry.today.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{initials(entry.today.displayName)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-xs text-muted-foreground">
              Plantão de revisão · {entry.teamName}
            </span>
            <span className="truncate text-sm font-semibold">{entry.today.displayName}</span>
          </div>
          {entry.next ? (
            <span className="hidden shrink-0 border-l pl-3 text-xs text-muted-foreground sm:inline">
              Próximo dia útil: {entry.next.displayName}
            </span>
          ) : null}
        </div>
      ))}
    </section>
  );
}
