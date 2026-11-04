const number = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const shortDay = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const longDay = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

function isoToUtcDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export const formatNumber = (value: number) => number.format(value);

/** "22/10", para eixos e cabeçalhos de tabela. */
export const formatDayShort = (iso: string) => shortDay.format(isoToUtcDate(iso));

/** "qui., 22 de out.", para tooltips. */
export const formatDayLong = (iso: string) => longDay.format(isoToUtcDate(iso));

export function formatHours(hours: number) {
  if (hours < 1) return `${number.format(Math.max(1, Math.round(hours * 60)))} min`;
  if (hours < 48) return `${decimal.format(hours)} h`;
  return `${decimal.format(hours / 24)} dias`;
}

export function plural(count: number, one: string, many: string) {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}
