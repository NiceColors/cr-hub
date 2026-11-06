"use client";

import type { ReactNode } from "react";
import { Filters } from "@/components/reui/filters/filters";
import type { FilterField, FilterQuery } from "@/components/reui/filters/filters-types";
import { TeamCombobox } from "@/components/team-combobox";
import { FILTER_OPERATOR_LABELS_PT } from "@/components/pull-requests/filter-query";
import type { Team } from "@/lib/api/config";
import { FILTER_LABELS_PT } from "@/lib/i18n";

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
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <TeamCombobox teams={teams} teamId={teamId} onTeamChange={onTeamChange} />

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
