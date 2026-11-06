import { describe, expect, test } from "vitest";
import {
  parseRetryAfter,
  pickReposToRefresh,
  reposToRefreshThisPoll,
} from "@/lib/bitbucket/rateLimit";

describe("parseRetryAfter", () => {
  test("lê segundos e data HTTP", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter("Thu, 01 Jan 1970 00:00:05 GMT", 0)).toBe(5);
    expect(parseRetryAfter("não é data")).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});

describe("reposToRefreshThisPoll", () => {
  test("espalha a listagem para caber em 500 req/h com poll de 30s", () => {
    expect(
      reposToRefreshThisPoll({
        pollIntervalSeconds: 30,
        requestsLastHour: 0,
        repoCount: 40,
      }),
    ).toBe(4);
  });

  test("com o orçamento estourado, sonda um repositório por ciclo", () => {
    expect(
      reposToRefreshThisPoll({
        pollIntervalSeconds: 30,
        requestsLastHour: 800,
        repoCount: 40,
      }),
    ).toBe(1);
  });

  test("atualização manual não sonda quando o orçamento acabou", () => {
    expect(
      reposToRefreshThisPoll({
        pollIntervalSeconds: 30,
        requestsLastHour: 900,
        repoCount: 40,
        force: true,
      }),
    ).toBe(0);
  });
});

describe("pickReposToRefresh", () => {
  test("prioriza quem nunca foi consultado", () => {
    const repos = [{ uuid: "b" }, { uuid: "a" }, { uuid: "c" }];
    const fetched = new Map<string, number>([["b", 100]]);
    expect(pickReposToRefresh(repos, fetched, 2).map((repo) => repo.uuid)).toEqual(["a", "c"]);
  });
});
