import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const repositories = sqliteTable("repositories", {
  uuid: text("uuid").notNull().primaryKey(), // UUID do Bitbucket, inclui {}
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  monitored: integer("monitored", { mode: "boolean" }).notNull().default(false),
  minApprovals: integer("min_approvals").notNull().default(1),
  slaWarningHours: integer("sla_warning_hours"),
  slaCriticalHours: integer("sla_critical_hours"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
});

export const members = sqliteTable("members", {
  uuid: text("uuid").notNull().primaryKey(),
  nickname: text("nickname"),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  monitored: integer("monitored", { mode: "boolean" }).notNull().default(false),
  source: text("source").notNull(), // 'workspace' | 'manual'
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const teamMembers = sqliteTable(
  "team_members",
  {
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    memberUuid: text("member_uuid")
      .notNull()
      .references(() => members.uuid, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.memberUuid] }),
  }),
);

export const teamRepositories = sqliteTable(
  "team_repositories",
  {
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    repositoryUuid: text("repository_uuid")
      .notNull()
      .references(() => repositories.uuid, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.repositoryUuid] }),
  }),
);

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(30),
  jiraBaseUrl: text("jira_base_url"),
  jiraProjectKeys: text("jira_project_keys"), // lista separada por vírgula
});

export const bitbucketCredentials = sqliteTable("bitbucket_credentials", {
  id: integer("id").primaryKey(),
  workspace: text("workspace").notNull(),
  email: text("email").notNull(),
  apiToken: text("api_token").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const snoozes = sqliteTable("snoozes", {
  prKey: text("pr_key").notNull().primaryKey(), // `${repoUuid}:${prId}`
  reason: text("reason").notNull(),
  kind: text("kind").notNull(), // '24h' | 'tomorrow' | 'until_change'
  untilMs: integer("until_ms"),
  untilUpdatedOn: text("until_updated_on"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const savedViews = sqliteTable("saved_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  tab: text("tab").notNull(), // 'all' | 'mine' | 'authored'
  teamId: integer("team_id").references(() => teams.id, { onDelete: "set null" }),
  filterQuery: text("filter_query").notNull(), // JSON
  showSnoozed: integer("show_snoozed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const prDiffstats = sqliteTable(
  "pr_diffstats",
  {
    repoUuid: text("repo_uuid").notNull(),
    prId: integer("pr_id").notNull(),
    updatedOn: text("updated_on").notNull(),
    linesAdded: integer("lines_added").notNull(),
    linesRemoved: integer("lines_removed").notNull(),
    filesChanged: integer("files_changed").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.repoUuid, t.prId] }),
  }),
);

export const prHistory = sqliteTable("pr_history", {
  prKey: text("pr_key").notNull().primaryKey(),
  repoUuid: text("repo_uuid").notNull(),
  prId: integer("pr_id").notNull(),
  authorUuid: text("author_uuid").notNull(),
  destinationBranch: text("destination_branch"),
  createdOn: text("created_on").notNull(),
  firstSeenAt: integer("first_seen_at", { mode: "timestamp_ms" }).notNull(),
  firstReviewAt: integer("first_review_at", { mode: "timestamp_ms" }),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  closedAt: integer("closed_at", { mode: "timestamp_ms" }),
});

export const queueSnapshots = sqliteTable("queue_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  takenAt: integer("taken_at", { mode: "timestamp_ms" }).notNull(),
  total: integer("total").notNull(),
  warning: integer("warning").notNull(),
  critical: integer("critical").notNull(),
  approved: integer("approved").notNull(),
  waiting: integer("waiting").notNull(),
  changesRequested: integer("changes_requested").notNull(),
});
