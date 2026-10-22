import {
  computeAgeBand,
  isAwaitingReviewBy,
  isSnoozeActive,
  prKey,
  type PullRequest,
} from "@/domain/pull-request";

export type NotificationType =
  | "review_requested"
  | "sla_critical"
  | "my_pr_approved"
  | "my_pr_changes_requested";

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "review_requested",
  "sla_critical",
  "my_pr_approved",
  "my_pr_changes_requested",
];

export type AttentionPr = Pick<
  PullRequest,
  | "id"
  | "title"
  | "url"
  | "repository"
  | "author"
  | "reviewers"
  | "createdOn"
  | "updatedOn"
  | "sla"
  | "reviewState"
  | "snooze"
>;

export type AttentionEntry = {
  awaitingMe: boolean;
  critical: boolean;
  approved: boolean;
  changesRequested: boolean;
};

export type AttentionSnapshot = Record<string, AttentionEntry>;

export type AttentionEvent = {
  id: string;
  type: NotificationType;
  key: string;
  title: string;
  body: string;
  url: string;
};

function isRelevantToMe(pr: AttentionPr, meUuid: string) {
  return pr.author.uuid === meUuid || pr.reviewers.some((r) => r.uuid === meUuid);
}

export function buildAttentionSnapshot(
  prs: AttentionPr[],
  meUuid: string,
  nowMs: number,
): AttentionSnapshot {
  const out: AttentionSnapshot = {};
  for (const pr of prs) {
    out[prKey(pr.repository.uuid, pr.id)] = {
      awaitingMe: isAwaitingReviewBy(pr, meUuid, nowMs),
      critical: computeAgeBand(pr.createdOn, nowMs, pr.sla) === "critical",
      approved: pr.reviewState === "approved",
      changesRequested: pr.reviewState === "changes_requested",
    };
  }
  return out;
}

const LABELS: Record<NotificationType, (pr: AttentionPr) => string> = {
  review_requested: (pr) => `${pr.author.displayName} pediu sua revisão`,
  sla_critical: (pr) => `PR passou de ${pr.sla.criticalHours}h sem merge`,
  my_pr_approved: () => "Seu PR foi aprovado",
  my_pr_changes_requested: () => "Pediram mudanças no seu PR",
};

/**
 * Compara dois retratos e devolve só os eventos de transição ainda não enviados.
 * Sem retrato anterior (primeira execução) não há transição: nada é disparado.
 */
export function detectTransitions(opts: {
  prev: AttentionSnapshot | null;
  next: AttentionSnapshot;
  prs: AttentionPr[];
  meUuid: string;
  nowMs: number;
  sent: ReadonlySet<string>;
  enabled: Record<NotificationType, boolean>;
}): AttentionEvent[] {
  const { prev, next, prs, meUuid, nowMs, sent, enabled } = opts;
  if (!prev) return [];

  const events: AttentionEvent[] = [];
  for (const pr of prs) {
    const key = prKey(pr.repository.uuid, pr.id);
    const now = next[key];
    if (!now || isSnoozeActive(pr.snooze, pr.updatedOn, nowMs)) continue;
    const before = prev[key];
    const mine = pr.author.uuid === meUuid;

    const candidates: NotificationType[] = [];
    if (now.awaitingMe && !before?.awaitingMe) candidates.push("review_requested");
    if (now.critical && before && !before.critical && isRelevantToMe(pr, meUuid)) {
      candidates.push("sla_critical");
    }
    if (mine && now.approved && before && !before.approved) candidates.push("my_pr_approved");
    if (mine && now.changesRequested && before && !before.changesRequested) {
      candidates.push("my_pr_changes_requested");
    }

    for (const type of candidates) {
      const id = `${type}:${key}`;
      if (!enabled[type] || sent.has(id)) continue;
      events.push({
        id,
        type,
        key,
        title: LABELS[type](pr),
        body: `${pr.repository.slug} #${pr.id} · ${pr.title}`,
        url: pr.url,
      });
    }
  }
  return events;
}

/** Mantém só os ids de eventos cujos PRs ainda estão abertos, para o conjunto não crescer sem limite. */
export function pruneSent(sent: Iterable<string>, openKeys: ReadonlySet<string>) {
  const out: string[] = [];
  for (const id of sent) {
    const key = id.slice(id.indexOf(":") + 1);
    if (openKeys.has(key)) out.push(id);
  }
  return out;
}
