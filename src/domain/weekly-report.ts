import { toIsoDate } from "@/domain/rotation";

export type HistoryRow = {
  repoSlug: string | null;
  prId: number;
  title: string | null;
  url: string | null;
  authorName: string | null;
  createdOn: string; // ISO
  firstSeenAt: number; // ms
  firstReviewAt: number | null;
  closedAt: number | null;
  lastSeenAt: number;
  changesCycles: number;
  reviewTrackedFromStart: boolean;
};

export type FocusRow = {
  repoSlug: string;
  prId: number;
  title: string;
  url: string;
  timeSpentMs: number;
  doneAt: number;
};

export type WeekRange = { startIso: string; endIso: string; startMs: number; endMs: number };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TOP = 5;

/** Segunda-feira (local) da semana que contém a data. */
export function weekStartOf(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toIsoDate(d);
}

/** Semana local de segunda 00:00 até a segunda seguinte (exclusiva). */
export function weekRange(mondayIso: string): WeekRange {
  const [y, m, d] = mondayIso.split("-").map(Number);
  const start = new Date(y!, m! - 1, d!);
  const end = new Date(y!, m! - 1, d! + 7);
  const sunday = new Date(y!, m! - 1, d! + 6);
  return {
    startIso: mondayIso,
    endIso: toIsoDate(sunday),
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
}

export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function formatDuration(ms: number) {
  if (ms < MINUTE) return "<1min";
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  return `${minutes}min`;
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const yearFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const stampFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function isoToLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function escapeCell(text: string) {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function prLink(row: { repoSlug: string | null; prId: number; title: string | null; url: string | null }) {
  const label = `${row.repoSlug ?? "?"} #${row.prId}`;
  const title = row.title ? ` ${row.title.replace(/[[\]]/g, "")}` : "";
  return row.url ? `[${label}](${row.url})${title}` : `${label}${title}`;
}

function table(headers: string[], rows: string[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

export type WeeklyStats = {
  opened: number;
  closed: number;
  openAtEnd: number;
  firstReviewMedianMs: number | null;
  firstReviewSample: number;
};

export function buildWeeklyReport(opts: {
  rows: HistoryRow[];
  focus: FocusRow[];
  weekStartIso: string;
  nowMs: number;
}): { markdown: string; stats: WeeklyStats } {
  const { rows, focus, weekStartIso, nowMs } = opts;
  const week = weekRange(weekStartIso);
  const inWeek = (ms: number | null) => ms !== null && ms >= week.startMs && ms < week.endMs;
  const cutoff = Math.min(week.endMs, nowMs);
  const created = (row: HistoryRow) => Date.parse(row.createdOn);

  const opened = rows.filter((r) => inWeek(created(r)));
  const closed = rows.filter((r) => inWeek(r.closedAt));
  const openAtEnd = rows.filter(
    (r) => r.firstSeenAt < cutoff && (r.closedAt === null || r.closedAt >= cutoff),
  );
  const activeInWeek = rows.filter(
    (r) => r.firstSeenAt < week.endMs && r.lastSeenAt >= week.startMs,
  );

  const firstReviewTimes = rows
    .filter((r) => r.reviewTrackedFromStart && inWeek(r.firstReviewAt))
    .map((r) => r.firstReviewAt! - created(r));
  const firstReviewMedianMs = median(firstReviewTimes);

  const longestClosed = closed
    .map((r) => ({ row: r, ms: r.closedAt! - created(r) }))
    .toSorted((a, b) => b.ms - a.ms)
    .slice(0, TOP);
  const longestOpen = openAtEnd
    .map((r) => ({ row: r, ms: cutoff - created(r) }))
    .toSorted((a, b) => b.ms - a.ms)
    .slice(0, TOP);
  const mostCycles = activeInWeek
    .filter((r) => r.changesCycles > 0)
    .toSorted((a, b) => b.changesCycles - a.changesCycles || created(a) - created(b))
    .slice(0, TOP);
  const focusDone = focus.filter((f) => inWeek(f.doneAt));
  const focusTotal = focusDone.reduce((sum, f) => sum + f.timeSpentMs, 0);

  const start = isoToLocalDate(week.startIso);
  const end = isoToLocalDate(week.endIso);
  const lines: string[] = [];
  lines.push(`## Retro de code review · ${dateFormat.format(start)} a ${yearFormat.format(end)}`);
  lines.push("");
  lines.push(`- **${opened.length}** PR(s) abertos na semana`);
  lines.push(`- **${closed.length}** PR(s) saíram da fila (merge ou recusa)`);
  lines.push(`- **${openAtEnd.length}** PR(s) ainda abertos no fim do período`);
  lines.push("");

  lines.push("### Tempo até a primeira revisão");
  lines.push("");
  if (firstReviewMedianMs === null) {
    lines.push("Nenhuma primeira revisão observada nesta semana.");
  } else {
    lines.push(
      `Mediana de **${formatDuration(firstReviewMedianMs)}** em ${firstReviewTimes.length} PR(s) (mais lento: ${formatDuration(Math.max(...firstReviewTimes))}).`,
    );
  }
  lines.push("");

  lines.push("### PRs mais demorados");
  lines.push("");
  if (longestClosed.length === 0) {
    lines.push("Nenhum PR saiu da fila nesta semana.");
  } else {
    lines.push(
      table(
        ["PR", "Autor", "Tempo aberto", "Ciclos de mudança"],
        longestClosed.map(({ row, ms }) => [
          prLink(row),
          row.authorName ?? "—",
          formatDuration(ms),
          String(row.changesCycles),
        ]),
      ),
    );
  }
  lines.push("");

  if (longestOpen.length > 0) {
    lines.push("### Ainda abertos há mais tempo");
    lines.push("");
    lines.push(
      table(
        ["PR", "Autor", "Idade", "Primeira revisão"],
        longestOpen.map(({ row, ms }) => [
          prLink(row),
          row.authorName ?? "—",
          formatDuration(ms),
          row.firstReviewAt !== null && row.firstReviewAt < cutoff ? "sim" : "**ainda não**",
        ]),
      ),
    );
    lines.push("");
  }

  lines.push("### Mais ciclos de mudança");
  lines.push("");
  if (mostCycles.length === 0) {
    lines.push("Nenhum PR com pedido de mudança nesta semana.");
  } else {
    lines.push(
      table(
        ["PR", "Autor", "Ciclos", "Situação"],
        mostCycles.map((row) => [
          prLink(row),
          row.authorName ?? "—",
          String(row.changesCycles),
          row.closedAt !== null && row.closedAt < week.endMs ? "Saiu da fila" : "Aberto",
        ]),
      ),
    );
  }
  lines.push("");

  if (focusDone.length > 0) {
    lines.push("### Tempo de revisão registrado (fila de foco)");
    lines.push("");
    lines.push(
      `${focusDone.length} revisão(ões), **${formatDuration(focusTotal)}** no total, média de ${formatDuration(focusTotal / focusDone.length)}.`,
    );
    lines.push("");
    lines.push(
      table(
        ["PR", "Tempo"],
        focusDone
          .toSorted((a, b) => b.timeSpentMs - a.timeSpentMs)
          .map((f) => [prLink(f), formatDuration(f.timeSpentMs)]),
      ),
    );
    lines.push("");
  }

  lines.push(
    `_Gerado pelo CR Tracker em ${stampFormat.format(new Date(nowMs))}. Os tempos vêm das atualizações da fila, com precisão próxima do intervalo de polling; só entram PRs observados enquanto o app estava aberto._`,
  );

  return {
    markdown: `${lines.join("\n")}\n`,
    stats: {
      opened: opened.length,
      closed: closed.length,
      openAtEnd: openAtEnd.length,
      firstReviewMedianMs,
      firstReviewSample: firstReviewTimes.length,
    },
  };
}
