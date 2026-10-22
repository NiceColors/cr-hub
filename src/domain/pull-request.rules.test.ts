import { describe, expect, test } from "vitest";
import {
  aggregateBuildState,
  buildReviewers,
  classifyTargetBranch,
  computeAgeBand,
  computeSnoozeUntilMs,
  extractJiraKey,
  isAwaitingReviewBy,
  isReadyToMerge,
  isSnoozeActive,
  leastLoadedMembers,
  resolveSla,
  reviewLoadByMember,
  sizeBucket,
  targetPriority,
  type Reviewer,
  type Snooze,
} from "@/domain/pull-request";

const H = 60 * 60 * 1000;

function reviewer(uuid: string, patch: Partial<Reviewer> = {}): Reviewer {
  return { uuid, displayName: uuid, approved: false, changesRequested: false, ...patch };
}

function pr(patch: {
  author?: string;
  reviewers?: Reviewer[];
  snooze?: Snooze | null;
  updatedOn?: string;
  ageBand?: "normal" | "warning" | "critical";
}) {
  return {
    author: { uuid: patch.author ?? "{author}", displayName: "A" },
    reviewers: patch.reviewers ?? [],
    snooze: patch.snooze ?? null,
    updatedOn: patch.updatedOn ?? "2026-01-01T00:00:00Z",
    ageBand: patch.ageBand ?? ("normal" as const),
  };
}

describe("computeAgeBand com SLA do repositório", () => {
  test("usa os limites configurados", () => {
    const created = "2026-01-01T00:00:00Z";
    const sla = { warningHours: 4, criticalHours: 12 };
    expect(computeAgeBand(created, Date.parse(created) + 3 * H, sla)).toBe("normal");
    expect(computeAgeBand(created, Date.parse(created) + 4 * H, sla)).toBe("warning");
    expect(computeAgeBand(created, Date.parse(created) + 13 * H, sla)).toBe("critical");
  });

  test("resolveSla cai no padrão 24/72 quando nulo", () => {
    expect(resolveSla({ slaWarningHours: null, slaCriticalHours: 48 })).toEqual({
      warningHours: 24,
      criticalHours: 48,
    });
  });
});

describe("classifyTargetBranch / targetPriority", () => {
  test("classifica master, main, release e hotfix", () => {
    expect(classifyTargetBranch("master")).toBe("production");
    expect(classifyTargetBranch("main")).toBe("production");
    expect(classifyTargetBranch("release/1.2")).toBe("release");
    expect(classifyTargetBranch("hotfix/fix-login")).toBe("hotfix");
    expect(classifyTargetBranch("develop")).toBeNull();
    expect(classifyTargetBranch(null)).toBeNull();
  });

  test("hotfix vem antes de produção, release e o resto", () => {
    expect(targetPriority("hotfix")).toBeLessThan(targetPriority("production"));
    expect(targetPriority("production")).toBeLessThan(targetPriority("release"));
    expect(targetPriority("release")).toBeLessThan(targetPriority(null));
  });
});

describe("extractJiraKey", () => {
  test("prefere a chave do título", () => {
    expect(extractJiraKey("FUND-123 Ajusta taxa", "feature/FUND-999")).toBe("FUND-123");
  });

  test("cai para a branch, ignorando caixa", () => {
    expect(extractJiraKey("Ajusta taxa", "feature/fund-42-taxa")).toBe("FUND-42");
  });

  test("respeita a lista de projetos permitidos", () => {
    expect(extractJiraKey("Corrige UTF-8 no FUND-7", null, ["FUND"])).toBe("FUND-7");
    expect(extractJiraKey("Corrige UTF-8", null, ["FUND"])).toBeNull();
  });
});

describe("snooze", () => {
  const base = { reason: "deploy", createdAt: "2026-01-01T00:00:00Z" };

  test("por tempo vence no untilMs", () => {
    const s: Snooze = { ...base, kind: "24h", untilMs: 1000, untilUpdatedOn: null };
    expect(isSnoozeActive(s, "x", 999)).toBe(true);
    expect(isSnoozeActive(s, "x", 1000)).toBe(false);
  });

  test("até o PR mudar vence quando updatedOn muda", () => {
    const s: Snooze = { ...base, kind: "until_change", untilMs: null, untilUpdatedOn: "v1" };
    expect(isSnoozeActive(s, "v1", 0)).toBe(true);
    expect(isSnoozeActive(s, "v2", 0)).toBe(false);
  });

  test("até amanhã vence às 09:00 do dia seguinte (fuso local)", () => {
    const now = new Date(2026, 0, 10, 15, 30).getTime();
    expect(computeSnoozeUntilMs("tomorrow", now)).toBe(new Date(2026, 0, 11, 9, 0).getTime());
    expect(computeSnoozeUntilMs("24h", now)).toBe(now + 24 * H);
    expect(computeSnoozeUntilMs("until_change", now)).toBeNull();
  });
});

describe("isAwaitingReviewBy", () => {
  test("revisor que ainda não aprovou", () => {
    expect(isAwaitingReviewBy(pr({ reviewers: [reviewer("{me}")] }), "{me}", 0)).toBe(true);
  });

  test("não conta se já aprovou ou pediu mudança", () => {
    expect(
      isAwaitingReviewBy(pr({ reviewers: [reviewer("{me}", { approved: true })] }), "{me}", 0),
    ).toBe(false);
    expect(
      isAwaitingReviewBy(
        pr({ reviewers: [reviewer("{me}", { changesRequested: true })] }),
        "{me}",
        0,
      ),
    ).toBe(false);
  });

  test("não conta o próprio PR nem PR silenciado", () => {
    expect(
      isAwaitingReviewBy(pr({ author: "{me}", reviewers: [reviewer("{me}")] }), "{me}", 0),
    ).toBe(false);
    const snooze: Snooze = {
      reason: "x",
      kind: "24h",
      untilMs: 10,
      untilUpdatedOn: null,
      createdAt: "",
    };
    expect(isAwaitingReviewBy(pr({ reviewers: [reviewer("{me}")], snooze }), "{me}", 5)).toBe(
      false,
    );
  });
});

describe("buildReviewers", () => {
  test("cruza revisores com o estado dos participantes", () => {
    const out = buildReviewers(
      [
        { uuid: "{a}", displayName: "A" },
        { uuid: "{b}", displayName: "B" },
      ],
      [
        { userUuid: "{a}", approved: true, state: "approved" },
        { userUuid: "{b}", approved: false, state: "changes_requested" },
      ],
    );
    expect(out.map((r) => [r.approved, r.changesRequested])).toEqual([
      [true, false],
      [false, true],
    ]);
  });
});

describe("reviewLoadByMember / leastLoadedMembers", () => {
  test("conta pendências e atrasos por revisor", () => {
    const load = reviewLoadByMember([
      pr({ reviewers: [reviewer("{a}"), reviewer("{b}", { approved: true })] }),
      pr({ reviewers: [reviewer("{a}")], ageBand: "critical" }),
    ]);
    expect(load.get("{a}")).toEqual({ pending: 2, overdue: 1, authored: 0 });
    expect(load.get("{b}")).toBeUndefined();
    expect(load.get("{author}")?.authored).toBe(2);
    expect(leastLoadedMembers(["{a}", "{b}"], load)).toEqual(["{b}"]);
  });
});

describe("sizeBucket / build / pronto para merge", () => {
  test("faixas P/M/G/GG", () => {
    expect(sizeBucket(50)).toBe("P");
    expect(sizeBucket(51)).toBe("M");
    expect(sizeBucket(1000)).toBe("G");
    expect(sizeBucket(1001)).toBe("GG");
  });

  test("agrega o build com falha > em andamento > sucesso", () => {
    expect(aggregateBuildState([])).toBe("none");
    expect(aggregateBuildState(["SUCCESSFUL", "INPROGRESS"])).toBe("in_progress");
    expect(aggregateBuildState(["SUCCESSFUL", "FAILED", "INPROGRESS"])).toBe("failed");
    expect(aggregateBuildState(["SUCCESSFUL"])).toBe("successful");
  });

  test("aprovado sem tarefas e sem falha de build", () => {
    expect(isReadyToMerge({ reviewState: "approved", taskCount: 0 }, "successful")).toBe(true);
    expect(isReadyToMerge({ reviewState: "approved", taskCount: 0 }, undefined)).toBe(true);
    expect(isReadyToMerge({ reviewState: "approved", taskCount: 2 }, "successful")).toBe(false);
    expect(isReadyToMerge({ reviewState: "approved", taskCount: 0 }, "failed")).toBe(false);
    expect(isReadyToMerge({ reviewState: "in_review", taskCount: 0 }, "successful")).toBe(false);
  });
});
