import { describe, expect, test } from "vitest";
import { dayBuckets, type HistoryRow } from "@/domain/dashboard";
import {
  buildPeopleLoad,
  buildProjectProgress,
  buildTeamHealth,
  countRisks,
  deliveryFunnel,
  healthStatus,
  prRisks,
  rankAttention,
  riskScore,
  worstSeverity,
  type RiskInput,
  type RiskKind,
} from "@/domain/lead";

const HOUR = 60 * 60 * 1000;
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).getTime();
const NOW = at(25);

function risk(partial: Partial<RiskInput> = {}): RiskInput {
  return {
    ageBand: "normal",
    reviewers: [{}],
    reviewState: "waiting",
    updatedOn: new Date(NOW - HOUR).toISOString(),
    approvedAt: null,
    changesCycles: 0,
    build: null,
    size: null,
    ...partial,
  };
}

function row(prKey: string, partial: Partial<HistoryRow> & { createdDay: number }): HistoryRow {
  const { createdDay, ...rest } = partial;
  return {
    prKey,
    repoUuid: "r1",
    authorUuid: "a1",
    createdOn: new Date(at(createdDay)).toISOString(),
    firstSeenAt: at(createdDay),
    firstReviewAt: null,
    approvedAt: null,
    closedAt: null,
    changesCycles: 0,
    ...rest,
  };
}

describe("prRisks", () => {
  test("PR recente, com revisor e sem histórico ruim não tem risco", () => {
    expect(prRisks(risk(), NOW)).toEqual([]);
  });

  test("SLA crítico e atenção são exclusivos", () => {
    expect(prRisks(risk({ ageBand: "critical" }), NOW)).toEqual(["sla_critical"]);
    expect(prRisks(risk({ ageBand: "warning" }), NOW)).toEqual(["sla_warning"]);
  });

  test("devolve os sinais na ordem de gravidade", () => {
    const risks = prRisks(
      risk({
        ageBand: "warning",
        reviewers: [],
        build: "failed",
        size: "GG",
        changesCycles: 2,
        updatedOn: new Date(NOW - 49 * HOUR).toISOString(),
      }),
      NOW,
    );
    expect(risks).toEqual(["build_failed", "sla_warning", "no_reviewers", "changes_loop", "stale", "large"]);
  });

  test("aprovado parado só depois de 24h da aprovação", () => {
    const approved = { reviewState: "approved" as const };
    expect(prRisks(risk({ ...approved, approvedAt: NOW - 23 * HOUR }), NOW)).toEqual([]);
    expect(prRisks(risk({ ...approved, approvedAt: NOW - 24 * HOUR }), NOW)).toEqual(["approved_not_merged"]);
    expect(prRisks(risk({ ...approved, approvedAt: null }), NOW)).toEqual([]);
  });
});

describe("riskScore e worstSeverity", () => {
  test("crítico pesa mais que vários sinais de atenção", () => {
    expect(riskScore(["sla_critical"])).toBeGreaterThan(riskScore(["stale", "no_reviewers", "changes_loop"]));
    expect(worstSeverity(["large"])).toBe("info");
    expect(worstSeverity(["large", "stale"])).toBe("warning");
    expect(worstSeverity(["stale", "build_failed"])).toBe("critical");
    expect(worstSeverity([])).toBeNull();
  });
});

describe("rankAttention", () => {
  const pr = (id: string, risks: RiskKind[], createdDay: number, snoozed = false) => ({
    id,
    risks,
    snoozed,
    createdOn: new Date(at(createdDay)).toISOString(),
  });

  test("ignora silenciados e PRs só com sinal informativo; ordena por gravidade e idade", () => {
    const ranked = rankAttention([
      pr("info", ["large"], 1),
      pr("snoozed", ["sla_critical"], 1, true),
      pr("warn-new", ["stale"], 20),
      pr("warn-old", ["stale"], 10),
      pr("crit", ["sla_critical"], 22),
    ]);
    expect(ranked.map((p) => p.id)).toEqual(["crit", "warn-old", "warn-new"]);
  });

  test("respeita o limite", () => {
    const many = Array.from({ length: 5 }, (_, i) => pr(String(i), ["stale"], i + 1));
    expect(rankAttention(many, 2)).toHaveLength(2);
  });
});

describe("healthStatus", () => {
  test("fila vazia é saudável", () => {
    expect(healthStatus({ open: 0, critical: 0, flagged: 0 })).toBe("ok");
  });
  test("um crítico sozinho é atenção; dois ou mais é crítico", () => {
    expect(healthStatus({ open: 1, critical: 1, flagged: 1 })).toBe("attention");
    expect(healthStatus({ open: 10, critical: 2, flagged: 2 })).toBe("critical");
    expect(healthStatus({ open: 20, critical: 5, flagged: 5 })).toBe("critical");
  });
  test("sinal de atenção sem crítico é atenção", () => {
    expect(healthStatus({ open: 5, critical: 0, flagged: 1 })).toBe("attention");
    expect(healthStatus({ open: 5, critical: 0, flagged: 0 })).toBe("ok");
  });
});

describe("countRisks", () => {
  test("conta cada sinal e os PRs que pedem ação", () => {
    const counts = countRisks([
      { risks: ["sla_critical", "no_reviewers"] },
      { risks: ["large"] },
      { risks: ["approved_not_merged", "stale"] },
    ]);
    expect(counts).toMatchObject({
      open: 3,
      critical: 1,
      noReviewers: 1,
      approvedIdle: 1,
      stale: 1,
      flagged: 2,
    });
  });
});

describe("buildTeamHealth", () => {
  test("usa o retrato ao vivo para o status e o histórico para as séries", () => {
    const rows = [row("a", { createdDay: 23, closedAt: at(24) }), row("b", { createdDay: 24 })];
    const buckets = dayBuckets(at(23), NOW, 7);
    const health = buildTeamHealth(
      { id: 1, name: "Core", memberUuids: ["a1"] },
      [{ risks: ["sla_critical"] }, { risks: ["sla_critical"] }],
      rows,
      buckets,
      new Map(),
    );
    expect(health.status).toBe("critical");
    expect(health.daily.map((d) => d.open)).toEqual([1, 1, 2]);
    expect(health.daily.map((d) => d.status)).toEqual(["ok", "ok", "critical"]);
    expect(health.closed).toEqual([0, 1, 0]);
    expect(health.stats.closed).toBe(1);
  });
});

describe("deliveryFunnel", () => {
  test("conta só PRs abertos na janela e trata concluídos como revisados e aprovados", () => {
    const rows = [
      row("old", { createdDay: 1, closedAt: at(20) }),
      row("closed", { createdDay: 20, closedAt: at(21) }),
      row("approved", { createdDay: 20, firstReviewAt: at(21), approvedAt: at(22) }),
      row("reviewed", { createdDay: 21, firstReviewAt: at(22) }),
      row("waiting", { createdDay: 22 }),
    ];
    expect(deliveryFunnel(rows, at(18), NOW)).toEqual({ opened: 4, reviewed: 3, approved: 2, closed: 1 });
  });
});

describe("buildProjectProgress", () => {
  const link = (prKey: string) => ({
    prKey,
    title: `PR ${prKey}`,
    url: `https://x/${prKey}`,
    repoSlug: "app",
    authorName: "Ana",
    addedAt: at(1),
  });

  test("calcula progresso, risco agregado e linha do tempo", () => {
    const rows = [
      row("a", { createdDay: 10, firstReviewAt: at(11), approvedAt: at(12), closedAt: at(13) }),
      row("b", { createdDay: 20 }),
    ];
    const [project] = buildProjectProgress(
      [
        {
          id: 1,
          name: "Checkout",
          kind: "feature",
          status: "active",
          createdAt: at(1),
          updatedAt: at(1),
          links: [link("a"), link("b"), link("c")],
        },
      ],
      rows,
      new Map([["b", ["sla_critical"] as RiskKind[]]]),
      dayBuckets(at(10), NOW, 30),
      { scoped: false, nowMs: NOW },
    );
    expect(project!.progress).toBe(0.5);
    expect(project!.flagged).toBe(1);
    expect(project!.worst).toBe("critical");
    expect(project!.pullRequests[0]!.prKey).toBe("b");
    expect(project!.pullRequests.find((p) => p.prKey === "c")!.stage).toBe("untracked");
    expect(project!.timeline[0]).toMatchObject({ kind: "opened", prKey: "b" });
    expect(project!.timeline).toHaveLength(5);
    expect(project!.idle).toBe(false);
  });

  test("projeto ativo com CR aberto e sem atividade há 5 dias fica parado", () => {
    const [project] = buildProjectProgress(
      [
        {
          id: 1,
          name: "Antigo",
          kind: "project",
          status: "active",
          createdAt: at(1),
          updatedAt: at(1),
          links: [link("x")],
        },
      ],
      [row("x", { createdDay: 15 })],
      new Map(),
      dayBuckets(at(15), NOW, 30),
      { scoped: false, nowMs: NOW },
    );
    expect(project!.idle).toBe(true);
  });
});

describe("buildPeopleLoad", () => {
  test("soma carga de revisão e PRs próprios em risco, com quem está atrasado primeiro", () => {
    const reviewer = (uuid: string) => ({
      uuid,
      displayName: uuid,
      approved: false,
      changesRequested: false,
    });
    const people = buildPeopleLoad(
      [
        {
          author: { uuid: "ana", displayName: "Ana" },
          reviewers: [reviewer("bia")],
          ageBand: "critical",
          risks: ["sla_critical"],
        },
        {
          author: { uuid: "bia", displayName: "Bia" },
          reviewers: [reviewer("ana")],
          ageBand: "normal",
          risks: [],
        },
      ],
      [
        { uuid: "ana", displayName: "Ana", avatarUrl: null },
        { uuid: "bia", displayName: "Bia", avatarUrl: null },
      ],
    );
    expect(people.map((p) => p.uuid)).toEqual(["bia", "ana"]);
    expect(people[0]).toMatchObject({ pending: 1, overdue: 1, authored: 1, authoredFlagged: 0 });
    expect(people[1]).toMatchObject({ pending: 1, overdue: 0, authored: 1, authoredFlagged: 1 });
  });
});
