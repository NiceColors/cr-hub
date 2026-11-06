"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import {
  SortableList,
  SortableListGroup,
  SortableListHandle,
  SortableListItem,
  SortableListItemContent,
  SortableListUndo,
} from "@/components/motion/sortable-list";
import { Switch } from "@/components/motion/switch";
import { nextBusinessDay, onCallFor, toIsoDate, type Rotation } from "@/domain/rotation";

/** Escala de revisor do dia: ordem dos membros e o dia em que o primeiro começa. */
export function RotationEditor({
  value,
  onChange,
  teamMembers,
}: {
  value: Rotation | null;
  onChange: (next: Rotation | null) => void;
  teamMembers: { uuid: string; displayName: string }[];
}) {
  const names = new Map(teamMembers.map((m) => [m.uuid, m.displayName]));
  const order = (value?.memberUuids ?? []).filter((uuid) => names.has(uuid));
  const outside = teamMembers.filter((m) => !order.includes(m.uuid));
  const today = toIsoDate(new Date());
  const current = value ? { ...value, memberUuids: order } : null;
  const onCallToday = current ? onCallFor(current, today) : null;
  const onCallNext = current ? onCallFor(current, nextBusinessDay(today)) : null;

  const update = (memberUuids: string[]) => value && onChange({ ...value, memberUuids });

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border p-4">
      <legend className="sr-only">Escala de revisor do dia</legend>
      <Switch
        size="sm"
        checked={value !== null}
        onCheckedChange={(checked) =>
          onChange(
            checked
              ? {
                  memberUuids: teamMembers
                    .toSorted((a, b) => a.displayName.localeCompare(b.displayName))
                    .map((m) => m.uuid),
                  startDate: today,
                }
              : null,
          )
        }
        disabled={teamMembers.length === 0}
        label="Escala de revisor do dia"
        description={
          teamMembers.length === 0
            ? "Marque membros no time para montar a escala."
            : "Um plantão por dia útil, em rodízio. PRs do time sem revisor sugerem o plantão."
        }
      />

      {value ? (
        <>
          {order.length === 0 ? (
            <p className="text-xs text-muted-foreground">Adicione ao menos um membro à escala.</p>
          ) : (
            <SortableList
              items={order.map((uuid) => ({ id: uuid, name: names.get(uuid) ?? uuid }))}
              onItemsChange={(items) => update(items.map((item) => item.id))}
              getItemLabel={(item) => item.name}
              label="Ordem da escala"
              className="max-w-none"
              itemClassName="gap-2 rounded-xl p-1 pr-1.5"
            >
              {(items) => (
                <>
                  <SortableListGroup className="space-y-1.5">
                    {items.map((item, i) => (
                      <SortableListItem key={item.id} id={item.id}>
                        <SortableListHandle className="size-7" />
                        <SortableListItemContent className="flex items-center gap-2 text-sm">
                          <span className="w-5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {i + 1}.
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                          {item.id === onCallToday ? (
                            <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                              Hoje
                            </span>
                          ) : item.id === onCallNext ? (
                            <span className="shrink-0 rounded-full border px-1.5 text-[10px] text-muted-foreground">
                              Próximo
                            </span>
                          ) : null}
                        </SortableListItemContent>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Tirar ${item.name} da escala`}
                          onClick={() => update(order.filter((u) => u !== item.id))}
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                      </SortableListItem>
                    ))}
                  </SortableListGroup>
                  <SortableListUndo className="mt-2" />
                </>
              )}
            </SortableList>
          )}

          {outside.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Fora da escala:</span>
              {outside.map((m) => (
                <button
                  key={m.uuid}
                  type="button"
                  onClick={() => update([...order, m.uuid])}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <PlusIcon aria-hidden className="size-3" />
                  {m.displayName}
                </button>
              ))}
            </div>
          ) : null}

          <Input
            label="Primeiro da lista começa em"
            type="date"
            value={value.startDate}
            onChange={(startDate) => startDate && onChange({ ...value, startDate })}
            className="sm:w-60"
            classNames={{ field: "h-9", input: "text-sm" }}
          />
        </>
      ) : null}
    </fieldset>
  );
}
