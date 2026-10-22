export const queryKeys = {
  config: ["config"] as const,
  repositories: ["config", "repositories"] as const,
  members: ["config", "members"] as const,
  teams: ["config", "teams"] as const,
  settings: ["config", "settings"] as const,
  credentials: ["config", "credentials"] as const,
  views: ["config", "views"] as const,
  status: ["status"] as const,
  me: ["me"] as const,
  pullRequests: ["pull-requests"] as const,
  pullRequestsFor: (teamId: number | null) => ["pull-requests", { teamId }] as const,
  pullRequestInsights: (keys: string[]) => ["pull-request-insights", keys] as const,
  pullRequestDetail: (key: string, updatedOn: string) =>
    ["pull-request-detail", key, updatedOn] as const,
};
