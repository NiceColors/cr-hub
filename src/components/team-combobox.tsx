"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/motion/combobox";
import { cn } from "@/lib/utils";

const ALL_TEAMS = "all";

/** Escolha de time com busca; `null` é "Todos os times". */
export function TeamCombobox({
  teams,
  teamId,
  onTeamChange,
  className,
}: {
  teams: readonly { id: number; name: string }[];
  teamId: number | null;
  onTeamChange: (teamId: number | null) => void;
  className?: string;
}) {
  return (
    <Combobox
      value={teamId === null ? ALL_TEAMS : String(teamId)}
      onValueChange={(value) => onTeamChange(value === ALL_TEAMS ? null : Number(value))}
      className={cn("w-full shrink-0 sm:w-52", className)}
    >
      <ComboboxTrigger className="h-8 min-w-0 rounded-full px-3">
        <ComboboxInput
          aria-label="Time"
          placeholder="Buscar time…"
          className="h-8 text-xs"
          wrapperClassName="[&>svg]:size-3.5"
        />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxList ariaLabel="Times">
          <ComboboxItem value={ALL_TEAMS} textValue="Todos os times">
            Todos os times
          </ComboboxItem>
          {teams.map((team) => (
            <ComboboxItem key={team.id} value={String(team.id)} textValue={team.name}>
              {team.name}
            </ComboboxItem>
          ))}
        </ComboboxList>
        <ComboboxEmpty>Nenhum time com esse nome.</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
