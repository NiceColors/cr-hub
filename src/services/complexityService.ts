import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { prComplexities } from "@/lib/db/schema";
import type { Complexity } from "@/domain/pull-request";

/** Complexidade atribuída por `prKey`. */
export function listComplexities(): Map<string, Complexity> {
  const rows = db.select().from(prComplexities).all();
  return new Map(rows.map((r) => [r.prKey, r.complexity as Complexity]));
}

export function setComplexity(prKey: string, complexity: Complexity, nowMs = Date.now()) {
  const values = { prKey, complexity, updatedAt: new Date(nowMs) };
  db.insert(prComplexities)
    .values(values)
    .onConflictDoUpdate({ target: prComplexities.prKey, set: values })
    .run();
}

export function deleteComplexity(prKey: string) {
  db.delete(prComplexities).where(eq(prComplexities.prKey, prKey)).run();
}
