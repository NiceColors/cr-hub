"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatNumber } from "@/components/dashboard/format";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type ShareSegment = { id: string; label: string; value: number; color: string };

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/** Uma barra só, dividida pela participação de cada parte no total. */
export function ShareBar({
  segments,
  label,
  className,
}: {
  segments: readonly ShareSegment[];
  label: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const description = visible
    .map((s) => `${s.label}: ${formatNumber(s.value)} (${percent.format(s.value / total)})`)
    .join(", ");
  // Entra revelando da esquerda (clip-path) e, quando os números mudam, os
  // segmentos deslizam por layout animation (transform), sem animar width.
  return (
    <motion.div
      role="img"
      aria-label={total > 0 ? `${label}. ${description}.` : `${label}: nada no momento.`}
      className={cn("flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted", className)}
      initial={reduce ? false : { clipPath: "inset(0 100% 0 0 round 9999px)" }}
      animate={{ clipPath: "inset(0 0% 0 0 round 9999px)" }}
      transition={{ duration: reduce ? 0 : 0.6, ease: EASE_OUT }}
    >
      {visible.map((segment) => (
        <motion.span
          key={segment.id}
          layout={reduce ? false : "position"}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ backgroundColor: segment.color, width: `${(segment.value / total) * 100}%` }}
          transition={{ layout: { duration: 0.4, ease: EASE_OUT } }}
        />
      ))}
    </motion.div>
  );
}

/** Legenda da barra: cor, rótulo, quantidade e participação. */
export function ShareLegend({
  segments,
  className,
}: {
  segments: readonly ShareSegment[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <ul aria-hidden className={cn("flex flex-col gap-1.5 text-xs", className)}>
      {segments.map((segment) => (
        <li key={segment.id} className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{segment.label}</span>
          <span className="font-mono text-foreground tabular-nums">{formatNumber(segment.value)}</span>
          <span className="w-9 text-right font-mono text-muted-foreground tabular-nums">
            {total > 0 ? percent.format(segment.value / total) : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}
