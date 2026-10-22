import { z } from "zod";
import { getJson, sendJson } from "@/lib/api/http";

export const repositorySchema = z.object({
  uuid: z.string(),
  slug: z.string(),
  name: z.string(),
  monitored: z.boolean(),
  minApprovals: z.number(),
});

export const memberSchema = z.object({
  uuid: z.string(),
  nickname: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  monitored: z.boolean(),
  source: z.string(),
});

export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  createdAt: z.number(),
  memberUuids: z.array(z.string()),
  repositoryUuids: z.array(z.string()),
});

const repositoriesResponse = z.object({ repositories: z.array(repositorySchema) });
const membersResponse = z.object({ members: z.array(memberSchema) });
const teamsResponse = z.object({ teams: z.array(teamSchema) });
const settingsResponse = z.object({ pollIntervalSeconds: z.number() });

const statusResponse = z.object({
  tokenValid: z.boolean(),
  requestsLastHour: z.number(),
  retryAfterSeconds: z.number().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});

const syncRepositoriesResponse = z.object({
  total: z.number(),
  added: z.number(),
  updated: z.number(),
});

const syncMembersResponse = z.union([
  z.object({ forbidden: z.literal(true) }),
  z.object({
    forbidden: z.literal(false),
    total: z.number(),
    added: z.number(),
    updated: z.number(),
  }),
]);

export type Repository = z.infer<typeof repositorySchema>;
export type Member = z.infer<typeof memberSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Settings = z.infer<typeof settingsResponse>;
export type Status = z.infer<typeof statusResponse>;
export type PollInterval = 30 | 60 | 120;
export type TeamInput = Pick<Team, "name" | "memberUuids" | "repositoryUuids">;

export const POLL_INTERVALS: readonly PollInterval[] = [30, 60, 120];

export const configApi = {
  repositories: () => getJson("/api/config/repositories", repositoriesResponse),
  members: () => getJson("/api/config/members", membersResponse),
  teams: () => getJson("/api/config/teams", teamsResponse),
  settings: () => getJson("/api/config/settings", settingsResponse),
  status: () => getJson("/api/status", statusResponse, { acceptErrorBody: true }),

  patchRepository: (
    uuid: string,
    patch: Partial<Pick<Repository, "monitored" | "minApprovals">>,
  ) => sendJson(`/api/config/repositories/${encodeURIComponent(uuid)}`, "PATCH", patch),
  patchMember: (uuid: string, patch: Partial<Pick<Member, "monitored">>) =>
    sendJson(`/api/config/members/${encodeURIComponent(uuid)}`, "PATCH", patch),
  addMember: (input: { uuid: string; nickname: string | null }) =>
    sendJson("/api/config/members", "POST", input),
  setPollInterval: (pollIntervalSeconds: PollInterval) =>
    sendJson("/api/config/settings", "PUT", { pollIntervalSeconds }),
  createTeam: (input: TeamInput) => sendJson("/api/config/teams", "POST", input),
  updateTeam: (id: number, input: TeamInput) =>
    sendJson(`/api/config/teams/${id}`, "PUT", input),
  deleteTeam: (id: number) => sendJson(`/api/config/teams/${id}`, "DELETE"),

  syncRepositories: () =>
    sendJson(
      "/api/bitbucket/repositories/sync",
      "POST",
      undefined,
      syncRepositoriesResponse,
    ),
  syncMembers: () =>
    sendJson("/api/bitbucket/members/sync", "POST", undefined, syncMembersResponse),
};
