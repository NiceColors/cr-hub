"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRightIcon } from "lucide-react";
import type { DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/relative-time";
import {
  AgeIndicator,
  ApprovalsMeter,
  ReviewStateBadge,
} from "@/components/pull-requests/review-state";
import type { PullRequestItem } from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

const REVIEW_STATE_ORDER = {
  changes_requested: 0,
  waiting: 1,
  in_review: 2,
  approved: 3,
} as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export const pullRequestColumns: ColumnDef<DataGridFeatures, PullRequestItem>[] = [
  {
    id: "createdOn",
    accessorFn: (pr) => pr.createdOn,
    header: ({ column }) => <DataGridColumnHeader column={column} title="Idade" />,
    sortFn: "basic",
    size: 170,
    cell: ({ row }) => {
      const pr = row.original;
      return (
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
            <Badge variant={pr.ageBand === "critical" ? "destructive" : "warning"}>
              {pr.ageBand === "critical" ? ">72h" : ">24h"}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    id: "title",
    accessorFn: (pr) => pr.title,
    header: ({ column }) => <DataGridColumnHeader column={column} title="Pull request" />,
    size: 420,
    cell: ({ row }) => {
      const pr = row.original;
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            title={pr.title}
            className="group/link inline-flex min-w-0 items-center gap-1 rounded-sm font-medium outline-none transition-colors duration-fast ease-out hover:text-primary focus-ring"
          >
            <span className="truncate">{pr.title}</span>
            <ArrowUpRightIcon className="size-3 shrink-0 -translate-x-0.5 translate-y-0.5 text-muted-foreground opacity-0 transition-[opacity,translate] duration-fast ease-out group-hover/link:translate-x-0 group-hover/link:translate-y-0 group-hover/link:opacity-100 group-focus-visible/link:translate-x-0 group-focus-visible/link:translate-y-0 group-focus-visible/link:opacity-100" />
          </a>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {pr.repository.slug} <span className="text-muted-foreground/60">#</span>
            {pr.id}
          </span>
        </div>
      );
    },
  },
  {
    id: "author",
    accessorFn: (pr) => pr.author.displayName,
    header: ({ column }) => <DataGridColumnHeader column={column} title="Autor" />,
    size: 200,
    cell: ({ row }) => {
      const { author } = row.original;
      return (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-6">
            {author.avatarUrl ? (
              <AvatarImage src={author.avatarUrl} alt={author.displayName} />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {initials(author.displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{author.displayName}</span>
        </div>
      );
    },
  },
  {
    id: "approvals",
    accessorFn: (pr) => pr.approvals / Math.max(pr.minApprovals, 1),
    header: ({ column }) => <DataGridColumnHeader column={column} title="Aprovações" />,
    sortFn: "basic",
    size: 140,
    cell: ({ row }) => (
      <ApprovalsMeter approvals={row.original.approvals} required={row.original.minApprovals} />
    ),
  },
  {
    id: "state",
    accessorFn: (pr) => REVIEW_STATE_ORDER[pr.reviewState],
    header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
    sortFn: "basic",
    size: 160,
    cell: ({ row }) => <ReviewStateBadge state={row.original.reviewState} />,
  },
];
