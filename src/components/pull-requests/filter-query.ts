import type { FilterNode, FilterQuery } from "@/components/reui/filters/filters-types";
import type { PullRequestItem } from "@/hooks/use-pull-requests";

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

type FieldId = "repository" | "author";

const fieldValue: Record<FieldId, (pr: PullRequestItem) => string> = {
  repository: (pr) => pr.repository.uuid,
  author: (pr) => pr.author.uuid,
};

function toValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return typeof value === "string" && value ? [value] : [];
}

function matchesNode(pr: PullRequestItem, node: FilterNode): boolean {
  if (node.type === "group") {
    if (node.rules.length === 0) return true;
    return node.combinator === "or"
      ? node.rules.some((child) => matchesNode(pr, child))
      : node.rules.every((child) => matchesNode(pr, child));
  }

  const getValue = fieldValue[node.path[0] as FieldId];
  const values = toValues(node.value);
  if (!getValue || values.length === 0) return true;

  const included = values.includes(getValue(pr));
  const result =
    node.operator === "is_not" || node.operator === "is_none_of" ? !included : included;
  return node.negated ? !result : result;
}

export function matchesQuery(pr: PullRequestItem, query: FilterQuery) {
  return matchesNode(pr, query);
}
