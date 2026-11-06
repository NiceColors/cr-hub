import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const repositories = sqliteTable("repositories", {
  uuid: text("uuid").notNull().primaryKey(), // UUID do Bitbucket, inclui {}
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  monitored: integer("monitored", { mode: "boolean" }).notNull().default(false),
  minApprovals: integer("min_approvals").notNull().default(1),
  slaWarningHours: integer("sla_warning_hours"),
  slaCriticalHours: integer("sla_critical_hours"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  description: text("description"),
  language: text("language"),
  isPrivate: integer("is_private", { mode: "boolean" }),
  mainBranch: text("main_branch"),
  projectKey: text("project_key"),
  projectName: text("project_name"),
  htmlUrl: text("html_url"),
  updatedOn: text("updated_on"),
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
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(60),
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

export const prComplexities = sqliteTable("pr_complexities", {
  prKey: text("pr_key").notNull().primaryKey(), // `${repoUuid}:${prId}`
  complexity: text("complexity").notNull(), // 'low' | 'medium' | 'high'
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
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
  title: text("title"),
  url: text("url"),
  repoSlug: text("repo_slug"),
  authorName: text("author_name"),
  lastReviewState: text("last_review_state"),
  changesCycles: integer("changes_cycles").notNull().default(0),
  // Verdadeiro quando o PR foi visto antes de qualquer revisão: só então o
  // tempo até a primeira revisão é confiável.
  reviewTrackedFromStart: integer("review_tracked_from_start", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const teamRotations = sqliteTable("team_rotations", {
  teamId: integer("team_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  memberUuids: text("member_uuids").notNull(), // JSON: ordem da escala
  startDate: text("start_date").notNull(), // YYYY-MM-DD
});

export const focusItems = sqliteTable("focus_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prKey: text("pr_key").notNull(),
  repoUuid: text("repo_uuid").notNull(),
  prId: integer("pr_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  repoSlug: text("repo_slug").notNull(),
  addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
  timeSpentMs: integer("time_spent_ms").notNull().default(0),
  timerStartedAt: integer("timer_started_at", { mode: "timestamp_ms" }),
  doneAt: integer("done_at", { mode: "timestamp_ms" }),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'project' | 'feature' | 'fix' | 'chore' | 'hotfix' | 'spike'
  status: text("status").notNull().default("active"), // 'active' | 'done'
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const projectPullRequests = sqliteTable(
  "project_pull_requests",
  {
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    prKey: text("pr_key").notNull(),
    repoUuid: text("repo_uuid").notNull(),
    prId: integer("pr_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    repoSlug: text("repo_slug").notNull(),
    authorName: text("author_name"),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.prKey] }),
    prKeyIdx: index("project_pull_requests_pr_key_idx").on(t.prKey),
  }),
);

export const reviewSessions = sqliteTable(
  "review_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    prKey: text("pr_key").notNull(),
    repoUuid: text("repo_uuid").notNull(),
    prId: integer("pr_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    repoSlug: text("repo_slug").notNull(),
    jiraKey: text("jira_key"),
    timeSpentMs: integer("time_spent_ms").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    completedIdx: index("review_sessions_completed_idx").on(t.completedAt),
    prKeyIdx: index("review_sessions_pr_key_idx").on(t.prKey),
  }),
);

export const testReports = sqliteTable(
  "test_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope").notNull().default("cr"), // 'cr' | 'feature' | 'project' | 'page'
    title: text("title").notNull(),
    prKey: text("pr_key"),
    repoUuid: text("repo_uuid"),
    prId: integer("pr_id"),
    url: text("url").notNull().default(""),
    repoSlug: text("repo_slug").notNull().default(""),
    jiraKey: text("jira_key"),
    outcome: text("outcome").notNull().default("partial"), // 'pass' | 'partial' | 'fail'
    howTested: text("how_tested").notNull().default(""),
    projectId: integer("project_id").references(() => projects.id),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    prKeyIdx: index("test_reports_pr_key_idx").on(t.prKey),
    updatedIdx: index("test_reports_updated_idx").on(t.updatedAt),
    projectIdx: index("test_reports_project_idx").on(t.projectId),
  }),
);

export const testReportMembers = sqliteTable(
  "test_report_members",
  {
    reportId: integer("report_id")
      .notNull()
      .references(() => testReports.id, { onDelete: "cascade" }),
    prKey: text("pr_key").notNull(),
    repoUuid: text("repo_uuid").notNull(),
    prId: integer("pr_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    repoSlug: text("repo_slug").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.reportId, t.prKey] }),
    prKeyIdx: index("test_report_members_pr_key_idx").on(t.prKey),
  }),
);

export const testFindings = sqliteTable(
  "test_findings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id")
      .notNull()
      .references(() => testReports.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'step' | 'error' | 'layout'
    body: text("body").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => ({
    reportIdx: index("test_findings_report_idx").on(t.reportId),
  }),
);

export const testEvidence = sqliteTable(
  "test_evidence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id")
      .notNull()
      .references(() => testReports.id, { onDelete: "cascade" }),
    findingId: integer("finding_id").references(() => testFindings.id, { onDelete: "set null" }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    caption: text("caption").notNull().default(""),
    sortOrder: integer("sort_order").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    reportIdx: index("test_evidence_report_idx").on(t.reportId),
  }),
);

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
