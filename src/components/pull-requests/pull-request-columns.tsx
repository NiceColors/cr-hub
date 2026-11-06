"use client";

import { ArrowUpRightIcon, PinIcon } from "lucide-react";
import { AvatarGroup } from "@/components/motion/avatar-group";
import type { TableColumn } from "@/components/motion/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, shortPersonName } from "@/domain/person-name";
import { formatAgePtBR, formatCompactAge } from "@/domain/time";
import { useNow } from "@/hooks/use-now";
import {
  AgeIndicator,
  ApprovalsMeter,
  ReviewStateBadge,
} from "@/components/pull-requests/review-state";
import {
  ActivityCounts,
  BuildIcon,
  ComplexityBadge,
  JiraLink,
  SizeBadge,
  SnoozeBadge,
  SuggestedReviewerBadge,
  TargetBadge,
} from "@/components/pull-requests/pull-request-badges";
import type { ReviewerSuggestion } from "@/hooks/use-on-call";
import { PullRequestRowMenu } from "@/components/pull-requests/pull-request-actions";
import { prKey } from "@/domain/pull-request";
import type { PullRequestInsight, PullRequestItem } from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

const REVIEW_STATE_ORDER = {
  changes_requested: 0,
  waiting: 1,
  in_review: 2,
  approved: 3,
} as const;

function reviewerStatus(reviewer: PullRequestItem["reviewers"][number]) {
  if (reviewer.approved) return "aprovou";
  if (reviewer.changesRequested) return "pediu mudanças";
  return "pendente";
}

export function ageBadgeLabel(pr: Pick<PullRequestItem, "ageBand" | "sla">) {
  return pr.ageBand === "critical" ? `>${pr.sla.criticalHours}h` : `>${pr.sla.warningHours}h`;
}

function columnLabel(short: string, full: string) {
  return (
    <span title={full}>
      <span aria-hidden>{short}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}

function CompactAge({
  iso,
  band,
  slaLabel,
}: {
  iso: string;
  band: PullRequestItem["ageBand"];
  slaLabel: string | null;
}) {
  const now = useNow();
  const at = new Date(now);
  const detail = [formatAgePtBR(iso, at), slaLabel].filter(Boolean).join(" · ");
  return (
    <time
      dateTime={iso}
      title={detail}
      className={cn(
        "truncate font-mono text-xs tabular-nums",
        band === "critical" && "text-destructive-foreground",
        band === "warning" && "text-warning-foreground",
      )}
    >
      {formatCompactAge(iso, at)}
    </time>
  );
}

export type PullRequestColumnsContext = {
  insights: Record<string, PullRequestInsight>;
  jiraBaseUrl: string | null;
  suggestFor: (pr: PullRequestItem) => ReviewerSuggestion | null;
  focusKeys: ReadonlySet<string>;
};

export function buildPullRequestColumns({
  insights,
  jiraBaseUrl,
  suggestFor,
  focusKeys,
}: PullRequestColumnsContext): TableColumn<PullRequestItem>[] {
  const insightOf = (pr: PullRequestItem) => insights[prKey(pr.repository.uuid, pr.id)];

  return [
    {
      key: "createdOn",
      header: "Idade",
      sortable: true,
      sortValue: (pr) => pr.createdOn,
      width: "11%",
      cell: (pr) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <AgeIndicator band={pr.ageBand} />
          <CompactAge
            iso={pr.createdOn}
            band={pr.ageBand}
            slaLabel={pr.ageBand === "normal" ? null : ageBadgeLabel(pr)}
          />
        </div>
      ),
    },
    {
      key: "title",
      header: "Pull request",
      sortable: true,
      sortValue: (pr) => pr.title,
      cell: (pr) => {
        const suggestion = pr.reviewers.length === 0 ? suggestFor(pr) : null;
        const focused = focusKeys.has(prKey(pr.repository.uuid, pr.id));
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              title={pr.title}
              className="group/link inline-flex min-w-0 items-center gap-1 rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {focused ? (
                <PinIcon aria-label="No foco de hoje" className="size-3.5 shrink-0 text-primary" />
              ) : null}
              <span className="truncate">{pr.title}</span>
              <ArrowUpRightIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/link:opacity-100 group-focus-visible/link:opacity-100" />
            </a>
            <span className="flex min-w-0 items-center gap-2 overflow-hidden">
              <span className="truncate font-mono text-xs text-muted-foreground">
                {pr.repository.slug} <span className="text-muted-foreground/60">#</span>
                {pr.id}
              </span>
              {pr.targetKind ? (
                <TargetBadge kind={pr.targetKind} branch={pr.destinationBranch} />
              ) : null}
              {pr.jiraKey ? <JiraLink jiraKey={pr.jiraKey} baseUrl={jiraBaseUrl} /> : null}
              {pr.complexity ? <ComplexityBadge complexity={pr.complexity} /> : null}
              <ActivityCounts pr={pr} />
              {suggestion ? (
                <SuggestedReviewerBadge
                  name={suggestion.person.displayName}
                  teamName={suggestion.teamName}
                />
              ) : null}
              {pr.snooze ? <SnoozeBadge snooze={pr.snooze} /> : null}
            </span>
          </div>
        );
      },
    },
    {
      key: "author",
      header: "Autor",
      sortable: true,
      sortValue: (pr) => pr.author.displayName,
      width: "13%",
      hideBelow: "md",
      cell: ({ author }) => (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-6">
            {author.avatarUrl ? <AvatarImage src={author.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{initials(author.displayName)}</AvatarFallback>
          </Avatar>
          <span className="truncate" title={author.displayName}>
            {shortPersonName(author.displayName)}
          </span>
        </div>
      ),
    },
    {
      key: "reviewers",
      header: columnLabel("Rev.", "Revisores"),
      sortable: true,
      sortValue: (pr) => pr.reviewers.length,
      width: "9%",
      hideBelow: "lg",
      truncate: false,
      cell: (pr) =>
        pr.reviewers.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <AvatarGroup
            label={`Revisores de #${pr.id}`}
            size="sm"
            max={2}
            members={pr.reviewers.map((reviewer) => ({
              id: reviewer.uuid,
              name: `${reviewer.displayName} · ${reviewerStatus(reviewer)}`,
              src: reviewer.avatarUrl ?? undefined,
            }))}
          />
        ),
    },
    {
      key: "size",
      header: columnLabel("Tam.", "Tamanho"),
      sortable: true,
      sortValue: (pr) => {
        const size = insightOf(pr)?.size;
        return size ? size.linesAdded + size.linesRemoved : -1;
      },
      width: "9%",
      hideBelow: "md",
      cell: (pr) => <SizeBadge size={insightOf(pr)?.size} />,
    },
    {
      key: "approvals",
      header: columnLabel("Aprov.", "Aprovações"),
      sortable: true,
      sortValue: (pr) => pr.approvals / Math.max(pr.minApprovals, 1),
      width: "10%",
      hideBelow: "sm",
      cell: (pr) => <ApprovalsMeter compact approvals={pr.approvals} required={pr.minApprovals} />,
    },
    {
      key: "state",
      header: "Estado",
      sortable: true,
      sortValue: (pr) => REVIEW_STATE_ORDER[pr.reviewState],
      width: "13%",
      cell: (pr) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <ReviewStateBadge compact state={pr.reviewState} />
          {pr.reviewState === "approved" ? <BuildIcon state={insightOf(pr)?.build} /> : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      width: "5.75rem",
      align: "right",
      truncate: false,
      cell: (pr) => <PullRequestRowMenu pr={pr} />,
    },
  ];
}
