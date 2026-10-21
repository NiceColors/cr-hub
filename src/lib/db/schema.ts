import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const monitoredRepos = sqliteTable("monitored_repos", {
  slug: text("slug").notNull().primaryKey(),
  name: text("name").notNull(),
});

export const monitoredUsers = sqliteTable("monitored_users", {
  uuid: text("uuid").notNull().primaryKey(),
  nickname: text("nickname"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
});

export const squads = sqliteTable("squads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const squadMembers = sqliteTable(
  "squad_members",
  {
    squadId: integer("squad_id")
      .notNull()
      .references(() => squads.id, { onDelete: "cascade" }),
    userUuid: text("user_uuid")
      .notNull()
      .references(() => monitoredUsers.uuid, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.squadId, t.userUuid] }),
  }),
);

export const squadRepoFilters = sqliteTable(
  "squad_repo_filters",
  {
    squadId: integer("squad_id")
      .notNull()
      .references(() => squads.id, { onDelete: "cascade" }),
    repoSlug: text("repo_slug")
      .notNull()
      .references(() => monitoredRepos.slug, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.squadId, t.repoSlug] }),
  }),
);

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  refreshIntervalSec: integer("refresh_interval_sec").notNull().default(30),
});

