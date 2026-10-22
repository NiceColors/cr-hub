import { describe, expect, test } from "vitest";
import {
  buildAttentionSnapshot,
  detectTransitions,
  pruneSent,
  type AttentionPr,
  type NotificationType,
} from "@/domain/attention";

const ALL: Record<NotificationType, boolean> = {
  review_requested: true,
  sla_critical: true,
  my_pr_approved: true,
  my_pr_changes_requested: true,
};

const NOW = Date.parse("2026-01-10T12:00:00Z");

function pr(patch: Partial<AttentionPr> & { id: number }): AttentionPr {
  return {
    title: "PR",
    url: "https://bitbucket.org/x",
    repository: { uuid: "{r}", slug: "repo", name: "Repo" },
    author: { uuid: "{author}", displayName: "Autor" },
    reviewers: [],
    createdOn: "2026-01-10T00:00:00Z",
    updatedOn: "2026-01-10T00:00:00Z",
    sla: { warningHours: 24, criticalHours: 72 },
    reviewState: "waiting",
    snooze: null,
    ...patch,
  };
}

function run(prevPrs: AttentionPr[] | null, nextPrs: AttentionPr[], sent: string[] = []) {
  const prev = prevPrs ? buildAttentionSnapshot(prevPrs, "{me}", NOW) : null;
  const next = buildAttentionSnapshot(nextPrs, "{me}", NOW);
  return detectTransitions({
    prev,
    next,
    prs: nextPrs,
    meUuid: "{me}",
    nowMs: NOW,
    sent: new Set(sent),
    enabled: ALL,
  });
}

const me = { uuid: "{me}", displayName: "Eu", approved: false, changesRequested: false };

describe("detectTransitions", () => {
  test("primeira execução não dispara nada", () => {
    expect(run(null, [pr({ id: 1, reviewers: [me] })])).toEqual([]);
  });

  test("pedido de revisão novo dispara uma vez", () => {
    const events = run([pr({ id: 1 })], [pr({ id: 1, reviewers: [me] })]);
    expect(events.map((e) => e.id)).toEqual(["review_requested:{r}:1"]);
    expect(run([pr({ id: 1 })], [pr({ id: 1, reviewers: [me] })], ["review_requested:{r}:1"])).toEqual([]);
  });

  test("PR novo já com pedido de revisão também dispara", () => {
    expect(run([], [pr({ id: 2, reviewers: [me] })]).map((e) => e.type)).toEqual([
      "review_requested",
    ]);
  });

  test("meu PR aprovado e com mudanças pedidas", () => {
    const mine = { author: { uuid: "{me}", displayName: "Eu" } };
    expect(
      run([pr({ id: 3, ...mine })], [pr({ id: 3, ...mine, reviewState: "approved" })]).map(
        (e) => e.type,
      ),
    ).toEqual(["my_pr_approved"]);
    expect(
      run(
        [pr({ id: 3, ...mine })],
        [pr({ id: 3, ...mine, reviewState: "changes_requested" })],
      ).map((e) => e.type),
    ).toEqual(["my_pr_changes_requested"]);
  });

  test("passou do SLA crítico só se me envolve", () => {
    const old = "2026-01-06T00:00:00Z";
    const prevSnap = { "{r}:4": { awaitingMe: false, critical: false, approved: false, changesRequested: false } };
    const nextPrs = [pr({ id: 4, createdOn: old, reviewers: [{ ...me, approved: true }] })];
    const events = detectTransitions({
      prev: prevSnap,
      next: buildAttentionSnapshot(nextPrs, "{me}", NOW),
      prs: nextPrs,
      meUuid: "{me}",
      nowMs: NOW,
      sent: new Set(),
      enabled: ALL,
    });
    expect(events.map((e) => e.type)).toEqual(["sla_critical"]);

    const strangers = [pr({ id: 4, createdOn: old })];
    expect(
      detectTransitions({
        prev: prevSnap,
        next: buildAttentionSnapshot(strangers, "{me}", NOW),
        prs: strangers,
        meUuid: "{me}",
        nowMs: NOW,
        sent: new Set(),
        enabled: ALL,
      }),
    ).toEqual([]);
  });

  test("PR silenciado e tipo desligado não disparam", () => {
    const snooze = {
      reason: "deploy",
      kind: "24h" as const,
      untilMs: NOW + 1000,
      untilUpdatedOn: null,
      createdAt: "",
    };
    expect(run([pr({ id: 5 })], [pr({ id: 5, reviewers: [me], snooze })])).toEqual([]);
    const prev = buildAttentionSnapshot([pr({ id: 6 })], "{me}", NOW);
    const nextPrs = [pr({ id: 6, reviewers: [me] })];
    expect(
      detectTransitions({
        prev,
        next: buildAttentionSnapshot(nextPrs, "{me}", NOW),
        prs: nextPrs,
        meUuid: "{me}",
        nowMs: NOW,
        sent: new Set(),
        enabled: { ...ALL, review_requested: false },
      }),
    ).toEqual([]);
  });
});

describe("pruneSent", () => {
  test("descarta eventos de PRs que não estão mais abertos", () => {
    expect(
      pruneSent(["review_requested:{r}:1", "my_pr_approved:{r}:2"], new Set(["{r}:2"])),
    ).toEqual(["my_pr_approved:{r}:2"]);
  });
});
