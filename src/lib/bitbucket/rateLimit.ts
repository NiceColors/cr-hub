/**
 * Bitbucket Cloud permite 1000 requisições autenticadas por hora.
 * O orçamento fica abaixo disso para sobrar detalhe, insights e ações manuais.
 * A listagem usa só uma fatia, senão um poll de 30s em dezenas de repositórios
 * estoura o limite e o fim da fila (cr-lab-*) volta 429.
 */
export const BITBUCKET_HOURLY_BUDGET = 800;
export const LIST_REQUESTS_PER_HOUR = 500;

/** Espera curta o bastante para um retry dentro da mesma chamada. */
export const SHORT_RETRY_SECONDS = 2;

/** Quando o 429 não traz Retry-After, espera isto antes de tentar de novo. */
export const DEFAULT_RETRY_AFTER_SECONDS = 60;

declare global {
  // eslint-disable-next-line no-var
  var __crTrackerRateLimitUntilMs: number | undefined;
}

export function clearBitbucketRateLimit() {
  globalThis.__crTrackerRateLimitUntilMs = undefined;
}

export function getRateLimitRemainingSeconds(nowMs = Date.now()) {
  const until = globalThis.__crTrackerRateLimitUntilMs;
  if (!until) return 0;
  return Math.max(0, Math.ceil((until - nowMs) / 1000));
}

export function setRateLimitUntilSecondsFromNow(seconds: number, nowMs = Date.now()) {
  const until = nowMs + Math.max(0, seconds) * 1000;
  const current = globalThis.__crTrackerRateLimitUntilMs ?? 0;
  if (until > current) globalThis.__crTrackerRateLimitUntilMs = until;
}

/** `Retry-After` pode ser delta em segundos ou data HTTP. */
export function parseRetryAfter(header: string | null, nowMs = Date.now()): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return undefined;
  return Math.max(0, Math.ceil((dateMs - nowMs) / 1000));
}

export function retryAfterSeconds(header: string | null, nowMs = Date.now()) {
  return parseRetryAfter(header, nowMs) ?? DEFAULT_RETRY_AFTER_SECONDS;
}

/**
 * Quantos repositórios atualizar neste ciclo sem passar do orçamento horário.
 * `requestsLastHour` inclui insights e as outras chamadas do processo.
 */
export function reposToRefreshThisPoll(opts: {
  pollIntervalSeconds: number;
  requestsLastHour: number;
  repoCount: number;
  force?: boolean;
}) {
  const pollsPerHour = Math.max(1, Math.floor(3600 / Math.max(1, opts.pollIntervalSeconds)));
  const steady = Math.max(1, Math.floor(LIST_REQUESTS_PER_HOUR / pollsPerHour));
  const wanted = Math.min(opts.repoCount, opts.force ? steady * 2 : steady);
  const headroom = BITBUCKET_HOURLY_BUDGET - opts.requestsLastHour;
  if (headroom <= 0) return opts.force ? 0 : Math.min(1, opts.repoCount);
  return Math.min(wanted, headroom);
}

/** Mais antigos primeiro; quem nunca foi consultado vem na frente. */
export function pickReposToRefresh<T extends { uuid: string }>(
  repos: T[],
  fetchedAtMsByUuid: Map<string, number>,
  budget: number,
) {
  if (budget <= 0) return [];
  return [...repos]
    .sort((a, b) => {
      const age = (fetchedAtMsByUuid.get(a.uuid) ?? 0) - (fetchedAtMsByUuid.get(b.uuid) ?? 0);
      if (age !== 0) return age;
      return a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0;
    })
    .slice(0, budget);
}
