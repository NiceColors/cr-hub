"use client";

import { useId, useState } from "react";
import { Button } from "@/components/motion/button/base";
import { CenterMorphModal, CenterMorphModalContent } from "@/components/motion/center-morph-modal";
import { Input } from "@/components/motion/input";
import { HoldToDelete } from "@/components/hold-to-delete";
import { Textarea } from "@/components/ui/textarea";
import { ProjectKindPicker } from "@/components/projects/project-kind";
import type { ProjectKind } from "@/domain/project";
import { useProjectActions, type Project } from "@/hooks/use-projects";

function ProjectForm({
  project,
  descriptionId,
  onSaved,
  onDeleted,
  onCancel,
}: {
  project: Project | null;
  descriptionId: string;
  onSaved: (id: number) => void;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const { create, update, remove } = useProjectActions();
  const [name, setName] = useState(project?.name ?? "");
  const [kind, setKind] = useState<ProjectKind>(project?.kind ?? "feature");
  const [notes, setNotes] = useState(project?.notes ?? "");
  const [touched, setTouched] = useState(false);
  const nameError = touched && !name.trim() ? "Informe um nome." : undefined;
  const pending = create.isPending || update.isPending;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    const draft = { name: name.trim(), kind, notes: notes.trim() || null };
    if (project) {
      update.mutate({ id: project.id, patch: draft }, { onSuccess: () => onSaved(project.id) });
      return;
    }
    create.mutate(draft, { onSuccess: (data) => onSaved(data.project.id) });
  }

  return (
    <form onSubmit={submit} aria-describedby={descriptionId} className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1 pr-10">
        <h2 className="text-lg font-semibold text-balance">
          {project ? "Editar agrupamento" : "Novo agrupamento"}
        </h2>
        <p id={descriptionId} className="text-sm text-pretty text-muted-foreground">
          Um projeto, uma feature, um fix ou outro tipo de entrega. Os CRs entram pela ação Vincular
          na fila.
        </p>
      </div>

      <Input
        label="Nome"
        value={name}
        onChange={setName}
        onBlur={() => setTouched(true)}
        placeholder="Ex.: Checkout v2, corrige timeout do login"
        maxLength={80}
        error={nameError}
        classNames={{ input: "text-sm" }}
      />

      <ProjectKindPicker value={kind} onChange={setKind} />

      <Textarea
        label="Notas"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Contexto opcional para quem for olhar este grupo."
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {project ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() =>
                update.mutate(
                  {
                    id: project.id,
                    patch: { status: project.status === "active" ? "done" : "active" },
                  },
                  { onSuccess: () => onSaved(project.id) },
                )
              }
            >
              {project.status === "done" ? "Reabrir" : "Concluir"}
            </Button>
            <HoldToDelete
              label="Segure para excluir"
              itemName={`o agrupamento ${project.name}`}
              disabled={remove.isPending}
              onDelete={() => remove.mutate(project.id, { onSuccess: onDeleted })}
              className="self-center"
            />
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {project ? "Salvar" : "Criar"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ProjectDialog({
  open,
  project,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  project: Project | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: number) => void;
  onDeleted: () => void;
}) {
  const descriptionId = useId();
  return (
    <CenterMorphModal open={open} onOpenChange={onOpenChange}>
      <CenterMorphModalContent
        ariaLabel={project ? "Editar agrupamento" : "Novo agrupamento"}
        ariaDescribedBy={descriptionId}
        closeButtonLabel="Fechar"
        className="max-w-lg"
      >
        {open ? (
          <ProjectForm
            key={project?.id ?? "new"}
            project={project}
            descriptionId={descriptionId}
            onSaved={(id) => {
              onOpenChange(false);
              onSaved(id);
            }}
            onDeleted={() => {
              onOpenChange(false);
              onDeleted();
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </CenterMorphModalContent>
    </CenterMorphModal>
  );
}
