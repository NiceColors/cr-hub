import { and, eq, or } from "drizzle-orm";
import { BitbucketHttpError, mapLimit } from "@/lib/bitbucket/client";
import { createTtlCache } from "@/lib/cache";
import { db } from "@/lib/db";
import { prDiffstats } from "@/lib/db/schema";
import {
  clearPullRequestsCache,
  getRateLimitRemainingSeconds,
  setRateLimitUntilSecondsFromNow,
} from "@/lib/pullRequestsCache";
import {
  aggregateBuildState,
  prKey,
  sizeBucket,
  type BuildState,
  type SizeBucket,
} from "@/domain/pull-request";
import { bitbucketClient } from "@/services/bitbucketClient";
import { getRepository, getSettings } from "@/services/configService";
import { getMe } from "@/services/meService";
import { findCachedPullRequest } from "@/services/pullRequestsService";

export class PullRequestActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PullRequestActionError";
  }
}

function noteRateLimit(err: unknown) {
  if (err instanceof BitbucketHttpError && err.status === 429) {
    setRateLimitUntilSecondsFromNow(err.retryAfterSeconds ?? 60);
  }
}

// --- Tamanho e build -------------------------------------------------------

export type InsightRequest = { repoUuid: string; id: number; updatedOn: string; approved: boolean };

export type PullRequestInsight = {
  size?: {
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
    bucket: SizeBucket;
  };
  build?: BuildState;
};

declare global {
  var __crTrackerBuildCache: ReturnType<typeof createTtlCache<BuildState>> | undefined;
  var __crTrackerDetailCache:
    | ReturnType<typeof createTtlCache<PullRequestDetail>>
    | undefined;
}

const buildCache = globalThis.__crTrackerBuildCache ?? createTtlCache<BuildState>();
globalThis.__crTrackerBuildCache = buildCache;

function toSize(row: { linesAdded: number; linesRemoved: number; filesChanged: number }) {
  return { ...row, bucket: sizeBucket(row.linesAdded + row.linesRemoved) };
}

export async function getInsights(items: InsightRequest[]) {
  const out: Record<string, PullRequestInsight> = {};
  if (items.length === 0) return out;

  const ttlMs = getSettings().pollIntervalSeconds * 1000;
  const stored = db
    .select()
    .from(prDiffstats)
    .where(
      or(
        ...items.map((i) =>
          and(eq(prDiffstats.repoUuid, i.repoUuid), eq(prDiffstats.prId, i.id)),
        ),
      ),
    )
    .all();
  const storedByKey = new Map(stored.map((r) => [prKey(r.repoUuid, r.prId), r]));
  const slugs = new Map<string, string | null>();
  const slugOf = (repoUuid: string) => {
    if (!slugs.has(repoUuid)) slugs.set(repoUuid, getRepository(repoUuid)?.slug ?? null);
    return slugs.get(repoUuid)!;
  };

  await mapLimit(items, 4, async (item) => {
    const key = prKey(item.repoUuid, item.id);
    const insight: PullRequestInsight = {};
    out[key] = insight;

    const row = storedByKey.get(key);
    if (row) insight.size = toSize(row);

    const buildKey = `${key}@${item.updatedOn}`;
    const cachedBuild = item.approved ? buildCache.get(buildKey) : undefined;
    if (cachedBuild) insight.build = cachedBuild;

    const slug = slugOf(item.repoUuid);
    if (!slug || getRateLimitRemainingSeconds() > 0) return;

    if (!row || row.updatedOn !== item.updatedOn) {
      try {
        const totals = await bitbucketClient.getDiffstatTotals(slug, item.id);
        const values = {
          repoUuid: item.repoUuid,
          prId: item.id,
          updatedOn: item.updatedOn,
          ...totals,
        };
        db.insert(prDiffstats)
          .values(values)
          .onConflictDoUpdate({ target: [prDiffstats.repoUuid, prDiffstats.prId], set: values })
          .run();
        insight.size = toSize(totals);
      } catch (err) {
        noteRateLimit(err);
      }
    }

    if (item.approved && !cachedBuild && getRateLimitRemainingSeconds() === 0) {
      try {
        const statuses = await bitbucketClient.listCommitStatuses(slug, item.id);
        const build = aggregateBuildState(statuses.map((s) => s.state));
        buildCache.set(buildKey, build, ttlMs);
        insight.build = build;
      } catch (err) {
        noteRateLimit(err);
      }
    }
  });

  return out;
}

// --- Detalhe para o drawer ---------------------------------------------------

export type PullRequestDetail = {
  description: string;
  comments: {
    id: number;
    createdOn: string;
    author: { displayName: string; avatarUrl: string | null } | null;
    content: string;
    inlinePath: string | null;
  }[];
};

const DETAIL_TTL_MS = 10 * 60 * 1000;
const detailCache = globalThis.__crTrackerDetailCache ?? createTtlCache<PullRequestDetail>();
globalThis.__crTrackerDetailCache = detailCache;

export async function getPullRequestDetail(repoUuid: string, id: number) {
  const pr = await findCachedPullRequest(repoUuid, id);
  if (!pr) {
    throw new PullRequestActionError("NOT_FOUND", "PR não está na fila monitorada.", 404);
  }

  const cacheKey = `${prKey(repoUuid, id)}@${pr.updatedOn}`;
  const cached = detailCache.get(cacheKey);
  if (cached) return cached;

  try {
    const [detail, comments] = await Promise.all([
      bitbucketClient.getPullRequest(pr.repository.slug, id),
      bitbucketClient.listRecentComments(pr.repository.slug, id, 5),
    ]);
    const value: PullRequestDetail = {
      description: detail.summary?.raw ?? "",
      comments: comments.map((c) => ({
        id: c.id,
        createdOn: c.created_on,
        author: c.user
          ? {
              displayName: c.user.display_name ?? c.user.nickname ?? c.user.uuid,
              avatarUrl: c.user.links?.avatar?.href ?? null,
            }
          : null,
        content: c.content?.raw ?? "",
        inlinePath: c.inline?.path ?? null,
      })),
    };
    detailCache.set(cacheKey, value, DETAIL_TTL_MS);
    return value;
  } catch (err) {
    noteRateLimit(err);
    throw err;
  }
}

// --- Me adicionar como revisor ----------------------------------------------

export async function addMeAsReviewer(repoUuid: string, id: number) {
  const repo = getRepository(repoUuid);
  if (!repo) {
    throw new PullRequestActionError("NOT_FOUND", "Repositório não encontrado.", 404);
  }
  const me = await getMe();

  try {
    const pr = await bitbucketClient.getPullRequest(repo.slug, id);
    const current = (pr.reviewers ?? []).map((r) => r.uuid);
    if (current.includes(me.uuid)) return { alreadyReviewer: true };

    await bitbucketClient.setPullRequestReviewers(repo.slug, id, {
      title: pr.title,
      reviewerUuids: [...current, me.uuid],
    });
    clearPullRequestsCache();
    return { alreadyReviewer: false };
  } catch (err) {
    noteRateLimit(err);
    if (err instanceof BitbucketHttpError && (err.status === 403 || err.status === 401)) {
      throw new PullRequestActionError(
        "missing_write_scope",
        "O token não tem permissão de escrita em pull requests. Gere um token com o escopo de escrita (write:pullrequest) para usar esta ação.",
        403,
      );
    }
    if (err instanceof BitbucketHttpError && err.status === 400) {
      throw new PullRequestActionError(
        "BITBUCKET_REJECTED",
        "O Bitbucket recusou a alteração de revisores (o autor não pode ser revisor do próprio PR).",
        400,
      );
    }
    throw err;
  }
}
