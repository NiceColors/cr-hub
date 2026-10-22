"use client";

import type { ReactNode } from "react";
import { UsersIcon } from "lucide-react";
import { Filters } from "@/components/reui/filters/filters";
import type { FilterField, FilterQuery } from "@/components/reui/filters/filters-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { FILTER_OPERATOR_LABELS_PT } from "@/components/pull-requests/filter-query";
import type { Team } from "@/lib/api/config";
import { FILTER_LABELS_PT } from "@/lib/i18n";

const ALL_TEAMS = "all";

export function PullRequestToolbar({
  teams,
  teamId,
  onTeamChange,
  fields,
  query,
  onQueryChange,
  actions,
}: {
  teams: Team[];
  teamId: number | null;
  onTeamChange: (teamId: number | null) => void;
  fields: FilterField[];
  query: FilterQuery;
  onQueryChange: (query: FilterQuery) => void;
  actions?: ReactNode;
}) {
  const items = [
    { value: ALL_TEAMS, label: "Todos os times" },
    ...teams.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Select
        value={teamId === null ? ALL_TEAMS : String(teamId)}
        onValueChange={(value) => onTeamChange(value === ALL_TEAMS ? null : Number(value))}
        className="z-30 w-full shrink-0 sm:w-52"
      >
        <SelectTrigger className="h-8 py-0">
          <span className="flex min-w-0 items-center gap-2">
            <UsersIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Time:</span>
            <SelectValue className="truncate" />
          </span>
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="min-w-0 flex-1">
        <Filters
          fields={fields}
          query={query}
          onQueryChange={onQueryChange}
          labels={FILTER_LABELS_PT}
          operatorLabels={FILTER_OPERATOR_LABELS_PT}
          size="sm"
          showClear
        />
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
