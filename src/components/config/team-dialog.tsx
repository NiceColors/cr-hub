"use client";

import { useId, useState } from "react";
import { Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDeleteTeam, useSaveTeam } from "@/hooks/use-config";
import type { Member, Repository, Team } from "@/lib/api/config";

type Option = { value: string; label: string; detail?: string };

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
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ScrollArea className="h-48 rounded-md border">
          <ul className="flex flex-col p-1">
            {options.map((opt) => {
              const inputId = `${id}-${opt.value}`;
              return (
                <li key={opt.value}>
                  <label
                    htmlFor={inputId}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      id={inputId}
                      checked={selected.includes(opt.value)}
                      onCheckedChange={(checked) =>
                        onChange(toggle(selected, opt.value, Boolean(checked)))
                      }
                    />
                    <span className="truncate">{opt.label}</span>
                    {opt.detail ? (
                      <span className="ml-auto truncate font-mono text-xs text-muted-foreground">
                        {opt.detail}
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </fieldset>
  );
}

function TeamForm({
  team,
  members,
  repositories,
  onDone,
}: {
  team: Team | null;
  members: Member[];
  repositories: Repository[];
  onDone: () => void;
}) {
  const save = useSaveTeam();
  const remove = useDeleteTeam();
  const [name, setName] = useState(team?.name ?? "");
  const [memberUuids, setMemberUuids] = useState<string[]>(team?.memberUuids ?? []);
  const [repositoryUuids, setRepositoryUuids] = useState<string[]>(
    team?.repositoryUuids ?? [],
  );

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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{team ? "Editar time" : "Novo time"}</DialogTitle>
        <DialogDescription>
          O time define quais membros aparecem na fila e, opcionalmente, em quais repositórios.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="team-name">Nome</Label>
        <Input
          id="team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Plataforma"
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CheckboxList
          legend="Membros"
          options={members
            .filter((m) => m.monitored)
            .map((m) => ({ value: m.uuid, label: m.displayName }))}
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

      <DialogFooter className="sm:justify-between">
        {team ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button type="button" variant="destructive" />}
            >
              <Trash2Icon data-icon="inline-start" />
              Excluir
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir “{team.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  O time deixa de existir e o filtro da fila volta para todos os times. Esta ação
                  não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(team.id, { onSuccess: onDone })}
                >
                  Excluir time
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {team ? "Salvar" : "Criar time"}
          </Button>
        </div>
      </DialogFooter>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open ? (
          <TeamForm
            key={team?.id ?? "new"}
            team={team}
            members={members}
            repositories={repositories}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
