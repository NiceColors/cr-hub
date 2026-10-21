import { z } from "zod";
import { requestsCounter } from "@/lib/requestsCounter";

const BITBUCKET_API_BASE = "https://api.bitbucket.org/2.0";

export class BitbucketHttpError extends Error {
  status: number;
  retryAfterSeconds?: number;
  url: string;

  constructor(message: string, opts: { status: number; url: string; retryAfterSeconds?: number }) {
    super(message);
    this.name = "BitbucketHttpError";
    this.status = opts.status;
    this.url = opts.url;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

function getAuthHeader() {
  const workspace = process.env.BITBUCKET_WORKSPACE;
  const email = process.env.BITBUCKET_EMAIL;
  const token = process.env.BITBUCKET_API_TOKEN;
  if (!workspace || !email || !token) {
    throw new Error(
      "Variáveis ausentes: BITBUCKET_WORKSPACE, BITBUCKET_EMAIL, BITBUCKET_API_TOKEN",
    );
  }
  const basic = Buffer.from(`${email}:${token}`).toString("base64");
  return { workspace, authorization: `Basic ${basic}` };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type FetchJsonOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  signal?: AbortSignal;
  maxAttempts?: number;
  backoffBaseMs?: number;
};

export async function bitbucketFetchJson<T>(
  urlOrPath: string,
  schema: z.ZodType<T>,
  opts: FetchJsonOptions = {},
): Promise<T> {
  const { authorization } = getAuthHeader();
  const url = urlOrPath.startsWith("http") ? urlOrPath : `${BITBUCKET_API_BASE}${urlOrPath}`;

  const maxAttempts = opts.maxAttempts ?? 5;
  const backoffBaseMs = opts.backoffBaseMs ?? 500;

  let lastErr: unknown = undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    requestsCounter.add();

    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
      signal: opts.signal,
    });

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

    const message = `Bitbucket retornou ${res.status} (${url})`;
    const err = new BitbucketHttpError(message, {
      status: res.status,
      url,
      retryAfterSeconds,
    });
    lastErr = err;

    const isRetryable =
      res.status === 429 || (res.status >= 500 && res.status <= 599);
    if (!isRetryable || attempt === maxAttempts) break;

    const exp = backoffBaseMs * Math.pow(2, attempt - 1);
    const waitMs = Math.max(exp, (retryAfterSeconds ?? 0) * 1000);
    await sleep(waitMs);
  }

  throw lastErr instanceof Error ? lastErr : new Error("Falha ao chamar Bitbucket");
}

export async function fetchAllPages<T>(
  firstUrlOrPath: string,
  pageSchema: z.ZodType<{ values: T[]; next?: string }>,
): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = firstUrlOrPath;
  while (next) {
    const page: { values: T[]; next?: string } = await bitbucketFetchJson(
      next,
      pageSchema,
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
  return getAuthHeader().workspace;
}

