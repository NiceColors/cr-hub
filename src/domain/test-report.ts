import { formatDuration } from "@/domain/weekly-report";

export const TEST_OUTCOMES = ["pass", "partial", "fail"] as const;
export type TestOutcome = (typeof TEST_OUTCOMES)[number];

export const FINDING_KINDS = ["step", "error", "layout"] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const REVIEW_SCOPES = ["cr", "feature", "project", "page"] as const;
export type ReviewScope = (typeof REVIEW_SCOPES)[number];

/** Palavra usada no card, em minúsculas. */
export const SCOPE_LABEL: Record<ReviewScope, string> = {
  cr: "CR",
  feature: "feature",
  project: "projeto",
  page: "página",
};

export type ReportFinding = {
  kind: FindingKind;
  body: string;
};

export type ReportShot = {
  caption: string;
  /** Índice do achado em `findings`, quando o print ilustra aquele item. */
  findingIndex: number | null;
};

export type ReportSubjectLabel = {
  label: string;
};

export type TestReportDraft = {
  jiraKey: string | null;
  repoSlug: string;
  prId: number;
  outcome: TestOutcome;
  howTested: string;
  findings: ReportFinding[];
  shots: ReportShot[];
  /** Nulo quando a ficha não está ligada a uma revisão com cronômetro. */
  timeSpentMs: number | null;
  /** Ausente vale como revisão de um CR, para as fichas já existentes. */
  scope?: ReviewScope;
  scopeTitle?: string;
  /** Tipo do projeto da fila, quando a ficha revisa um projeto. */
  scopeLabel?: string;
  subjects?: ReportSubjectLabel[];
};

const OUTCOME_LABEL: Record<TestOutcome, string> = {
  pass: "passou",
  partial: "parcial",
  fail: "falhou",
};

const FAILURE_LABEL: Record<Exclude<FindingKind, "step">, string> = {
  error: "Erro",
  layout: "Layout",
};

export function cardLabel(input: Pick<TestReportDraft, "jiraKey" | "repoSlug" | "prId">) {
  return input.jiraKey ?? `${input.repoSlug} #${input.prId}`;
}

function filled(findings: ReportFinding[]) {
  return findings.flatMap((finding, index) => {
    const body = finding.body.trim();
    return body ? [{ ...finding, body, index }] : [];
  });
}

function printNumbersFor(shots: ReportShot[], findingIndex: number) {
  const numbers: number[] = [];
  shots.forEach((shot, index) => {
    if (shot.findingIndex === findingIndex) numbers.push(index + 1);
  });
  return numbers;
}

function evidenceRefs(numbers: number[]) {
  if (numbers.length === 0) return "";
  const label = numbers.length === 1 ? "evidência" : "evidências";
  const list =
    numbers.length === 1
      ? String(numbers[0])
      : `${numbers.slice(0, -1).join(", ")} e ${numbers[numbers.length - 1]}`;
  return ` (${label} ${list})`;
}

export type ReportFailure = {
  kind: string;
  body: string;
  evidence: string;
};

export type ReportEvidence = {
  number: number;
  caption: string;
};

/** O registro completo que entra no card, na mesma ordem do comentário. */
export function describeTestReport(draft: TestReportDraft) {
  const findings = filled(draft.findings);
  const linked = (index: number) => evidenceRefs(printNumbersFor(draft.shots, index));
  const scope = draft.scope ?? "cr";
  const coverage =
    scope === "cr" ? null : (draft.subjects ?? []).map((subject) => subject.label);
  return {
    title:
      scope === "cr"
        ? `Teste · ${cardLabel(draft)}`
        : `Teste · ${(draft.scopeTitle ?? "").trim() || "Sem nome"}`,
    scopeLabel: scope === "cr" ? null : (draft.scopeLabel ?? SCOPE_LABEL[scope]),
    coverage,
    outcome: OUTCOME_LABEL[draft.outcome],
    time: draft.timeSpentMs === null ? "sem cronômetro" : formatDuration(draft.timeSpentMs),
    howTested: draft.howTested.trim() || "Não descrito.",
    steps: findings
      .filter((finding) => finding.kind === "step")
      .map((step) => `${step.body}${linked(step.index)}`),
    failures: findings
      .filter((finding): finding is (typeof findings)[number] & { kind: "error" | "layout" } =>
        finding.kind !== "step",
      )
      .map(
        (failure): ReportFailure => ({
          kind: FAILURE_LABEL[failure.kind],
          body: failure.body,
          evidence: linked(failure.index),
        }),
      ),
    evidence: draft.shots.map(
      (shot, index): ReportEvidence => ({
        number: index + 1,
        caption: shot.caption.trim() || "Sem legenda",
      }),
    ),
  };
}

export function buildJiraComment(draft: TestReportDraft) {
  const report = describeTestReport(draft);
  const lines: string[] = [];
  lines.push(`## ${report.title}`);
  lines.push("");
  lines.push(`**Resultado:** ${report.outcome}`);
  lines.push(`**Tempo de revisão:** ${report.time}`);
  lines.push("");
  appendCoverage(lines, report);
  lines.push("### Como foi testado");
  lines.push("");
  lines.push(report.howTested);
  lines.push("");
  lines.push("### O que foi exercitado");
  lines.push("");
  if (report.steps.length === 0) {
    lines.push("Nenhum passo registrado.");
  } else {
    for (const step of report.steps) lines.push(`- ${step}`);
  }
  lines.push("");
  lines.push("### O que falhou");
  lines.push("");
  if (report.failures.length === 0) {
    lines.push("Nada falhou.");
  } else {
    report.failures.forEach((failure, order) => {
      lines.push(`${order + 1}. **${failure.kind}** — ${failure.body}${failure.evidence}`);
    });
  }
  lines.push("");
  lines.push("### Evidência");
  lines.push("");
  if (report.evidence.length === 0) {
    lines.push("Nenhuma evidência anexada.");
  } else {
    for (const shot of report.evidence) lines.push(`${shot.number}. ${shot.caption}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function appendCoverage(
  lines: string[],
  report: { scopeLabel: string | null; coverage: string[] | null },
) {
  if (!report.scopeLabel || !report.coverage) return;
  lines.push(`**Abrangência:** ${report.scopeLabel}`);
  lines.push("");
  lines.push("### CRs abrangidos");
  lines.push("");
  if (report.coverage.length === 0) lines.push("Nenhum CR vinculado.");
  else for (const line of report.coverage) lines.push(`- ${line}`);
  lines.push("");
}

export function buildKiroPrompt(draft: TestReportDraft) {
  const scope = draft.scope ?? "cr";
  const target =
    scope === "cr"
      ? `no card ${cardLabel(draft)}`
      : `sobre ${(draft.scopeTitle ?? "").trim() || "esta revisão"}`;
  const lines = [
    `Comente ${target} com o registro de teste abaixo. Não altere a descrição nem o status.`,
    "",
    '"""',
    buildJiraComment(draft).trimEnd(),
    '"""',
  ];
  if (draft.shots.length > 0) {
    lines.push("");
    lines.push("Cole as imagens da seção Evidência no comentário, nesta ordem:");
    draft.shots.forEach((shot, index) => {
      lines.push(`${index + 1}. ${shot.caption.trim() || "Sem legenda"}`);
    });
  }
  return `${lines.join("\n")}\n`;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function coverageHtml(report: { scopeLabel: string | null; coverage: string[] | null }) {
  if (!report.scopeLabel || !report.coverage) return "";
  const items =
    report.coverage.length === 0
      ? "<p>Nenhum CR vinculado.</p>"
      : `<ul>${report.coverage.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  return `<p><strong>Abrangência:</strong> ${escapeHtml(report.scopeLabel)}</p><h3>CRs abrangidos</h3>${items}`;
}

function paragraphs(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "<p>Não descrito.</p>";
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

/** HTML do mesmo comentário, com os prints embutidos, para colar no editor do Jira. */
export function buildJiraHtml(draft: TestReportDraft, dataUrls: string[]) {
  const report = describeTestReport(draft);
  const stepsHtml =
    report.steps.length === 0
      ? "<p>Nenhum passo registrado.</p>"
      : `<ul>${report.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>`;
  const failuresHtml =
    report.failures.length === 0
      ? "<p>Nada falhou.</p>"
      : `<ol>${report.failures
          .map(
            (failure) =>
              `<li><strong>${escapeHtml(failure.kind)}</strong> — ${escapeHtml(failure.body)}${escapeHtml(failure.evidence)}</li>`,
          )
          .join("")}</ol>`;
  const shotsHtml =
    report.evidence.length === 0
      ? "<p>Nenhuma evidência anexada.</p>"
      : report.evidence
          .map((shot) => {
            const src = dataUrls[shot.number - 1];
            const caption = `${shot.number}. ${shot.caption}`;
            const image = src
              ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" style="display:block;max-width:100%;height:auto" />`
              : "";
            return `<figure>${image}<figcaption>${escapeHtml(caption)}</figcaption></figure>`;
          })
          .join("");

  return [
    "<article>",
    `<h2>${escapeHtml(report.title)}</h2>`,
    `<p><strong>Resultado:</strong> ${escapeHtml(report.outcome)}</p>`,
    `<p><strong>Tempo de revisão:</strong> ${escapeHtml(report.time)}</p>`,
    coverageHtml(report),
    "<h3>Como foi testado</h3>",
    paragraphs(report.howTested),
    "<h3>O que foi exercitado</h3>",
    stepsHtml,
    "<h3>O que falhou</h3>",
    failuresHtml,
    "<h3>Evidência</h3>",
    shotsHtml,
    "</article>",
  ].join("");
}
