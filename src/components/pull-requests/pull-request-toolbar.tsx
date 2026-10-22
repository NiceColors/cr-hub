"use client";

import { UsersIcon } from "lucide-react";
import { Filters } from "@/components/reui/filters/filters";
import type { FilterField, FilterQuery } from "@/components/reui/filters/filters-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}: {
  teams: Team[];
  teamId: number | null;
  onTeamChange: (teamId: number | null) => void;
  fields: FilterField[];
  query: FilterQuery;
  onQueryChange: (query: FilterQuery) => void;
}) {
  const items = [
    { value: ALL_TEAMS, label: "Todos os times" },
    ...teams.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Select
        items={items}
        value={teamId === null ? ALL_TEAMS : String(teamId)}
        onValueChange={(value) =>
          onTeamChange(!value || value === ALL_TEAMS ? null : Number(value))
        }
      >
        <SelectTrigger size="sm" className="w-full sm:w-48" aria-label="Time">
          <UsersIcon className="text-muted-foreground" />
          <SelectValue />
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
    </div>
  );
}
