import { beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";

const harness = vi.hoisted(() => {
  // vi.hoisted runs before module imports, so the in-memory driver is loaded here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3") as typeof import("drizzle-orm/better-sqlite3");
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE focus_items (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      pr_key text NOT NULL,
      repo_uuid text NOT NULL,
      pr_id integer NOT NULL,
      title text NOT NULL,
      url text NOT NULL,
      repo_slug text NOT NULL,
      added_at integer NOT NULL,
      time_spent_ms integer DEFAULT 0 NOT NULL,
      timer_started_at integer,
      done_at integer
    );
    CREATE TABLE review_sessions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      pr_key text NOT NULL,
      repo_uuid text NOT NULL,
      pr_id integer NOT NULL,
      title text NOT NULL,
      url text NOT NULL,
      repo_slug text NOT NULL,
      jira_key text,
      time_spent_ms integer NOT NULL,
      completed_at integer NOT NULL
    );
  `);
  return { db: drizzle(sqlite) };
});

vi.mock("@/lib/db", () => ({ db: harness.db }));
vi.mock("@/services/configService", () => ({
  getSettings: () => ({ jiraProjectKeys: "FUND" }),
}));

import { db } from "@/lib/db";
import { focusItems, reviewSessions } from "@/lib/db/schema";
import { completeFocus } from "@/services/focusService";

const now = Date.UTC(2026, 10, 6, 12, 0, 0);

describe("completeFocus", () => {
  beforeEach(() => {
    db.delete(reviewSessions).run();
    db.delete(focusItems).run();
  });

  test("grava a sessão com o tempo já contado mais o trecho em andamento", () => {
    const inserted = db
      .insert(focusItems)
      .values({
        prKey: "{repo}:7",
        repoUuid: "{repo}",
        prId: 7,
        title: "FUND-9 Ajusta taxa",
        url: "https://bitbucket.org/ws/api/pull-requests/7",
        repoSlug: "api",
        addedAt: new Date(now - 120_000),
        timeSpentMs: 60_000,
        timerStartedAt: new Date(now - 30_000),
      })
      .returning({ id: focusItems.id })
      .get();

    completeFocus(inserted.id, now);

    const session = db.select().from(reviewSessions).all();
    expect(session).toHaveLength(1);
    expect(session[0]?.timeSpentMs).toBe(90_000);
    expect(session[0]?.jiraKey).toBe("FUND-9");
    expect(session[0]?.prKey).toBe("{repo}:7");

    const done = db.select().from(focusItems).where(eq(focusItems.id, inserted.id)).get();
    expect(done?.doneAt?.getTime()).toBe(now);
    expect(done?.timerStartedAt).toBeNull();
    expect(done?.timeSpentMs).toBe(90_000);
  });
});
