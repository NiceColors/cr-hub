import {
  BellOffIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ListTodoIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  SignalHighIcon,
  SignalLowIcon,
  SignalMediumIcon,
  UserRoundPlusIcon,
} from "lucide-react";
import { shortPersonName } from "@/domain/person-name";
import type { BuildState, Complexity, SizeBucket, TargetKind } from "@/domain/pull-request";
import { COMPLEXITY_LABELS, type PullRequestItem } from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

const TARGET_LABEL: Record<TargetKind, string> = {
  hotfix: "hotfix",
  production: "prod",
  release: "release",
};

const TARGET_CLASS: Record<TargetKind, string> = {
  hotfix: "border-destructive/40 bg-destructive/10 text-destructive",
  production: "border-warning/40 bg-warning/10 text-warning-foreground",
  release: "border-primary/40 bg-primary/10 text-primary",
};

const chip =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 font-mono text-[10px] leading-none";

export function TargetBadge({ kind, branch }: { kind: TargetKind; branch: string | null }) {
  return (
    <span className={cn(chip, TARGET_CLASS[kind])} title={`Destino: ${branch ?? kind}`}>
      {TARGET_LABEL[kind]}
    </span>
  );
}

const SIZE_CLASS: Record<SizeBucket, string> = {
  P: "border-border text-muted-foreground",
  M: "border-border text-foreground",
  G: "border-warning/40 bg-warning/10 text-warning-foreground",
  GG: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function SizeBadge({
  size,
}: {
  size?: { bucket: SizeBucket; linesAdded: number; linesRemoved: number; filesChanged: number };
}) {
  if (!size) {
    return <span className="font-mono text-xs text-muted-foreground/60">—</span>;
  }
  return (
    <span
      className={cn(chip, "h-6 px-2 text-[11px]", SIZE_CLASS[size.bucket])}
      title={`+${size.linesAdded} −${size.linesRemoved} em ${size.filesChanged} arquivo(s)`}
    >
      {size.bucket}
      <span className="text-muted-foreground">
        {size.linesAdded + size.linesRemoved}
      </span>
    </span>
  );
}

const BUILD: Record<Exclude<BuildState, "none">, { label: string; className: string; Icon: typeof CircleCheckIcon }> = {
  successful: { label: "Build passou", className: "text-success-foreground", Icon: CircleCheckIcon },
  failed: { label: "Build falhou", className: "text-destructive", Icon: CircleXIcon },
  in_progress: { label: "Build em andamento", className: "text-primary", Icon: LoaderCircleIcon },
};

export function BuildIcon({ state }: { state?: BuildState }) {
  if (!state) return null;
  if (state === "none") {
    return (
      <span title="Sem build" className="text-muted-foreground/60">
        <CircleDashedIcon aria-hidden className="size-3.5" />
        <span className="sr-only">Sem build</span>
      </span>
    );
  }
  const { label, className, Icon } = BUILD[state];
  return (
    <span title={label} className={className}>
      <Icon aria-hidden className={cn("size-3.5", state === "in_progress" && "animate-spin")} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ActivityCounts({ pr }: { pr: PullRequestItem }) {
  const tasksBlockMerge = pr.taskCount > 0 && pr.reviewState === "approved";
  return (
    <>
      {pr.commentCount > 0 ? (
        <span
          className="inline-flex items-center gap-0.5 font-mono text-xs text-muted-foreground tabular-nums"
          title={`${pr.commentCount} comentário(s)`}
        >
          <MessageSquareIcon aria-hidden className="size-3" />
          {pr.commentCount}
          <span className="sr-only"> comentários</span>
        </span>
      ) : null}
      {pr.taskCount > 0 ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-mono text-xs tabular-nums",
            tasksBlockMerge ? "text-warning-foreground" : "text-muted-foreground",
          )}
          title={
            tasksBlockMerge
              ? `${pr.taskCount} tarefa(s) aberta(s) impedem o merge`
              : `${pr.taskCount} tarefa(s) aberta(s)`
          }
        >
          <ListTodoIcon aria-hidden className="size-3" />
          {pr.taskCount}
          <span className="sr-only"> tarefas abertas</span>
        </span>
      ) : null}
    </>
  );
}

export const COMPLEXITY_ICON: Record<Complexity, typeof SignalLowIcon> = {
  low: SignalLowIcon,
  medium: SignalMediumIcon,
  high: SignalHighIcon,
};

const COMPLEXITY_CLASS: Record<Complexity, string> = {
  low: "border-border text-muted-foreground",
  medium: "border-primary/40 bg-primary/10 text-primary",
  high: "border-warning/40 bg-warning/10 text-warning-foreground",
};

export function ComplexityBadge({ complexity }: { complexity: Complexity }) {
  const Icon = COMPLEXITY_ICON[complexity];
  const label = COMPLEXITY_LABELS[complexity];
  return (
    <span className={cn(chip, COMPLEXITY_CLASS[complexity])} title={`Complexidade ${label.toLowerCase()}`}>
      <Icon aria-hidden className="size-3" />
      <span className="font-sans">{label}</span>
      <span className="sr-only"> complexidade</span>
    </span>
  );
}

export function SnoozeBadge({ snooze }: { snooze: NonNullable<PullRequestItem["snooze"]> }) {
  return (
    <span
      className={cn(chip, "max-w-40 border-border bg-muted text-muted-foreground")}
      title={`Silenciado: ${snooze.reason}`}
    >
      <BellOffIcon aria-hidden className="size-3" />
      <span className="truncate font-sans">{snooze.reason}</span>
    </span>
  );
}

export function SuggestedReviewerBadge({
  name,
  teamName,
}: {
  name: string;
  teamName: string;
}) {
  return (
    <span
      className={cn(chip, "max-w-44 border-primary/40 bg-primary/10 text-primary")}
      title={`Sem revisor. Plantão de hoje em ${teamName}: ${name}`}
    >
      <UserRoundPlusIcon aria-hidden className="size-3" />
      <span className="truncate font-sans">Sugerido: {shortPersonName(name)}</span>
    </span>
  );
}

export function JiraLink({ jiraKey, baseUrl }: { jiraKey: string; baseUrl: string | null }) {
  if (!baseUrl) {
    return <span className="font-mono text-xs text-muted-foreground">{jiraKey}</span>;
  }
  return (
    <a
      href={`${baseUrl}/browse/${jiraKey}`}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm font-mono text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      title={`Abrir ${jiraKey} no Jira`}
    >
      {jiraKey}
    </a>
  );
}
