import { desc } from "drizzle-orm";
import { extractJiraKey, parseJiraProjectKeys } from "@/domain/pull-request";
import { db } from "@/lib/db";
import { reviewSessions } from "@/lib/db/schema";
import { getSettings } from "@/services/configService";

const SESSION_LIMIT = 50;

export type ReviewSession = {
  id: number;
  prKey: string;
  repoUuid: string;
  prId: number;
  title: string;
  url: string;
  repoSlug: string;
  jiraKey: string | null;
  timeSpentMs: number;
  completedAt: number;
};

export type ReviewLatest = {
  timeSpentMs: number;
  completedAt: number;
};

function toSession(
  row: typeof reviewSessions.$inferSelect,
  jiraKeys: string[],
): ReviewSession {
  return {
    id: row.id,
    prKey: row.prKey,
    repoUuid: row.repoUuid,
    prId: row.prId,
    title: row.title,
    url: row.url,
    repoSlug: row.repoSlug,
    jiraKey: row.jiraKey ?? extractJiraKey(row.title, null, jiraKeys),
    timeSpentMs: row.timeSpentMs,
    completedAt: row.completedAt.getTime(),
  };
}

/** Sessões mais recentes e a última duração de cada PR, para o card do foco. */
export function listReviewSessions() {
  const jiraKeys = parseJiraProjectKeys(getSettings().jiraProjectKeys);
  const sessions = db
    .select()
    .from(reviewSessions)
    .orderBy(desc(reviewSessions.completedAt), desc(reviewSessions.id))
    .all()
    .map((row) => toSession(row, jiraKeys));

  const latest: Record<string, ReviewLatest> = {};
  for (const session of sessions) {
    if (!latest[session.prKey]) {
      latest[session.prKey] = {
        timeSpentMs: session.timeSpentMs,
        completedAt: session.completedAt,
      };
    }
  }

  return { sessions: sessions.slice(0, SESSION_LIMIT), latest };
}
