"use client";

import { useState } from "react";
import Link from "next/link";
import { BookmarkIcon, CheckIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/config/section-header";
import {
  useDeleteSavedView,
  useSavedViews,
  useTeams,
  useUpdateSavedView,
} from "@/hooks/use-config";
import type { SavedView } from "@/lib/api/config";

const TAB_LABEL: Record<SavedView["tab"], string> = {
  all: "Todos",
  mine: "Para mim",
  authored: "Meus PRs",
};

function countRules(filterQuery: unknown) {
  if (typeof filterQuery !== "object" || filterQuery === null) return 0;
  const rules = (filterQuery as { rules?: unknown[] }).rules;
  return Array.isArray(rules) ? rules.length : 0;
}

function ViewRow({ view, teamName }: { view: SavedView; teamName: string | null }) {
  const update = useUpdateSavedView();
  const remove = useDeleteSavedView();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(view.name);
  const [confirming, setConfirming] = useState(false);
  const rules = countRules(view.filterQuery);

  function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === view.name) {
      setEditing(false);
      return;
    }
    update.mutate({ id: view.id, input: { name: name.trim() } }, { onSuccess: () => setEditing(false) });
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      {editing ? (
        <form onSubmit={rename} className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={name}
            onChange={setName}
            aria-label={`Novo nome para ${view.name}`}
            maxLength={60}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setName(view.name);
                setEditing(false);
              }
            }}
            className="flex-1"
            classNames={{ field: "h-8", input: "text-sm" }}
          />
          <Button type="submit" size="icon" variant="ghost" aria-label="Salvar nome">
            <CheckIcon />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Cancelar"
            onClick={() => {
              setName(view.name);
              setEditing(false);
            }}
          >
            <XIcon />
          </Button>
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href={`/?view=${view.id}`}
            className="truncate text-sm font-medium hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {view.name}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {TAB_LABEL[view.tab]} · {teamName ?? "Todos os times"} ·{" "}
            {rules === 0 ? "sem filtros" : `${rules} filtro(s)`}
            {view.showSnoozed ? " · com silenciados" : ""}
          </span>
        </div>
      )}

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs">Excluir “{view.name}”?</span>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(view.id)}
          >
            Excluir
          </Button>
        </div>
      ) : editing ? null : (
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <PencilIcon className="size-3.5" />
            Renomear
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2Icon className="size-3.5" />
            Excluir
          </Button>
        </div>
      )}
    </li>
  );
}

export function ViewsPanel() {
  const views = useSavedViews();
  const teams = useTeams().data?.teams ?? [];
  const teamNames = new Map(teams.map((t) => [t.id, t.name]));
  const list = views.data?.views ?? [];

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Visões salvas"
        description="Combinações de aba, time e filtros. Crie uma pelo botão “Salvar visão” na fila."
      />
      {views.isLoading ? (
        <Skeleton className="h-14 w-full rounded-2xl" />
      ) : list.length === 0 ? (
        <Empty className="border py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookmarkIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma visão salva</EmptyTitle>
            <EmptyDescription>
              Monte os filtros na Fila de CRs e clique em “Salvar visão”.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {list.map((view) => (
            <ViewRow
              key={view.id}
              view={view}
              teamName={view.teamId ? (teamNames.get(view.teamId) ?? null) : null}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
