import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { formatNumber } from "@/components/dashboard/format";
import { cn } from "@/lib/utils";

const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0, signDisplay: "always" });

/**
 * Variação de um número contra uma referência. A cor diz se melhorou ou
 * piorou, conforme o sentido bom da medida, e não se subiu ou desceu.
 */
export function Delta({
  current,
  previous,
  better,
  against,
  format = formatNumber,
  className,
}: {
  current: number | null;
  previous: number | null;
  better: "up" | "down";
  /** Referência, para leitores de tela e tooltip: "7 dias atrás". */
  against: string;
  /** Formato da diferença absoluta, quando a referência é zero. */
  format?: (value: number) => string;
  className?: string;
}) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  const steady = Math.abs(diff) < 1e-9;
  const improved = better === "up" ? diff > 0 : diff < 0;
  const text = steady
    ? "estável"
    : previous !== 0
      ? `${percent.format((diff / Math.abs(previous)) * 100)}%`
      : `${diff > 0 ? "+" : "−"}${format(Math.abs(diff))}`;
  const Icon = steady ? ArrowRightIcon : diff > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  const description = steady
    ? `estável em relação a ${against}`
    : `${diff > 0 ? "subiu" : "caiu"} ${text.replace(/^[+−-]/, "")} em relação a ${against}`;

  return (
    <span
      title={`Em relação a ${against}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium tabular-nums",
        steady
          ? "bg-muted text-muted-foreground"
          : improved
            ? "bg-success/12 text-success-foreground"
            : "bg-destructive/12 text-destructive-foreground",
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      <span aria-hidden>{text}</span>
      <span className="sr-only">{description}</span>
    </span>
  );
}
