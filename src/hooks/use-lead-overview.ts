"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { RISK_KINDS } from "@/domain/lead";
import { PROJECT_KINDS, PROJECT_STATUSES } from "@/domain/project";
import { DEFAULT_POLL_INTERVAL_SECONDS } from "@/lib/api/config";
import { getJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { useSettings } from "@/hooks/use-config";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();
const hours = z.number().nullable();
const risk = z.enum(RISK_KINDS);
const health = z.enum(["ok", "attention", "critical"]);
const severity = z.enum(["critical", "warning", "info"]);

const windowStats = z.object({
  opened: count,
  closed: count,
  firstReviewMedianHours: hours,
  cycleMedianHours: hours,
});

const riskCounts = z.object({
  open: count,
  critical: count,
  warning: count,
  noReviewers: count,
  approvedIdle: count,
  stale: count,
  buildFailed: count,
  flagged: count,
});

const pullRequest = z.object({
  key: z.string(),
  id: z.number(),
  title: z.string(),
  url: z.string(),
  repository: z.object({ uuid: z.string(), slug: z.string(), name: z.string() }),
  author: z.object({ uuid: z.string(), displayName: z.string(), avatarUrl: z.string().nullish() }),
  createdOn: z.string(),
  updatedOn: z.string(),
  reviewState: z.enum(["waiting", "in_review", "changes_requested", "approved"]),
  ageBand: z.enum(["normal", "warning", "critical"]),
  approvals: count,
  minApprovals: count,
  reviewers: z.array(
    z.object({
      uuid: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullish(),
      approved: z.boolean(),
      changesRequested: z.boolean(),
    }),
  ),
  jiraKey: z.string().nullable(),
  destinationBranch: z.string().nullable(),
  snoozed: z.boolean(),
  build: z.enum(["successful", "failed", "in_progress", "none"]).nullable(),
  size: z.enum(["P", "M", "G", "GG"]).nullable(),
  changesCycles: count,
  teamIds: z.array(z.number()),
  projectIds: z.array(z.number()),
  risks: z.array(risk),
  score: count,
});

const stage = z.enum(["waiting", "inReview", "approved", "closed", "untracked"]);

const leadOverviewSchema = z.object({
  fetchedAt: z.string(),
  days: z.array(day),
  failedRepos: count,
  rateLimited: z.boolean(),
  summary: z.object({
    counts: riskCounts,
    ageBands: z.object({ normal: count, warning: count, critical: count }),
    stages: z.object({ waiting: count, inReview: count, changesRequested: count, approved: count }),
    period: z.object({ current: windowStats, previous: windowStats.nullable() }),
    funnel: z.object({ opened: count, reviewed: count, approved: count, closed: count }),
    series: z.object({
      open: z.array(count),
      critical: z.array(count),
      closed: z.array(count),
      opened: z.array(count),
    }),
  }),
  attention: z.array(pullRequest),
  pullRequests: z.array(pullRequest),
  teams: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      memberUuids: z.array(z.string()),
      status: health,
      counts: riskCounts,
      stats: windowStats,
      daily: z.array(z.object({ day, status: health, open: count, critical: count })),
      opened: z.array(count),
      closed: z.array(count),
    }),
  ),
  projects: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      kind: z.enum(PROJECT_KINDS),
      status: z.enum(PROJECT_STATUSES),
      createdAt: z.number(),
      updatedAt: z.number(),
      stages: z.object({
        waiting: count,
        inReview: count,
        approved: count,
        closed: count,
        untracked: count,
      }),
      total: count,
      closedInWindow: count,
      oldestOpenHours: hours,
      cycleMedianHours: hours,
      changesCycles: count,
      lastActivityAt: z.number().nullable(),
      authors: z.array(z.string()),
      repos: z.array(z.string()),
      progress: z.number().nullable(),
      idle: z.boolean(),
      flagged: count,
      worst: severity.nullable(),
      pullRequests: z.array(
        z.object({
          prKey: z.string(),
          title: z.string(),
          url: z.string(),
          repoSlug: z.string(),
          authorName: z.string().nullable(),
          stage,
          risks: z.array(risk),
        }),
      ),
      timeline: z.array(
        z.object({
          at: z.number(),
          kind: z.enum(["opened", "reviewed", "approved", "closed"]),
          prKey: z.string(),
          title: z.string(),
        }),
      ),
    }),
  ),
  people: z.array(
    z.object({
      uuid: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      pending: count,
      overdue: count,
      authored: count,
      authoredFlagged: count,
    }),
  ),
});

export type LeadOverviewResponse = z.infer<typeof leadOverviewSchema>;
export type LeadPullRequestRow = LeadOverviewResponse["pullRequests"][number];
export type LeadTeam = LeadOverviewResponse["teams"][number];
export type LeadProject = LeadOverviewResponse["projects"][number];
export type LeadPerson = LeadOverviewResponse["people"][number];

export function useLeadOverview(teamId: number | null, days: number) {
  const settings = useSettings();
  const intervalSec = settings.data?.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
  return useQuery({
    queryKey: queryKeys.lead(teamId, days),
    queryFn: () => {
      const search = new URLSearchParams({ days: String(days) });
      if (teamId) search.set("teamId", String(teamId));
      return getJson(`/api/lead?${search}`, leadOverviewSchema);
    },
    refetchInterval: intervalSec * 1000,
    placeholderData: (previous) => previous,
  });
}
