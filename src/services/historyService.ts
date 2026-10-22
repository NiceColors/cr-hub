import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { prHistory, queueSnapshots } from "@/lib/db/schema";
import { prKey, type PullRequest } from "@/domain/pull-request";

const SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Grava a linha do tempo de cada PR a partir de uma busca real no Bitbucket.
 * `okRepoUuids` são os repositórios que responderam sem erro: só neles um PR
 * ausente pode ser dado como fechado.
 */
export function recordHistory(
  pullRequests: PullRequest[],
  okRepoUuids: string[],
  nowMs = Date.now(),
) {
  const now = new Date(nowMs);
  const seen = new Set<string>();

  db.transaction((tx) => {
    for (const pr of pullRequests) {
      const key = prKey(pr.repository.uuid, pr.id);
      seen.add(key);
      const existing = tx.select().from(prHistory).where(eq(prHistory.prKey, key)).get();
      const reviewed = pr.hasReviewActivity || pr.reviewState !== "waiting";
      const approved = pr.reviewState === "approved";

      if (!existing) {
        tx.insert(prHistory)
          .values({
            prKey: key,
            repoUuid: pr.repository.uuid,
            prId: pr.id,
            authorUuid: pr.author.uuid,
            destinationBranch: pr.destinationBranch,
            createdOn: pr.createdOn,
            firstSeenAt: now,
            firstReviewAt: reviewed ? now : null,
            approvedAt: approved ? now : null,
            lastSeenAt: now,
            closedAt: null,
          })
          .run();
        continue;
      }

      tx.update(prHistory)
        .set({
          destinationBranch: pr.destinationBranch,
          lastSeenAt: now,
          closedAt: null,
          firstReviewAt: existing.firstReviewAt ?? (reviewed ? now : null),
          approvedAt: existing.approvedAt ?? (approved ? now : null),
        })
        .where(eq(prHistory.prKey, key))
        .run();
    }

    if (okRepoUuids.length > 0) {
      const open = tx
        .select({ prKey: prHistory.prKey })
        .from(prHistory)
        .where(and(inArray(prHistory.repoUuid, okRepoUuids), isNull(prHistory.closedAt)))
        .all();
      const gone = open.map((r) => r.prKey).filter((key) => !seen.has(key));
      if (gone.length > 0) {
        tx.update(prHistory).set({ closedAt: now }).where(inArray(prHistory.prKey, gone)).run();
      }
    }
  });

  recordSnapshotIfDue(pullRequests, nowMs);
}

function recordSnapshotIfDue(pullRequests: PullRequest[], nowMs: number) {
  const last = db
    .select({ takenAt: queueSnapshots.takenAt })
    .from(queueSnapshots)
    .orderBy(desc(queueSnapshots.takenAt))
    .limit(1)
    .get();
  if (last && nowMs - last.takenAt.getTime() < SNAPSHOT_INTERVAL_MS) return;

  const queue = pullRequests.filter((pr) => pr.authorMonitored);
  let warning = 0;
  let critical = 0;
  let approved = 0;
  let waiting = 0;
  let changesRequested = 0;
  for (const pr of queue) {
    if (pr.ageBand === "warning") warning++;
    if (pr.ageBand === "critical") critical++;
    if (pr.reviewState === "approved") approved++;
    if (pr.reviewState === "waiting") waiting++;
    if (pr.reviewState === "changes_requested") changesRequested++;
  }
  db.insert(queueSnapshots)
    .values({
      takenAt: new Date(nowMs),
      total: queue.length,
      warning,
      critical,
      approved,
      waiting,
      changesRequested,
    })
    .run();
}
