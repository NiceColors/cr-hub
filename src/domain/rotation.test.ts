import { describe, expect, test } from "vitest";
import {
  isWeekend,
  nextBusinessDay,
  onCallFor,
  rotationTeamFor,
  suggestReviewer,
  type Rotation,
} from "@/domain/rotation";

// 2026-10-19 é segunda-feira.
const rotation: Rotation = { memberUuids: ["ana", "bia", "caio"], startDate: "2026-10-19" };

describe("onCallFor", () => {
  test("anda um passo por dia útil", () => {
    expect(onCallFor(rotation, "2026-10-19")).toBe("ana");
    expect(onCallFor(rotation, "2026-10-20")).toBe("bia");
    expect(onCallFor(rotation, "2026-10-21")).toBe("caio");
    expect(onCallFor(rotation, "2026-10-22")).toBe("ana");
  });

  test("fim de semana mantém o plantão de sexta e segunda continua a escala", () => {
    expect(onCallFor(rotation, "2026-10-23")).toBe("bia"); // sexta
    expect(onCallFor(rotation, "2026-10-24")).toBe("bia"); // sábado
    expect(onCallFor(rotation, "2026-10-25")).toBe("bia"); // domingo
    expect(onCallFor(rotation, "2026-10-26")).toBe("caio"); // segunda
  });

  test("início num fim de semana começa na segunda", () => {
    expect(onCallFor({ ...rotation, startDate: "2026-10-24" }, "2026-10-26")).toBe("ana");
  });

  test("datas anteriores ao início andam para trás na escala", () => {
    expect(onCallFor(rotation, "2026-10-16")).toBe("caio"); // sexta anterior
  });

  test("escala vazia não tem plantão", () => {
    expect(onCallFor({ memberUuids: [], startDate: "2026-10-19" }, "2026-10-19")).toBeNull();
  });
});

describe("suggestReviewer", () => {
  test("sugere o plantão, ou o seguinte se o plantão for o autor", () => {
    expect(suggestReviewer(rotation, "2026-10-19", "bia")).toBe("ana");
    expect(suggestReviewer(rotation, "2026-10-19", "ana")).toBe("bia");
    expect(suggestReviewer({ memberUuids: ["ana"], startDate: "2026-10-19" }, "2026-10-19", "ana")).toBeNull();
  });
});

describe("dias úteis", () => {
  test("detecta fim de semana e pula para o próximo dia útil", () => {
    expect(isWeekend("2026-10-24")).toBe(true);
    expect(isWeekend("2026-10-23")).toBe(false);
    expect(nextBusinessDay("2026-10-23")).toBe("2026-10-26");
    expect(nextBusinessDay("2026-10-20")).toBe("2026-10-21");
  });
});

describe("rotationTeamFor", () => {
  const teams = [
    { id: 1, name: "Sem escala", memberUuids: ["x"], repositoryUuids: [], rotation: null },
    { id: 2, name: "Fundos", memberUuids: ["x"], repositoryUuids: ["r1"], rotation },
    { id: 3, name: "Geral", memberUuids: ["x"], repositoryUuids: [], rotation },
  ];

  test("escolhe o primeiro time com escala que cobre autor e repositório", () => {
    expect(rotationTeamFor(teams, { author: { uuid: "x" }, repository: { uuid: "r1" } })?.id).toBe(2);
    expect(rotationTeamFor(teams, { author: { uuid: "x" }, repository: { uuid: "r9" } })?.id).toBe(3);
    expect(rotationTeamFor(teams, { author: { uuid: "y" }, repository: { uuid: "r1" } })).toBeNull();
  });
});
