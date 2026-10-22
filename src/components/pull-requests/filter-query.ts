import type { FilterNode, FilterQuery } from "@/components/reui/filters/filters-types";
import type { PullRequestInsight, PullRequestItem } from "@/hooks/use-pull-requests";
import { prKey } from "@/domain/pull-request";

export const EMPTY_FILTER_QUERY: FilterQuery = {
  id: "root",
  type: "group",
  combinator: "and",
  rules: [],
};

export const FILTER_OPERATOR_LABELS_PT: Record<string, string> = {
  is: "é",
  is_not: "não é",
  is_any_of: "é qualquer de",
  is_none_of: "não é nenhum de",
};

export const NO_TARGET = "other";

type FieldId = "repository" | "author" | "target" | "size" | "state";

type MatchContext = { insights: Record<string, PullRequestInsight> };

const fieldValue: Record<FieldId, (pr: PullRequestItem, ctx: MatchContext) => string | null> = {
  repository: (pr) => pr.repository.uuid,
  author: (pr) => pr.author.uuid,
  target: (pr) => pr.targetKind ?? NO_TARGET,
  size: (pr, ctx) => ctx.insights[prKey(pr.repository.uuid, pr.id)]?.size?.bucket ?? null,
  state: (pr) => pr.reviewState,
};

function toValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return typeof value === "string" && value ? [value] : [];
}

function matchesNode(pr: PullRequestItem, node: FilterNode, ctx: MatchContext): boolean {
  if (node.type === "group") {
    if (node.rules.length === 0) return true;
    return node.combinator === "or"
      ? node.rules.some((child) => matchesNode(pr, child, ctx))
      : node.rules.every((child) => matchesNode(pr, child, ctx));
  }

  const getValue = fieldValue[node.path[0] as FieldId];
  const values = toValues(node.value);
  if (!getValue || values.length === 0) return true;

  const value = getValue(pr, ctx);
  const included = value !== null && values.includes(value);
  const result =
    node.operator === "is_not" || node.operator === "is_none_of" ? !included : included;
  return node.negated ? !result : result;
}

export function matchesQuery(pr: PullRequestItem, query: FilterQuery, ctx: MatchContext) {
  return matchesNode(pr, query, ctx);
}

export function isFilterQuery(value: unknown): value is FilterQuery {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as FilterQuery).type === "group" &&
    Array.isArray((value as FilterQuery).rules)
  );
}
