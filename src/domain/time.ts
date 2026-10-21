import { formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatAgePtBR(iso: string, now: Date = new Date()) {
  return formatDistanceStrict(new Date(iso), now, {
    addSuffix: true,
    locale: ptBR,
  });
}

