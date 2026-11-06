import { formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatAgePtBR(iso: string, now: Date = new Date()) {
  return formatDistanceStrict(new Date(iso), now, {
    addSuffix: true,
    locale: ptBR,
  });
}

/** Short age for dense tables: "26min", "3h", "2d". */
export function formatCompactAge(iso: string, now: Date = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

