"use client";

import { useId, useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { CenterMorphModal, CenterMorphModalContent } from "@/components/motion/center-morph-modal";
import { Checkbox } from "@/components/motion/checkbox";
import { Input } from "@/components/motion/input";
import { ProjectKindBadge, ProjectKindPicker } from "@/components/projects/project-kind";
import { prKey } from "@/domain/pull-request";
import type { ProjectKind } from "@/domain/project";
import {
  projectsForPullRequest,
  useProjectActions,
  useProjects,
  type Project,
} from "@/hooks/use-projects";
import type { PullRequestItem } from "@/hooks/use-pull-requests";

function ProjectToggle({
  project,
  linked,
  pending,
  onToggle,
}: {
  project: Project;
  linked: boolean;
  pending: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/60">
      <Checkbox
        checked={linked}
        disabled={pending}
        onCheckedChange={onToggle}
        label={project.name}
        description={project.status === "done" ? "Concluído" : undefined}
        className="min-w-0 flex-1 [&>span]:truncate"
      />
      <ProjectKindBadge kind={project.kind} />
    </li>
  );
}

function AssociateForm({
  pr,
  descriptionId,
  onClose,
}: {
  pr: PullRequestItem;
  descriptionId: string;
  onClose: () => void;
}) {
  const { projects, query } = useProjects();
  const { create, link, unlink } = useProjectActions();
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProjectKind>("feature");
  const key = prKey(pr.repository.uuid, pr.id);
  const linkedIds = new Set(projectsForPullRequest(projects, key).map((project) => project.id));
  const needle = filter.trim().toLowerCase();
  const visible = projects.filter((project) => {
    if (!needle) return true;
    return project.name.toLowerCase().includes(needle);
  });

  function createAndLink(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), kind },
      {
        onSuccess: (data) => {
          link.mutate({ projectId: data.project.id, pr }, { onSuccess: () => setName("") });
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1 pr-10">
        <h2 className="text-lg font-semibold text-balance">Vincular CR</h2>
        <p id={descriptionId} className="text-sm text-pretty text-muted-foreground">
          <span className="font-mono">
            {pr.repository.slug} #{pr.id}
          </span>{" "}
          pode entrar em mais de um agrupamento. Marque projeto, feature, fix ou outro tipo.
        </p>
      </div>

      <Input
        label="Buscar"
        value={filter}
        onChange={setFilter}
        placeholder="Nome do projeto, feature ou fix"
        classNames={{ input: "text-sm" }}
      />

      {query.isError ? (
        <p role="alert" className="text-sm text-destructive-foreground">
          Não foi possível carregar os agrupamentos.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-3 py-4 text-center text-sm text-pretty text-muted-foreground">
          {projects.length === 0
            ? "Ainda não há agrupamentos. Crie o primeiro abaixo."
            : "Nenhum agrupamento com esse nome."}
        </p>
      ) : (
        <ul className="flex max-h-64 flex-col overflow-y-auto overscroll-contain rounded-2xl border p-1">
          {visible.map((project) => (
            <ProjectToggle
              key={project.id}
              project={project}
              linked={linkedIds.has(project.id)}
              pending={
                (link.isPending && link.variables?.projectId === project.id) ||
                (unlink.isPending && unlink.variables?.projectId === project.id)
              }
              onToggle={(checked) => {
                if (checked) link.mutate({ projectId: project.id, pr });
                else unlink.mutate({ projectId: project.id, prKey: key });
              }}
            />
          ))}
        </ul>
      )}

      <form onSubmit={createAndLink} className="flex flex-col gap-3 rounded-2xl border border-dashed p-3">
        <p className="text-sm font-medium">Criar e vincular</p>
        <Input
          label="Nome"
          value={name}
          onChange={setName}
          placeholder="Ex.: corrige timeout do login"
          maxLength={80}
          classNames={{ input: "text-sm" }}
        />
        <ProjectKindPicker value={kind} onChange={setKind} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button type="submit" disabled={!name.trim() || create.isPending || link.isPending}>
            <PlusIcon />
            Criar e vincular
          </Button>
        </div>
      </form>
    </div>
  );
}

export function AssociatePullRequestDialog({
  pr,
  onClose,
}: {
  pr: PullRequestItem | null;
  onClose: () => void;
}) {
  const descriptionId = useId();
  return (
    <CenterMorphModal open={pr !== null} onOpenChange={(open) => !open && onClose()}>
      <CenterMorphModalContent
        ariaLabel="Vincular CR"
        ariaDescribedBy={descriptionId}
        closeButtonLabel="Fechar"
        className="max-w-lg"
      >
        {pr ? (
          <AssociateForm
            key={`${pr.repository.uuid}:${pr.id}`}
            pr={pr}
            descriptionId={descriptionId}
            onClose={onClose}
          />
        ) : null}
      </CenterMorphModalContent>
    </CenterMorphModal>
  );
}
