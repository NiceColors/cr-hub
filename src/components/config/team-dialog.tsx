"use client";

import { useId, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { CenterMorphModal, CenterMorphModalContent } from "@/components/motion/center-morph-modal";
import { Checkbox } from "@/components/motion/checkbox";
import { Input } from "@/components/motion/input";
import { useDeleteTeam, useSaveTeam } from "@/hooks/use-config";
import { useReviewLoad } from "@/hooks/use-review-load";
import { leastLoadedMembers } from "@/domain/pull-request";
import type { Member, Repository, Team } from "@/lib/api/config";

type Option = { value: string; label: string; detail?: string; highlight?: string };

function toggle(list: string[], value: string, checked: boolean) {
  return checked ? [...list, value] : list.filter((v) => v !== value);
}

function CheckboxList({
  legend,
  hint,
  options,
  selected,
  onChange,
  emptyText,
}: {
  legend: string;
  hint?: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyText: string;
}) {
  const id = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <legend className="text-sm font-medium">{legend}</legend>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {selected.length}/{options.length}
        </span>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {options.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ul className="flex h-48 flex-col overflow-y-auto overscroll-contain rounded-2xl border p-1">
          {options.map((opt) => (
            <li
              key={opt.value}
              className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/60"
            >
              <Checkbox
                id={`${id}-${opt.value}`}
                checked={selected.includes(opt.value)}
                onCheckedChange={(checked) => onChange(toggle(selected, opt.value, checked))}
                label={opt.label}
                className="min-w-0 flex-1 [&>span]:truncate"
              />
              {opt.highlight ? (
                <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                  {opt.highlight}
                </span>
              ) : null}
              {opt.detail ? (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {opt.detail}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function TeamForm({
  team,
  members,
  repositories,
  descriptionId,
  onDone,
}: {
  team: Team | null;
  members: Member[];
  repositories: Repository[];
  descriptionId: string;
  onDone: () => void;
}) {
  const save = useSaveTeam();
  const remove = useDeleteTeam();
  const load = useReviewLoad();
  const monitoredMembers = members.filter((m) => m.monitored);
  const leastLoaded = new Set(
    load ? leastLoadedMembers(monitoredMembers.map((m) => m.uuid), load) : [],
  );
  const [name, setName] = useState(team?.name ?? "");
  const [memberUuids, setMemberUuids] = useState<string[]>(team?.memberUuids ?? []);
  const [repositoryUuids, setRepositoryUuids] = useState<string[]>(
    team?.repositoryUuids ?? [],
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate(
      {
        id: team?.id ?? null,
        input: { name: name.trim() || "Sem nome", memberUuids, repositoryUuids },
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1 pr-10">
        <h2 className="text-lg font-semibold">{team ? "Editar time" : "Novo time"}</h2>
        <p id={descriptionId} className="text-sm text-muted-foreground">
          O time define quais membros aparecem na fila e, opcionalmente, em quais repositórios.
        </p>
      </div>

      <Input
        label="Nome"
        value={name}
        onChange={setName}
        placeholder="Ex.: Plataforma"
        classNames={{ input: "text-sm" }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <CheckboxList
          legend="Membros"
          hint={load ? "Ao lado, revisões pendentes de cada um agora." : undefined}
          options={monitoredMembers.map((m) => ({
            value: m.uuid,
            label: m.displayName,
            detail: load ? `${load.get(m.uuid)?.pending ?? 0} pend.` : undefined,
            highlight:
              load && leastLoaded.has(m.uuid) && leastLoaded.size < monitoredMembers.length
                ? "Menor carga"
                : undefined,
          }))}
          selected={memberUuids}
          onChange={setMemberUuids}
          emptyText="Nenhum membro monitorado. Marque membros na aba Membros."
        />
        <CheckboxList
          legend="Repositórios"
          hint="Vazio = todos os repositórios monitorados."
          options={repositories
            .filter((r) => r.monitored)
            .map((r) => ({ value: r.uuid, label: r.name, detail: r.slug }))}
          selected={repositoryUuids}
          onChange={setRepositoryUuids}
          emptyText="Nenhum repositório monitorado."
        />
      </div>

      {team && confirmingDelete ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm">
            Excluir “{team.name}”? O filtro da fila volta para todos os times. Esta ação não pode
            ser desfeita.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() => remove.mutate(team.id, { onSuccess: onDone })}
            >
              Excluir time
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {team ? (
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirmingDelete(true)}>
              <Trash2Icon />
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={onDone}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {team ? "Salvar" : "Criar time"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

export function TeamDialog({
  open,
  onOpenChange,
  team,
  members,
  repositories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  members: Member[];
  repositories: Repository[];
}) {
  const descriptionId = useId();
  return (
    <CenterMorphModal open={open} onOpenChange={onOpenChange}>
      <CenterMorphModalContent
        ariaLabel={team ? "Editar time" : "Novo time"}
        ariaDescribedBy={descriptionId}
        closeButtonLabel="Fechar"
        className="max-w-2xl"
      >
        <TeamForm
          key={team?.id ?? "new"}
          team={team}
          members={members}
          repositories={repositories}
          descriptionId={descriptionId}
          onDone={() => onOpenChange(false)}
        />
      </CenterMorphModalContent>
    </CenterMorphModal>
  );
}
