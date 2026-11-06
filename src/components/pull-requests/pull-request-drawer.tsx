"use client";

import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BellIcon,
  BellOffIcon,
  CheckIcon,
  CircleDotIcon,
  FileCodeIcon,
  PinIcon,
  PinOffIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { ProjectKindBadge } from "@/components/projects/project-kind";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { RelativeTime } from "@/components/relative-time";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@/components/motion/collapsible";
import { Drawer } from "@/components/motion/drawer";
import { ApprovalsMeter, ReviewStateBadge } from "@/components/pull-requests/review-state";
import {
  ActivityCounts,
  BuildIcon,
  COMPLEXITY_ICON,
  JiraLink,
  SizeBadge,
  SnoozeBadge,
  TargetBadge,
} from "@/components/pull-requests/pull-request-badges";
import { ageBadgeLabel } from "@/components/pull-requests/pull-request-columns";
import { initials } from "@/domain/person-name";
import {
  canAddMeAsReviewer,
  useFocusState,
  usePullRequestActions,
} from "@/components/pull-requests/pull-request-actions";
import { COMPLEXITIES, prKey } from "@/domain/pull-request";
import { bancadaPath } from "@/components/revisao/bancada-path";
import { useFocusActions } from "@/hooks/use-focus";
import { useOnCall } from "@/hooks/use-on-call";
import { projectsForPullRequest, useProjects } from "@/hooks/use-projects";
import {
  COMPLEXITY_LABELS,
  useAddMeAsReviewer,
  useComplexity,
  usePullRequestDetail,
  useSnooze,
  type PullRequestInsight,
  type PullRequestItem,
} from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

function Person({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Seção longa que pode ser recolhida para encurtar o painel. */
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen>
      <h3>
        <CollapsibleTrigger className="-mx-2 min-h-8 rounded-lg px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground">
          {title}
          <CollapsibleIndicator />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent contentClassName="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** Escolher o nível já marcado limpa a complexidade. */
function ComplexityPicker({ pr }: { pr: PullRequestItem }) {
  const { set, clear } = useComplexity();
  const pending = set.isPending || clear.isPending;
  return (
    <div role="radiogroup" aria-label="Complexidade" className="inline-flex gap-1">
      {COMPLEXITIES.map((c) => {
        const Icon = COMPLEXITY_ICON[c];
        const selected = pr.complexity === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={pending}
            onClick={() => (selected ? clear.mutate(pr) : set.mutate({ pr, complexity: c }))}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
              selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {COMPLEXITY_LABELS[c]}
          </button>
        );
      })}
    </div>
  );
}

function DrawerBody({
  pr,
  insight,
  jiraBaseUrl,
}: {
  pr: PullRequestItem;
  insight: PullRequestInsight | undefined;
  jiraBaseUrl: string | null;
}) {
  const { meUuid, openSnooze, openAssociate } = usePullRequestActions();
  const { projects } = useProjects();
  const linkedProjects = projectsForPullRequest(projects, prKey(pr.repository.uuid, pr.id));
  const detail = usePullRequestDetail(pr);
  const snooze = useSnooze();
  const addMe = useAddMeAsReviewer();
  const focus = useFocusState(pr);
  const focusActions = useFocusActions();
  const suggestion = useOnCall().suggestFor(pr);
  const snoozed = pr.snooze !== null;

  return (
    <>
      <header className="flex flex-col gap-2 border-b px-6 pt-6 pb-4 pr-14">
        <span className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
          {pr.repository.slug} #{pr.id}
          {pr.targetKind ? <TargetBadge kind={pr.targetKind} branch={pr.destinationBranch} /> : null}
          {pr.jiraKey ? <JiraLink jiraKey={pr.jiraKey} baseUrl={jiraBaseUrl} /> : null}
        </span>
        <h2 className="text-lg leading-snug font-semibold text-balance">{pr.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ReviewStateBadge state={pr.reviewState} />
          {pr.reviewState === "approved" ? <BuildIcon state={insight?.build} /> : null}
          {pr.ageBand !== "normal" ? (
            <AnimatedBadge
              status={pr.ageBand === "critical" ? "danger" : "warning"}
              size="sm"
              showIcon={false}
            >
              {ageBadgeLabel(pr)}
            </AnimatedBadge>
          ) : null}
          {snoozed && pr.snooze ? <SnoozeBadge snooze={pr.snooze} /> : null}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-6 py-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Autor</dt>
          <dd className="min-w-0">
            <Person name={pr.author.displayName} avatarUrl={pr.author.avatarUrl} />
          </dd>
          <dt className="text-muted-foreground">Aberto</dt>
          <dd>
            <RelativeTime iso={pr.createdOn} /> · atualizado <RelativeTime iso={pr.updatedOn} />
          </dd>
          <dt className="text-muted-foreground">Branches</dt>
          <dd className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
            <span className="truncate" title={pr.sourceBranch ?? undefined}>
              {pr.sourceBranch ?? "—"}
            </span>
            <ArrowRightIcon aria-label="para" className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate" title={pr.destinationBranch ?? undefined}>
              {pr.destinationBranch ?? "—"}
            </span>
          </dd>
          <dt className="text-muted-foreground">Tamanho</dt>
          <dd>
            <SizeBadge size={insight?.size} />
          </dd>
          <dt className="text-muted-foreground">Complexidade</dt>
          <dd>
            <ComplexityPicker pr={pr} />
          </dd>
          <dt className="text-muted-foreground">Aprovações</dt>
          <dd>
            <ApprovalsMeter approvals={pr.approvals} required={pr.minApprovals} />
          </dd>
          <dt className="text-muted-foreground">Atividade</dt>
          <dd className="flex items-center gap-3">
            {pr.commentCount + pr.taskCount === 0 ? (
              <span className="text-muted-foreground">Sem comentários</span>
            ) : (
              <ActivityCounts pr={pr} />
            )}
          </dd>
        </dl>

        <Section title={`Revisores (${pr.reviewers.length})`}>
          {pr.reviewers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum revisor atribuído.
              {suggestion ? (
                <>
                  {" "}
                  Plantão de hoje em {suggestion.teamName}:{" "}
                  <span className="font-medium text-primary">{suggestion.person.displayName}</span>.
                </>
              ) : null}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pr.reviewers.map((r) => (
                <li key={r.uuid} className="flex items-center justify-between gap-3 text-sm">
                  <Person name={r.displayName} avatarUrl={r.avatarUrl} />
                  {r.approved ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success-foreground">
                      <CheckIcon aria-hidden className="size-3.5" /> Aprovou
                    </span>
                  ) : r.changesRequested ? (
                    <span className="inline-flex items-center gap-1 text-xs text-destructive">
                      <XIcon aria-hidden className="size-3.5" /> Pediu mudanças
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CircleDotIcon aria-hidden className="size-3.5" /> Pendente
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <CollapsibleSection title="Descrição">
          {detail.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : detail.isError ? (
            <p className="text-sm text-muted-foreground">Não foi possível carregar a descrição.</p>
          ) : detail.data?.description.trim() ? (
            <p className="max-h-64 overflow-y-auto rounded-xl bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">
              {detail.data.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sem descrição.</p>
          )}
        </CollapsibleSection>

        <Section title="Vínculos">
          {linkedProjects.length === 0 ? (
            <p className="text-sm text-pretty text-muted-foreground">
              Este CR ainda não está em um projeto, feature ou fix.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {linkedProjects.map((project) => (
                <li
                  key={project.id}
                  className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <ProjectKindBadge kind={project.kind} />
                  <span className="truncate">{project.name}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" onClick={() => openAssociate(pr)} className="self-start">
            Vincular…
          </Button>
        </Section>

        <CollapsibleSection title="Últimos comentários">
          {detail.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : detail.isError ? (
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              Não foi possível carregar os comentários.
              <button
                type="button"
                onClick={() => detail.refetch()}
                className="rounded-sm text-foreground underline underline-offset-2 hover:text-primary"
              >
                Tentar de novo
              </button>
            </p>
          ) : detail.data?.comments.length ? (
            <ul className="flex flex-col gap-3">
              {detail.data.comments.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 rounded-xl border p-3 text-sm">
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate font-medium text-foreground">
                      {c.author?.displayName ?? "Alguém"}
                    </span>
                    <RelativeTime iso={c.createdOn} />
                  </span>
                  {c.inlinePath ? (
                    <span className="flex items-center gap-1 truncate font-mono text-[11px] text-muted-foreground">
                      <FileCodeIcon aria-hidden className="size-3" />
                      {c.inlinePath}
                    </span>
                  ) : null}
                  <p className="line-clamp-4 whitespace-pre-wrap break-words">
                    {c.content || "—"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
          )}
        </CollapsibleSection>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t px-6 py-4">
        <Button
          variant="primary"
          size="sm"
          onClick={() => window.open(pr.url, "_blank", "noopener,noreferrer")}
        >
          <ArrowUpRightIcon />
          Abrir no Bitbucket
        </Button>
        <ButtonLink
          href={bancadaPath({
            prKey: prKey(pr.repository.uuid, pr.id),
            title: pr.title,
            url: pr.url,
            repoSlug: pr.repository.slug,
          })}
          variant="outline"
          size="sm"
        >
          <CircleDotIcon />
          Anotar teste
        </ButtonLink>
        {focus.item ? (
          <Button
            variant="outline"
            size="sm"
            disabled={focusActions.remove.isPending}
            onClick={() => focusActions.remove.mutate(focus.item!.id)}
          >
            <PinOffIcon />
            Tirar do foco
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={focus.full || focusActions.add.isPending}
            title={focus.full ? "O foco de hoje já tem 3 PRs" : undefined}
            onClick={() => focusActions.add.mutate(pr)}
          >
            <PinIcon />
            Fixar no foco
          </Button>
        )}
        {snoozed ? (
          <Button
            variant="outline"
            size="sm"
            disabled={snooze.clear.isPending}
            onClick={() => snooze.clear.mutate(pr)}
          >
            <BellIcon />
            Remover silêncio
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => openSnooze(pr)}>
            <BellOffIcon />
            Silenciar…
          </Button>
        )}
        {canAddMeAsReviewer(pr, meUuid) ? (
          <Button
            variant="outline"
            size="sm"
            disabled={addMe.isPending}
            onClick={() => addMe.mutate(pr)}
          >
            <UserPlusIcon />
            Me adicionar como revisor
          </Button>
        ) : null}
      </footer>
    </>
  );
}

export function PullRequestDrawer({
  pr,
  insight,
  jiraBaseUrl,
  onClose,
}: {
  pr: PullRequestItem | null;
  insight: PullRequestInsight | undefined;
  jiraBaseUrl: string | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={pr !== null}
      onOpenChange={(open) => !open && onClose()}
      ariaLabel={pr ? `Detalhes de ${pr.repository.slug} #${pr.id}` : "Detalhes do PR"}
      className="z-[95] w-full max-w-xl"
      backdropClassName="z-[90] bg-background/30 backdrop-blur-[2px]"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full"
      >
        <XIcon aria-hidden className="size-4" />
      </Button>
      {pr ? <DrawerBody pr={pr} insight={insight} jiraBaseUrl={jiraBaseUrl} /> : null}
    </Drawer>
  );
}
