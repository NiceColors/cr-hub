"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import type { TableColumn } from "@/components/motion/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RelativeTime } from "@/components/relative-time";
import {
  AgeIndicator,
  ApprovalsMeter,
  ReviewStateBadge,
} from "@/components/pull-requests/review-state";
import {
  ActivityCounts,
  BuildIcon,
  JiraLink,
  SizeBadge,
  SnoozeBadge,
  TargetBadge,
} from "@/components/pull-requests/pull-request-badges";
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

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ageBadgeLabel(pr: Pick<PullRequestItem, "ageBand" | "sla">) {
  return pr.ageBand === "critical" ? `>${pr.sla.criticalHours}h` : `>${pr.sla.warningHours}h`;
}

export type PullRequestColumnsContext = {
  insights: Record<string, PullRequestInsight>;
  jiraBaseUrl: string | null;
};

export function buildPullRequestColumns({
  insights,
  jiraBaseUrl,
}: PullRequestColumnsContext): TableColumn<PullRequestItem>[] {
  const insightOf = (pr: PullRequestItem) => insights[prKey(pr.repository.uuid, pr.id)];

  return [
    {
      key: "createdOn",
      header: "Idade",
      sortable: true,
      sortValue: (pr) => pr.createdOn,
      width: "170px",
      cell: (pr) => (
        <div className="flex items-center gap-2">
          <AgeIndicator band={pr.ageBand} />
          <RelativeTime
            iso={pr.createdOn}
            className={cn(
              "truncate",
              pr.ageBand === "critical" && "text-destructive-foreground",
              pr.ageBand === "warning" && "text-warning-foreground",
            )}
          />
          {pr.ageBand === "normal" ? null : (
            <AnimatedBadge
              status={pr.ageBand === "critical" ? "danger" : "warning"}
              size="sm"
              showIcon={false}
            >
              {ageBadgeLabel(pr)}
            </AnimatedBadge>
          )}
        </div>
      ),
    },
    {
      key: "title",
      header: "Pull request",
      sortable: true,
      sortValue: (pr) => pr.title,
      cell: (pr) => {
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              title={pr.title}
              className="group/link inline-flex min-w-0 items-center gap-1 rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
            >
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
              <ActivityCounts pr={pr} />
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
      width: "190px",
      cell: ({ author }) => (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-6">
            {author.avatarUrl ? <AvatarImage src={author.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{initials(author.displayName)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{author.displayName}</span>
        </div>
      ),
    },
    {
      key: "size",
      header: "Tamanho",
      sortable: true,
      sortValue: (pr) => {
        const size = insightOf(pr)?.size;
        return size ? size.linesAdded + size.linesRemoved : -1;
      },
      width: "110px",
      cell: (pr) => <SizeBadge size={insightOf(pr)?.size} />,
    },
    {
      key: "approvals",
      header: "Aprovações",
      sortable: true,
      sortValue: (pr) => pr.approvals / Math.max(pr.minApprovals, 1),
      width: "130px",
      cell: (pr) => <ApprovalsMeter approvals={pr.approvals} required={pr.minApprovals} />,
    },
    {
      key: "state",
      header: "Estado",
      sortable: true,
      sortValue: (pr) => REVIEW_STATE_ORDER[pr.reviewState],
      width: "180px",
      cell: (pr) => (
        <div className="flex items-center gap-1.5">
          <ReviewStateBadge state={pr.reviewState} />
          {pr.reviewState === "approved" ? <BuildIcon state={insightOf(pr)?.build} /> : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      width: "64px",
      align: "right",
      cell: (pr) => <PullRequestRowMenu pr={pr} />,
    },
  ];
}
