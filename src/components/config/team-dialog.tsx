"use client";

import { useId, useState } from "react";
import { Button } from "@/components/motion/button/base";
import { CenterMorphModal, CenterMorphModalContent } from "@/components/motion/center-morph-modal";
import { Input } from "@/components/motion/input";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectEmpty,
  MultiSelectInput,
  MultiSelectItem,
  MultiSelectList,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/motion/multi-select";
import { HoldToDelete } from "@/components/hold-to-delete";
import { useDeleteTeam, useSaveTeam } from "@/hooks/use-config";
import { useReviewLoad } from "@/hooks/use-review-load";
import { leastLoadedMembers } from "@/domain/pull-request";
import type { Rotation } from "@/domain/rotation";
import { RotationEditor } from "@/components/config/rotation-editor";
import type { Member, Repository, Team } from "@/lib/api/config";

type Option = { value: string; label: string; detail?: string; highlight?: string };

function OptionMultiSelect({
  label,
  hint,
  options,
  selected,
  onChange,
  emptyText,
  placeholder,
}: {
  label: string;
  hint?: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyText: string;
  placeholder: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
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
        <MultiSelect value={selected} onValueChange={onChange}>
          <MultiSelectTrigger className="min-w-0">
            <MultiSelectValue placeholder={placeholder} />
            <MultiSelectInput aria-label={`Buscar ${label.toLowerCase()}`} />
          </MultiSelectTrigger>
          <MultiSelectContent>
            <MultiSelectList ariaLabel={label} className="max-h-64">
              {options.map((opt) => (
                <MultiSelectItem
                  key={opt.value}
                  value={opt.value}
                  textValue={opt.label}
                  keywords={opt.detail ? [opt.detail] : []}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.highlight ? (
                      <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-1.5 text-[10px] text-success-foreground">
                        {opt.highlight}
                      </span>
                    ) : null}
                    {opt.detail ? (
                      <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                        {opt.detail}
                      </span>
                    ) : null}
                  </span>
                </MultiSelectItem>
              ))}
            </MultiSelectList>
            <MultiSelectEmpty />
          </MultiSelectContent>
        </MultiSelect>
      )}
    </div>
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
  const [rotation, setRotation] = useState<Rotation | null>(team?.rotation ?? null);
  const teamMembers = monitoredMembers.filter((m) => memberUuids.includes(m.uuid));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const inTeam = new Set(memberUuids);
    const rotationOrder = rotation?.memberUuids.filter((uuid) => inTeam.has(uuid)) ?? [];
    save.mutate(
      {
        id: team?.id ?? null,
        input: {
          name: name.trim() || "Sem nome",
          memberUuids,
          repositoryUuids,
          rotation: rotation && rotationOrder.length > 0 ? { ...rotation, memberUuids: rotationOrder } : null,
        },
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
        <OptionMultiSelect
          label="Membros"
          placeholder="Escolha os membros"
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
        <OptionMultiSelect
          label="Repositórios"
          placeholder="Todos os repositórios"
          hint="Vazio = todos os repositórios monitorados."
          options={repositories
            .filter((r) => r.monitored)
            .map((r) => ({ value: r.uuid, label: r.name, detail: r.slug }))}
          selected={repositoryUuids}
          onChange={setRepositoryUuids}
          emptyText="Nenhum repositório monitorado."
        />
      </div>

      <RotationEditor value={rotation} onChange={setRotation} teamMembers={teamMembers} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {team ? (
          <HoldToDelete
            label="Segure para excluir"
            itemName={`o time ${team.name}`}
            disabled={remove.isPending}
            onDelete={() => remove.mutate(team.id, { onSuccess: onDone })}
            className="self-start"
          />
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
