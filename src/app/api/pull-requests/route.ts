import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  monitoredRepos,
  monitoredUsers,
  settings,
  squadMembers,
  squadRepoFilters,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { buildPullRequestQ } from "@/lib/bitbucket/queries";
import {
  BitbucketHttpError,
  fetchAllPages,
  getWorkspaceFromEnv,
  mapLimit,
} from "@/lib/bitbucket/client";
import { bitbucketPullRequestListSchema } from "@/lib/bitbucket/schemas";
import { lastForceAtByKey, pullRequestsCache } from "@/lib/pullRequestsCache";
import type { PullRequestItem } from "@/lib/domain/pullRequests";

type RepoError = { repoSlug: string; status?: number; message: string };

function getRefreshIntervalSec() {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  return row?.refreshIntervalSec ?? 30;
}

function parseIntParam(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function cacheKey(opts: {
  workspace: string;
  repoSlugs: string[];
  authorUuids: string[];
}) {
  const repos = [...opts.repoSlugs].sort().join(",");
  const users = [...opts.authorUuids].sort().join(",");
  return `ws=${opts.workspace};repos=${repos};users=${users}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const squadId = parseIntParam(url.searchParams.get("squadId"));
  const repoSlugFilter = url.searchParams.get("repoSlug");

  const workspace = (() => {
    try {
      return getWorkspaceFromEnv();
    } catch {
      return null;
    }
  })();

  if (!workspace) {
    return NextResponse.json(
      {
        error:
          "Variáveis de ambiente do Bitbucket não configuradas. Verifique o .env.local",
      },
      { status: 400 },
    );
  }

  const refreshIntervalSec = getRefreshIntervalSec();
  const ttlMs = refreshIntervalSec * 1000;

  const allRepos = db.select().from(monitoredRepos).all();
  const allUsers = db.select().from(monitoredUsers).all();

  let repoSlugs = allRepos.map((r) => r.slug);
  let authorUuids = allUsers.map((u) => u.uuid);

  if (repoSlugFilter) repoSlugs = repoSlugs.filter((s) => s === repoSlugFilter);

  if (squadId) {
    const memberRows = db
      .select()
      .from(squadMembers)
      .where(eq(squadMembers.squadId, squadId))
      .all();
    const squadUsers = memberRows.map((m) => m.userUuid);
    authorUuids = authorUuids.filter((u) => squadUsers.includes(u));

    const repoRows = db
      .select()
      .from(squadRepoFilters)
      .where(eq(squadRepoFilters.squadId, squadId))
      .all();
    const filterRepos = repoRows.map((r) => r.repoSlug);
    if (filterRepos.length > 0) {
      repoSlugs = repoSlugs.filter((r) => filterRepos.includes(r));
    }
  }

  const key = cacheKey({ workspace, repoSlugs, authorUuids });

  const cached = pullRequestsCache.get(key) as
    | { cachedAtMs: number; value: unknown }
    | undefined;
  if (!force && cached) {
    return NextResponse.json({
      cached: true,
      cachedAtMs: cached.cachedAtMs,
      refreshIntervalSec,
      generatedAtMs: Date.now(),
      ...(cached.value as object),
    });
  }

  if (force) {
    const last = lastForceAtByKey.get(key) ?? 0;
    const now = Date.now();
    const minGapMs = 10_000;
    if (now - last < minGapMs && cached) {
      return NextResponse.json({
        cached: true,
        forceLimitedForMs: minGapMs - (now - last),
        cachedAtMs: cached.cachedAtMs,
        refreshIntervalSec,
        generatedAtMs: now,
        ...(cached.value as object),
      });
    }
    if (now - last >= minGapMs) lastForceAtByKey.set(key, now);
  }

  const q = buildPullRequestQ(authorUuids);
  const repoBySlug = new Map(allRepos.map((r) => [r.slug, r] as const));

  const errors: RepoError[] = [];
  const pullRequests: PullRequestItem[] = [];
  let minRetryAfterSeconds: number | undefined = undefined;

  const perRepo = await mapLimit(repoSlugs, 4, async (repoSlug) => {
    const repo = repoBySlug.get(repoSlug);
    if (!repo) return;

    const params = new URLSearchParams({
      q,
      pagelen: "50",
      fields:
        "values.id,values.title,values.links.html,values.author,values.created_on,values.updated_on,values.participants,next",
    });
    const path = `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(
      repoSlug,
    )}/pullrequests?${params.toString()}`;

    try {
      const prs = await fetchAllPages(path, bitbucketPullRequestListSchema);
      for (const pr of prs) {
        pullRequests.push({
          id: pr.id,
          title: pr.title,
          url: pr.links.html.href,
          repoSlug,
          repoName: repo.name,
          author: {
            uuid: pr.author.uuid,
            nickname: pr.author.nickname ?? null,
            displayName: pr.author.display_name ?? null,
            avatarUrl: pr.author.links?.avatar?.href ?? null,
          },
          createdOn: pr.created_on,
          participants: (pr.participants ?? []).map((p) => ({
            approved: p.approved ?? null,
            state: p.state ?? null,
          })),
        });
      }
    } catch (err) {
      if (err instanceof BitbucketHttpError) {
        if (err.status === 429 && typeof err.retryAfterSeconds === "number") {
          minRetryAfterSeconds =
            typeof minRetryAfterSeconds === "number"
              ? Math.min(minRetryAfterSeconds, err.retryAfterSeconds)
              : err.retryAfterSeconds;
        }
        errors.push({ repoSlug, status: err.status, message: err.message });
        return;
      }
      errors.push({
        repoSlug,
        message: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  });
  void perRepo;

  const value = {
    pullRequests,
    errors,
    rateLimit:
      typeof minRetryAfterSeconds === "number"
        ? { retryAfterSeconds: minRetryAfterSeconds }
        : null,
  };

  pullRequestsCache.set(key, { cachedAtMs: Date.now(), value }, ttlMs);

  return NextResponse.json({
    cached: false,
    refreshIntervalSec,
    generatedAtMs: Date.now(),
    ...value,
  });
}

