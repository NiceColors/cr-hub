import { BitbucketHttpError } from "@/lib/bitbucket/client";
import { db } from "@/lib/db";
import { members, repositories } from "@/lib/db/schema";
import { bitbucketClient } from "@/services/bitbucketClient";
import { clearPullRequestsCache } from "@/lib/pullRequestsCache";
import { eq } from "drizzle-orm";

export async function syncRepositoriesFromBitbucket() {
  const repos = await bitbucketClient.listRepositories();
  const now = new Date();

  let added = 0;
  let updated = 0;

  db.transaction((tx) => {
    for (const r of repos) {
      const existing = tx
        .select()
        .from(repositories)
        .where(eq(repositories.uuid, r.uuid))
        .get();
      if (!existing) added++;
      else updated++;

      tx.insert(repositories)
        .values({
          uuid: r.uuid,
          slug: r.slug,
          name: r.name,
          syncedAt: now,
          // monitored/minApprovals preservados no update (se existir)
        })
        .onConflictDoUpdate({
          target: repositories.uuid,
          set: {
            slug: r.slug,
            name: r.name,
            syncedAt: now,
          },
        })
        .run();
    }
  });

  clearPullRequestsCache();
  return { total: repos.length, added, updated };
}

export async function syncMembersFromBitbucket() {
  try {
    const rows = await bitbucketClient.listMembers();
    let added = 0;
    let updated = 0;

    db.transaction((tx) => {
      for (const row of rows) {
        const u = row.user;
        const uuid = u.uuid;
        const nickname = u.nickname ?? null;
        const displayName = u.display_name ?? u.nickname ?? u.uuid;
        const avatarUrl = u.links?.avatar?.href ?? null;

        const existing = tx.select().from(members).where(eq(members.uuid, uuid)).get();
        if (!existing) added++;
        else updated++;

        tx.insert(members)
          .values({
            uuid,
            nickname,
            displayName,
            avatarUrl,
            source: "workspace",
            // monitored preservado (default false)
          })
          .onConflictDoUpdate({
            target: members.uuid,
            set: {
              nickname,
              displayName,
              avatarUrl,
              source: "workspace",
            },
          })
          .run();
      }
    });

    clearPullRequestsCache();
    return { forbidden: false as const, total: rows.length, added, updated };
  } catch (err) {
    if (err instanceof BitbucketHttpError && err.status === 403) {
      return { forbidden: true as const };
    }
    throw err;
  }
}

