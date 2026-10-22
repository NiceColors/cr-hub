export const queryKeys = {
  config: ["config"] as const,
  repositories: ["config", "repositories"] as const,
  members: ["config", "members"] as const,
  teams: ["config", "teams"] as const,
  settings: ["config", "settings"] as const,
  status: ["status"] as const,
  pullRequests: ["pull-requests"] as const,
  pullRequestsFor: (teamId: number | null) => ["pull-requests", { teamId }] as const,
};
