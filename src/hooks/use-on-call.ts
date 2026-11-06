"use client";

import { useMemo } from "react";
import {
  nextBusinessDay,
  onCallFor,
  rotationTeamFor,
  suggestReviewer,
  toIsoDate,
} from "@/domain/rotation";
import { useMembers, useTeams } from "@/hooks/use-config";
import { useHydrated } from "@/hooks/use-hydrated";

export type OnCallPerson = { uuid: string; displayName: string; avatarUrl: string | null };

export type OnCallEntry = {
  teamId: number;
  teamName: string;
  today: OnCallPerson;
  next: OnCallPerson | null;
};

export type ReviewerSuggestion = { teamName: string; person: OnCallPerson };

const NO_ENTRIES: OnCallEntry[] = [];

/**
 * Plantão de revisão de cada time com escala, para hoje e o próximo dia útil.
 * Só calcula depois de hidratar: a data é a do navegador.
 */
export function useOnCall() {
  const hydrated = useHydrated();
  const teams = useTeams().data?.teams;
  const members = useMembers().data?.members;

  return useMemo(() => {
    if (!hydrated || !teams || !members) {
      return {
        entries: NO_ENTRIES,
        onCallUuids: new Set<string>(),
        suggestFor: () => null as ReviewerSuggestion | null,
      };
    }
    const today = toIsoDate(new Date());
    const tomorrow = nextBusinessDay(today);
    const people = new Map(
      members.map((m) => [m.uuid, { uuid: m.uuid, displayName: m.displayName, avatarUrl: m.avatarUrl }]),
    );
    const person = (uuid: string | null) => (uuid ? (people.get(uuid) ?? null) : null);

    const entries: OnCallEntry[] = [];
    for (const team of teams) {
      if (!team.rotation) continue;
      const todayPerson = person(onCallFor(team.rotation, today));
      if (!todayPerson) continue;
      const nextPerson = person(onCallFor(team.rotation, tomorrow));
      entries.push({
        teamId: team.id,
        teamName: team.name,
        today: todayPerson,
        next: nextPerson && nextPerson.uuid !== todayPerson.uuid ? nextPerson : null,
      });
    }

    const suggestFor = (pr: {
      author: { uuid: string };
      repository: { uuid: string };
    }): ReviewerSuggestion | null => {
      const team = rotationTeamFor(teams, pr);
      if (!team?.rotation) return null;
      const suggested = person(suggestReviewer(team.rotation, today, pr.author.uuid));
      return suggested ? { teamName: team.name, person: suggested } : null;
    };

    return { entries, onCallUuids: new Set(entries.map((e) => e.today.uuid)), suggestFor };
  }, [hydrated, teams, members]);
}
