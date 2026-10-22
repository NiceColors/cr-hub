"use client";

import { useEffect, useState } from "react";
import type { PullRequestItem } from "@/hooks/use-pull-requests";

export function pullRequestRowId(pr: PullRequestItem) {
  return `${pr.repository.uuid}:${pr.id}`;
}

const NONE: ReadonlySet<string> = new Set();
const ARRIVAL_HIGHLIGHT_MS = 1600;

type QueueSnapshot = {
  scope: number | null;
  items: readonly PullRequestItem[] | undefined;
  ids: ReadonlySet<string>;
  arrivals: ReadonlySet<string>;
  departures: ReadonlySet<string>;
};

function idsOf(items: readonly PullRequestItem[] | undefined): ReadonlySet<string> {
  return items ? new Set(items.map(pullRequestRowId)) : NONE;
}

function difference(a: ReadonlySet<string>, b: ReadonlySet<string>): ReadonlySet<string> {
  let result: Set<string> | undefined;
  for (const id of a) {
    if (!b.has(id)) (result ??= new Set()).add(id);
  }
  return result ?? NONE;
}

/**
 * Pull requests that arrived in or left the queue between two responses for
 * the same scope (team). The first response of a scope reports nothing, so the
 * initial load and team switches never read as arrivals. Arrivals reset after
 * the highlight window, so a row remounted later (page or filter change) does
 * not replay its entrance.
 */
export function useQueueChanges(
  items: readonly PullRequestItem[] | undefined,
  scope: number | null,
) {
  const [snapshot, setSnapshot] = useState<QueueSnapshot>(() => ({
    scope,
    items,
    ids: idsOf(items),
    arrivals: NONE,
    departures: NONE,
  }));

  let current = snapshot;
  if (snapshot.items !== items || snapshot.scope !== scope) {
    const ids = idsOf(items);
    const comparable =
      snapshot.scope === scope && snapshot.items !== undefined && items !== undefined;
    current = {
      scope,
      items,
      ids,
      arrivals: comparable ? difference(ids, snapshot.ids) : NONE,
      departures: comparable ? difference(snapshot.ids, ids) : NONE,
    };
    setSnapshot(current);
  }

  const { arrivals } = current;
  useEffect(() => {
    if (arrivals.size === 0) return;
    const timer = setTimeout(() => {
      setSnapshot((s) => (s.arrivals === arrivals ? { ...s, arrivals: NONE } : s));
    }, ARRIVAL_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [arrivals]);

  return { arrivals: current.arrivals, departures: current.departures };
}
