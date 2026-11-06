import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { focusItems, reviewSessions } from "@/lib/db/schema";
import { extractJiraKey, parseJiraProjectKeys, prKey } from "@/domain/pull-request";
import { getSettings } from "@/services/configService";

export const FOCUS_LIMIT = 3;

export class FocusError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FocusError";
  }
}

export type FocusItem = {
  id: number;
  prKey: string;
  repoUuid: string;
  prId: number;
  title: string;
  url: string;
  repoSlug: string;
  addedAt: number;
  timeSpentMs: number;
  timerStartedAt: number | null;
  doneAt: number | null;
};

function toItem(row: typeof focusItems.$inferSelect): FocusItem {
  return {
    ...row,
    addedAt: row.addedAt.getTime(),
    timerStartedAt: row.timerStartedAt?.getTime() ?? null,
    doneAt: row.doneAt?.getTime() ?? null,
  };
}

export function listActiveFocus(): FocusItem[] {
  return db
    .select()
    .from(focusItems)
    .where(isNull(focusItems.doneAt))
    .orderBy(asc(focusItems.addedAt))
    .all()
    .map(toItem);
}

export function listDoneFocus(): FocusItem[] {
  return db.select().from(focusItems).where(isNotNull(focusItems.doneAt)).all().map(toItem);
}

export function addFocus(input: {
  repoUuid: string;
  prId: number;
  title: string;
  url: string;
  repoSlug: string;
}) {
  const key = prKey(input.repoUuid, input.prId);
  const active = listActiveFocus();
  if (active.some((item) => item.prKey === key)) return;
  if (active.length >= FOCUS_LIMIT) {
    throw new FocusError(
      "FOCUS_FULL",
      `O foco de hoje já tem ${FOCUS_LIMIT} PRs. Conclua ou tire um antes de adicionar outro.`,
      409,
    );
  }
  db.insert(focusItems).values({ ...input, prKey: key, addedAt: new Date() }).run();
}

function getActive(id: number) {
  const row = db
    .select()
    .from(focusItems)
    .where(and(eq(focusItems.id, id), isNull(focusItems.doneAt)))
    .get();
  if (!row) throw new FocusError("NOT_FOUND", "Item de foco não encontrado.", 404);
  return row;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Soma o trecho em andamento ao total e para o cronômetro. */
function stopTimer(tx: Tx, row: typeof focusItems.$inferSelect, nowMs: number) {
  if (!row.timerStartedAt) return;
  tx.update(focusItems)
    .set({
      timeSpentMs: row.timeSpentMs + Math.max(0, nowMs - row.timerStartedAt.getTime()),
      timerStartedAt: null,
    })
    .where(eq(focusItems.id, row.id))
    .run();
}

function stopAllTimers(tx: Tx, nowMs: number) {
  const running = tx.select().from(focusItems).where(isNotNull(focusItems.timerStartedAt)).all();
  for (const row of running) stopTimer(tx, row, nowMs);
}

/** Um cronômetro por vez: iniciar um pausa o que estiver rodando. */
export function startFocusTimer(id: number, nowMs = Date.now()) {
  getActive(id);
  db.transaction((tx) => {
    stopAllTimers(tx, nowMs);
    tx.update(focusItems)
      .set({ timerStartedAt: new Date(nowMs) })
      .where(eq(focusItems.id, id))
      .run();
  });
}

export function pauseFocusTimer(id: number, nowMs = Date.now()) {
  const row = getActive(id);
  db.transaction((tx) => stopTimer(tx, row, nowMs));
}

export function pauseAllFocusTimers(nowMs = Date.now()) {
  db.transaction((tx) => stopAllTimers(tx, nowMs));
}

export function completeFocus(id: number, nowMs = Date.now()) {
  const row = getActive(id);
  const jiraKeys = parseJiraProjectKeys(getSettings().jiraProjectKeys);
  db.transaction((tx) => {
    stopTimer(tx, row, nowMs);
    tx.update(focusItems).set({ doneAt: new Date(nowMs) }).where(eq(focusItems.id, id)).run();
    const timeSpentMs =
      row.timeSpentMs +
      (row.timerStartedAt ? Math.max(0, nowMs - row.timerStartedAt.getTime()) : 0);
    tx.insert(reviewSessions)
      .values({
        prKey: row.prKey,
        repoUuid: row.repoUuid,
        prId: row.prId,
        title: row.title,
        url: row.url,
        repoSlug: row.repoSlug,
        jiraKey: extractJiraKey(row.title, null, jiraKeys),
        timeSpentMs,
        completedAt: new Date(nowMs),
      })
      .run();
  });
}

export function removeFocus(id: number) {
  getActive(id);
  db.delete(focusItems).where(eq(focusItems.id, id)).run();
}
