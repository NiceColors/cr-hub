import { z } from "zod";
import { requestsCounter } from "@/lib/requestsCounter";
import {
  bitbucketCommentSchema,
  bitbucketCommitStatusSchema,
  bitbucketDiffstatSchema,
  bitbucketPullRequestDetailSchema,
  bitbucketPullRequestSchema,
  bitbucketRepoSchema,
  bitbucketUserSchema,
  bitbucketWorkspaceMemberSchema,
  type BitbucketComment,
  type BitbucketPullRequestDetail,
} from "@/lib/bitbucket/schemas";
import { buildOpenPrQueryBatches } from "@/lib/bitbucket/queries";
import { resolveCredentials, type BitbucketCredentials } from "@/lib/bitbucket/credentials";

const BITBUCKET_API_BASE = "https://api.bitbucket.org/2.0";

export class BitbucketHttpError extends Error {
  status: number;
  retryAfterSeconds?: number;
  url: string;

  constructor(
    message: string,
    opts: { status: number; url: string; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = "BitbucketHttpError";
    this.status = opts.status;
    this.url = opts.url;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

function getAuth(override?: BitbucketCredentials) {
  const credentials = override ?? resolveCredentials().credentials;
  if (!credentials) {
    throw new Error(
      "Credenciais do Bitbucket ausentes: configure em Configuração → Integrações ou defina BITBUCKET_WORKSPACE, BITBUCKET_EMAIL e BITBUCKET_API_TOKEN",
    );
  }
  const { workspace, email, apiToken } = credentials;
  const basic = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return { workspace, authorization: `Basic ${basic}` };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type BitbucketCallHooks = {
  onResponse?: (status: number) => void;
};

type FetchJsonOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  maxAttempts?: number; // default: 3
  timeoutMs?: number; // default: 10s
  hooks?: BitbucketCallHooks;
  credentials?: BitbucketCredentials;
};

export async function bitbucketFetchJson<T>(
  urlOrPath: string,
  schema: z.ZodType<T>,
  opts: FetchJsonOptions = {},
): Promise<T> {
  const { authorization } = getAuth(opts.credentials);
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : `${BITBUCKET_API_BASE}${urlOrPath}`;

  const maxAttempts = opts.maxAttempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  let lastErr: unknown = undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    requestsCounter.add();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signal = opts.signal
      ? AbortSignal.any([opts.signal, controller.signal])
      : controller.signal;

    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        ...(opts.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal,
    }).finally(() => clearTimeout(timeoutId));

    opts.hooks?.onResponse?.(res.status);

    if (res.ok) {
      const json = await res.json();
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new Error(
          `Resposta inesperada do Bitbucket (${url}): ${parsed.error.message}`,
        );
      }
      return parsed.data;
    }

    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSeconds =
      retryAfterHeader && /^\d+$/.test(retryAfterHeader)
        ? Number(retryAfterHeader)
        : undefined;

    const err = new BitbucketHttpError(`Bitbucket retornou ${res.status}`, {
      status: res.status,
      url,
      retryAfterSeconds,
    });
    lastErr = err;

    const isRetryable =
      res.status === 429 || (res.status >= 500 && res.status <= 599);
    if (!isRetryable || attempt === maxAttempts) break;

    const backoffSeconds = Math.pow(2, attempt - 1); // 1s, 2s, 4s
    const waitMs = Math.max(
      backoffSeconds * 1000,
      (retryAfterSeconds ?? 0) * 1000,
    );
    await sleep(waitMs);
  }

  throw lastErr instanceof Error ? lastErr : new Error("Falha ao chamar Bitbucket");
}

export async function fetchAllPages<T>(
  firstUrlOrPath: string,
  pageSchema: z.ZodType<{ values: T[]; next?: string }>,
  opts: { maxPages?: number; hooks?: BitbucketCallHooks } = {},
): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = firstUrlOrPath;
  let pages = 0;
  const maxPages = opts.maxPages ?? 20;

  while (next) {
    pages++;
    if (pages > maxPages) {
      throw new Error(
        `Paginação excedeu o limite de segurança (${maxPages} páginas)`,
      );
    }
    const page: { values: T[]; next?: string } = await bitbucketFetchJson(
      next,
      pageSchema,
      { hooks: opts.hooks },
    );
    out.push(...page.values);
    next = page.next;
  }
  return out;
}

export async function mapLimit<I, O>(
  items: I[],
  limit: number,
  fn: (item: I, idx: number) => Promise<O>,
): Promise<O[]> {
  const results: O[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]!, idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

export function getWorkspaceFromEnv() {
  return getAuth().workspace;
}

/** Valida credenciais candidatas sem tocar nas que estão em uso. */
export async function checkCredentials(credentials: BitbucketCredentials) {
  const opts = { credentials, maxAttempts: 1 };
  await bitbucketFetchJson("/user?fields=uuid", z.object({ uuid: z.string() }), opts);
  await bitbucketFetchJson(
    `/repositories/${encodeURIComponent(credentials.workspace)}?pagelen=1&fields=values.uuid`,
    z.object({ values: z.array(z.unknown()) }),
    opts,
  );
}

const paginatedUnknownSchema = z.object({
  values: z.array(z.unknown()),
  next: z.string().url().optional(),
});

function parseItems<T>(what: string, items: unknown[], schema: z.ZodType<T>) {
  const out: T[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
    else console.warn(`[bitbucket] item inválido em ${what}:`, parsed.error.message);
  }
  return out;
}

export interface BitbucketClient {
  listRepositories(): Promise<z.infer<typeof bitbucketRepoSchema>[]>;
  listMembers(): Promise<z.infer<typeof bitbucketWorkspaceMemberSchema>[]>;
  listOpenPullRequests(
    repoSlug: string,
    authorUuids: string[],
    reviewerUuid?: string | null,
  ): Promise<z.infer<typeof bitbucketPullRequestSchema>[]>;
  getCurrentUser(): Promise<z.infer<typeof bitbucketUserSchema>>;
  getPullRequest(repoSlug: string, id: number): Promise<BitbucketPullRequestDetail>;
  setPullRequestReviewers(
    repoSlug: string,
    id: number,
    input: { title: string; reviewerUuids: string[] },
  ): Promise<void>;
  getDiffstatTotals(
    repoSlug: string,
    id: number,
  ): Promise<{ linesAdded: number; linesRemoved: number; filesChanged: number }>;
  listCommitStatuses(
    repoSlug: string,
    id: number,
  ): Promise<z.infer<typeof bitbucketCommitStatusSchema>[]>;
  listRecentComments(repoSlug: string, id: number, limit: number): Promise<BitbucketComment[]>;
}

function pullRequestPath(repoSlug: string, id: number) {
  const workspace = getWorkspaceFromEnv();
  return `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}/pullrequests/${id}`;
}

export function createBitbucketClient(hooks: BitbucketCallHooks = {}): BitbucketClient {
  return {
    async listRepositories() {
      const workspace = getWorkspaceFromEnv();
      const params = new URLSearchParams({
        role: "member",
        pagelen: "100",
        fields: "values.uuid,values.slug,values.name,next",
      });
      const first = `/repositories/${encodeURIComponent(workspace)}?${params.toString()}`;
      const rows = await fetchAllPages(first, paginatedUnknownSchema, { hooks });
      return parseItems("repositories", rows as unknown as unknown[], bitbucketRepoSchema);
    },

    async listMembers() {
      const workspace = getWorkspaceFromEnv();
      const params = new URLSearchParams({
        pagelen: "100",
        fields:
          "values.user.uuid,values.user.nickname,values.user.display_name,values.user.links.avatar.href,next",
      });
      const first = `/workspaces/${encodeURIComponent(workspace)}/members?${params.toString()}`;
      const rows = await fetchAllPages(first, paginatedUnknownSchema, { hooks });
      return parseItems("members", rows as unknown as unknown[], bitbucketWorkspaceMemberSchema);
    },

    async listOpenPullRequests(
      repoSlug: string,
      authorUuids: string[],
      reviewerUuid?: string | null,
    ) {
      const workspace = getWorkspaceFromEnv();
      const qBatches = buildOpenPrQueryBatches(authorUuids, 25, reviewerUuid);
      const queries = qBatches.length ? qBatches : [`state="OPEN"`];

      const all: z.infer<typeof bitbucketPullRequestSchema>[] = [];
      for (const q of queries) {
        const params = new URLSearchParams({
          q,
          pagelen: "50",
          fields: [
            "values.id",
            "values.title",
            "values.links.html",
            "values.author",
            "values.created_on",
            "values.updated_on",
            "values.participants",
            "values.reviewers.uuid",
            "values.reviewers.display_name",
            "values.reviewers.nickname",
            "values.reviewers.links.avatar.href",
            "values.comment_count",
            "values.task_count",
            "values.source.branch.name",
            "values.destination.branch.name",
            "next",
          ].join(","),
        });
        const first = `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}/pullrequests?${params.toString()}`;
        const rows = await fetchAllPages(first, paginatedUnknownSchema, { hooks });
        all.push(
          ...parseItems(
            `pullrequests(${repoSlug})`,
            rows as unknown as unknown[],
            bitbucketPullRequestSchema,
          ),
        );
      }

      const byId = new Map<number, z.infer<typeof bitbucketPullRequestSchema>>();
      for (const pr of all) byId.set(pr.id, pr);
      return [...byId.values()];
    },

    async getCurrentUser() {
      const params = new URLSearchParams({
        fields: "uuid,nickname,display_name,links.avatar.href",
      });
      return await bitbucketFetchJson(`/user?${params.toString()}`, bitbucketUserSchema, {
        hooks,
      });
    },

    async getPullRequest(repoSlug: string, id: number) {
      const params = new URLSearchParams({
        fields: "id,title,updated_on,summary.raw,reviewers.uuid",
      });
      return await bitbucketFetchJson(
        `${pullRequestPath(repoSlug, id)}?${params.toString()}`,
        bitbucketPullRequestDetailSchema,
        { hooks },
      );
    },

    async setPullRequestReviewers(repoSlug, id, input) {
      await bitbucketFetchJson(
        `${pullRequestPath(repoSlug, id)}?fields=id`,
        z.object({ id: z.number() }),
        {
          hooks,
          method: "PUT",
          maxAttempts: 1,
          body: {
            title: input.title,
            reviewers: input.reviewerUuids.map((uuid) => ({ uuid })),
          },
        },
      );
    },

    async getDiffstatTotals(repoSlug: string, id: number) {
      const params = new URLSearchParams({
        pagelen: "500",
        fields: "values.lines_added,values.lines_removed,next",
      });
      const rows = await fetchAllPages(
        `${pullRequestPath(repoSlug, id)}/diffstat?${params.toString()}`,
        paginatedUnknownSchema,
        { hooks, maxPages: 10 },
      );
      const files = parseItems(`diffstat(${repoSlug}#${id})`, rows, bitbucketDiffstatSchema);
      let linesAdded = 0;
      let linesRemoved = 0;
      for (const f of files) {
        linesAdded += f.lines_added ?? 0;
        linesRemoved += f.lines_removed ?? 0;
      }
      return { linesAdded, linesRemoved, filesChanged: files.length };
    },

    async listCommitStatuses(repoSlug: string, id: number) {
      const params = new URLSearchParams({
        pagelen: "50",
        fields: "values.state,values.name,values.url,next",
      });
      const rows = await fetchAllPages(
        `${pullRequestPath(repoSlug, id)}/statuses?${params.toString()}`,
        paginatedUnknownSchema,
        { hooks, maxPages: 2 },
      );
      return parseItems(`statuses(${repoSlug}#${id})`, rows, bitbucketCommitStatusSchema);
    },

    async listRecentComments(repoSlug: string, id: number, limit: number) {
      const params = new URLSearchParams({
        pagelen: String(Math.min(Math.max(limit * 3, 10), 50)),
        sort: "-created_on",
        fields:
          "values.id,values.created_on,values.deleted,values.content.raw,values.user.uuid,values.user.display_name,values.user.nickname,values.user.links.avatar.href,values.inline.path,next",
      });
      const page = await bitbucketFetchJson(
        `${pullRequestPath(repoSlug, id)}/comments?${params.toString()}`,
        paginatedUnknownSchema,
        { hooks },
      );
      return parseItems(`comments(${repoSlug}#${id})`, page.values, bitbucketCommentSchema)
        .filter((c) => !c.deleted)
        .slice(0, limit);
    },
  };
}

