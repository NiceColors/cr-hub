import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const repositories = sqliteTable("repositories", {
  uuid: text("uuid").notNull().primaryKey(), // UUID do Bitbucket, inclui {}
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  monitored: integer("monitored", { mode: "boolean" }).notNull().default(false),
  minApprovals: integer("min_approvals").notNull().default(1),
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
});

