import { inArray, lte, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { snoozes } from "@/lib/db/schema";
import { computeSnoozeUntilMs, type Snooze, type SnoozeKind } from "@/domain/pull-request";

function purgeExpired(nowMs: number) {
  db.delete(snoozes)
    .where(and(isNotNull(snoozes.untilMs), lte(snoozes.untilMs, nowMs)))
    .run();
}

/** Snoozes por `prKey`. Os vencidos por tempo são apagados aqui; os "até mudar" são avaliados contra o PR. */
export function listSnoozes(nowMs = Date.now()): Map<string, Snooze> {
  purgeExpired(nowMs);
  const rows = db.select().from(snoozes).all();
  return new Map(
    rows.map((r) => [
      r.prKey,
      {
        reason: r.reason,
        kind: r.kind as SnoozeKind,
        untilMs: r.untilMs,
        untilUpdatedOn: r.untilUpdatedOn,
        createdAt: r.createdAt.toISOString(),
      },
    ]),
  );
}

export function setSnooze(input: {
  prKey: string;
  reason: string;
  kind: SnoozeKind;
  updatedOn: string;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const values = {
    prKey: input.prKey,
    reason: input.reason.trim(),
    kind: input.kind,
    untilMs: computeSnoozeUntilMs(input.kind, nowMs),
    untilUpdatedOn: input.kind === "until_change" ? input.updatedOn : null,
    createdAt: new Date(nowMs),
  };
  db.insert(snoozes)
    .values(values)
    .onConflictDoUpdate({ target: snoozes.prKey, set: values })
    .run();
}

export function deleteSnooze(prKey: string) {
  db.delete(snoozes).where(inArray(snoozes.prKey, [prKey])).run();
}

/** Remove snoozes "até mudar" cujo PR já mudou ou fechou. */
export function deleteSnoozes(prKeys: string[]) {
  if (prKeys.length === 0) return;
  db.delete(snoozes).where(inArray(snoozes.prKey, prKeys)).run();
}
