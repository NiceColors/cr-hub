import { describe, expect, test } from "vitest";
import { buildJiraComment, buildJiraHtml, buildKiroPrompt, type TestReportDraft } from "@/domain/test-report";

const MINUTE = 60 * 1000;

function draft(patch: Partial<TestReportDraft> = {}): TestReportDraft {
  return {
    jiraKey: "FUND-123",
    repoSlug: "api",
    prId: 12,
    outcome: "pass",
    howTested: "Abri o checkout com um pedido de R$ 10.",
    findings: [{ kind: "step", body: "Confirmei o total na sacola" }],
    shots: [],
    timeSpentMs: 42 * MINUTE,
    ...patch,
  };
}

describe("buildJiraComment", () => {
  test("revisão que passou leva a chave e o tempo", () => {
    const markdown = buildJiraComment(draft());
    expect(markdown).toContain("## Teste · FUND-123");
    expect(markdown).toContain("**Resultado:** passou");
    expect(markdown).toContain("**Tempo de revisão:** 42min");
    expect(markdown).toContain("- Confirmei o total na sacola");
    expect(markdown).toContain("Nada falhou.");
  });

  test("parcial com erro de layout cita o print", () => {
    const markdown = buildJiraComment(
      draft({
        outcome: "partial",
        findings: [
          { kind: "step", body: "Entrei no modal de cupom" },
          { kind: "layout", body: "O botão Aplicar fica cortado no mobile" },
        ],
        shots: [{ caption: "modal no iPhone", findingIndex: 1 }],
      }),
    );
    expect(markdown).toContain("**Resultado:** parcial");
    expect(markdown).toContain("### Evidência");
    expect(markdown).toContain("1. **Layout** — O botão Aplicar fica cortado no mobile (evidência 1)");
    expect(markdown).toContain("1. modal no iPhone");
  });

  test("sem chave Jira usa o repositório e o número do PR", () => {
    const markdown = buildJiraComment(draft({ jiraKey: null }));
    expect(markdown).toContain("## Teste · api #12");
  });

  test("página reúne os CRs abrangidos", () => {
    const markdown = buildJiraComment(
      draft({
        scope: "page",
        scopeTitle: "Página da fila",
        subjects: [
          { label: "FUND-142 · cr-lab-06 #6" },
          { label: "OPS-14 · teste-repo #6" },
        ],
      }),
    );
    expect(markdown).toContain("## Teste · Página da fila");
    expect(markdown).toContain("**Abrangência:** página");
    expect(markdown).toContain("### CRs abrangidos");
    expect(markdown).toContain("- FUND-142 · cr-lab-06 #6");
    expect(markdown).toContain("- OPS-14 · teste-repo #6");
  });

  test("projeto da fila usa o tipo dele na abrangência", () => {
    const markdown = buildJiraComment(
      draft({
        scope: "project",
        scopeTitle: "Checkout",
        scopeLabel: "fix",
        subjects: [{ label: "FUND-10 · api #4" }],
      }),
    );
    expect(markdown).toContain("## Teste · Checkout");
    expect(markdown).toContain("**Abrangência:** fix");
  });

  test("sem cronômetro deixa isso explícito", () => {
    const markdown = buildJiraComment(draft({ timeSpentMs: null }));
    expect(markdown).toContain("**Tempo de revisão:** sem cronômetro");
  });
});

describe("buildKiroPrompt", () => {
  test("pede para comentar no card sem mexer no restante", () => {
    const prompt = buildKiroPrompt(
      draft({
        shots: [{ caption: "erro no toast", findingIndex: null }],
      }),
    );
    expect(prompt).toContain("Comente no card FUND-123");
    expect(prompt).toContain("Não altere a descrição nem o status.");
    expect(prompt).toContain("## Teste · FUND-123");
    expect(prompt).toContain("### Evidência");
    expect(prompt).toContain("1. erro no toast");
    expect(prompt).toContain("Cole as imagens da seção Evidência");
  });
});

describe("buildJiraHtml", () => {
  test("embute o print no html", () => {
    const html = buildJiraHtml(draft({ shots: [{ caption: "tela inicial", findingIndex: null }] }), [
      "data:image/jpeg;base64,abc",
    ]);
    expect(html).toContain("<h3>Evidência</h3>");
    expect(html).toContain('src="data:image/jpeg;base64,abc"');
    expect(html).toContain("1. tela inicial");
  });
});
