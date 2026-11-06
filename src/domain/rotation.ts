export interface Rotation {
  /** Ordem da escala. */
  memberUuids: string[];
  /** Primeiro dia útil da escala (YYYY-MM-DD); quem está em `memberUuids[0]` começa. */
  startDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** 1970-01-05 foi segunda-feira: dia 4 da época. */
const EPOCH_MONDAY = 4;

/** Data local no formato YYYY-MM-DD. */
export function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dayNumber(value));
}

/** Dias desde a época, sem fuso: a data é tratada como calendário puro. */
function dayNumber(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / DAY_MS;
}

function fromDayNumber(n: number) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

/** Dias úteis (segunda a sexta) estritamente antes do dia `n`, contados desde uma segunda de referência. */
function weekdaysBefore(n: number) {
  const offset = n - EPOCH_MONDAY;
  return Math.floor(offset / 7) * 5 + Math.min(mod(offset, 7), 5);
}

export function isWeekend(iso: string) {
  return mod(dayNumber(iso) - EPOCH_MONDAY, 7) >= 5;
}

/**
 * Posição na escala para a data. A escala anda um passo por dia útil; no fim de
 * semana vale quem estava de plantão na sexta.
 */
export function onCallIndex(rotation: Rotation, dateIso: string) {
  const size = rotation.memberUuids.length;
  if (size === 0) return null;
  const steps =
    weekdaysBefore(dayNumber(dateIso) + 1) - weekdaysBefore(dayNumber(rotation.startDate)) - 1;
  return mod(steps, size);
}

export function onCallFor(rotation: Rotation, dateIso: string) {
  const index = onCallIndex(rotation, dateIso);
  return index === null ? null : rotation.memberUuids[index]!;
}

/** Próximo dia útil depois de `dateIso`. */
export function nextBusinessDay(dateIso: string) {
  let n = dayNumber(dateIso) + 1;
  while (isWeekend(fromDayNumber(n))) n++;
  return fromDayNumber(n);
}

/**
 * Quem sugerir para revisar um PR: o plantão do dia, ou o seguinte na escala
 * se o plantão for o próprio autor.
 */
export function suggestReviewer(rotation: Rotation, dateIso: string, authorUuid: string) {
  const index = onCallIndex(rotation, dateIso);
  if (index === null) return null;
  const size = rotation.memberUuids.length;
  for (let i = 0; i < size; i++) {
    const uuid = rotation.memberUuids[(index + i) % size]!;
    if (uuid !== authorUuid) return uuid;
  }
  return null;
}

export type TeamWithRotation = {
  id: number;
  name: string;
  memberUuids: string[];
  repositoryUuids: string[];
  rotation: Rotation | null;
};

/** Primeiro time com escala que cobre o autor e o repositório do PR. */
export function rotationTeamFor<T extends TeamWithRotation>(
  teams: T[],
  pr: { author: { uuid: string }; repository: { uuid: string } },
): T | null {
  return (
    teams.find(
      (team) =>
        team.rotation !== null &&
        team.rotation.memberUuids.length > 0 &&
        team.memberUuids.includes(pr.author.uuid) &&
        (team.repositoryUuids.length === 0 || team.repositoryUuids.includes(pr.repository.uuid)),
    ) ?? null
  );
}
