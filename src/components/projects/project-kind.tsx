"use client";

import {
  BlocksIcon,
  FlameIcon,
  FlaskConicalIcon,
  FolderKanbanIcon,
  ListTodoIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/motion/radio";
import {
  PROJECT_KIND_LABELS,
  PROJECT_KINDS,
  type ProjectKind,
} from "@/domain/project";

export const PROJECT_KIND_ICONS: Record<ProjectKind, LucideIcon> = {
  project: FolderKanbanIcon,
  feature: BlocksIcon,
  fix: WrenchIcon,
  chore: ListTodoIcon,
  hotfix: FlameIcon,
  spike: FlaskConicalIcon,
};

export function ProjectKindBadge({ kind }: { kind: ProjectKind }) {
  const Icon = PROJECT_KIND_ICONS[kind];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
      <Icon aria-hidden className="size-3" />
      {PROJECT_KIND_LABELS[kind]}
    </span>
  );
}

export function ProjectKindPicker({
  value,
  onChange,
}: {
  value: ProjectKind;
  onChange: (kind: ProjectKind) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium">
        Tipo
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={(next) => onChange(next as ProjectKind)}
        className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3"
      >
        {PROJECT_KINDS.map((kind) => {
          const Icon = PROJECT_KIND_ICONS[kind];
          return (
            <RadioGroupItem
              key={kind}
              value={kind}
              label={PROJECT_KIND_LABELS[kind]}
              icon={<Icon />}
            />
          );
        })}
      </RadioGroup>
    </div>
  );
}
