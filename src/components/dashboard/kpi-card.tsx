"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Sparkline } from "@/components/charts/sparkline";
import { formatNumber } from "@/components/dashboard/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiTone = "warning" | "destructive" | "success";

export type Kpi = {
  label: string;
  icon: LucideIcon;
  value: number | null;
  format?: (value: number) => string;
  /** Linha de apoio ao lado da variação. */
  hint?: ReactNode;
  delta?: ReactNode;
  spark?: readonly (number | null)[];
  /** Cor da tendência e do brilho do cartão. */
  color?: string;
  /** Cor do número quando ele passa de zero. */
  tone?: KpiTone;
};

const TONE_TEXT: Record<KpiTone, string> = {
  warning: "text-warning-foreground",
  destructive: "text-destructive-foreground",
  success: "text-success-foreground",
};

export function KpiCard({
  label,
  icon: Icon,
  value,
  format = formatNumber,
  hint,
  delta,
  spark,
  color = "var(--chart-1)",
  tone,
  isLoading,
}: Kpi & { isLoading: boolean }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border bg-card p-4"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-36 rounded-full opacity-[0.14] blur-2xl"
        style={{ backgroundColor: color }}
      />
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span
          aria-hidden
          className="grid size-5 shrink-0 place-items-center rounded-md"
          style={{ backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`, color }}
        >
          <Icon className="size-3" />
        </span>
        <span className="truncate">{label}</span>
      </span>
      {isLoading ? (
        <>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-auto h-8 w-full" />
        </>
      ) : (
        <>
          {value === null ? (
            <span className="font-mono text-2xl font-semibold text-muted-foreground">—</span>
          ) : (
            <AnimatedNumber
              value={value}
              duration={0.6}
              format={format}
              className={cn(
                "font-mono text-2xl font-semibold tracking-tight tabular-nums",
                tone && value > 0 && TONE_TEXT[tone],
              )}
            />
          )}
          <div className="flex min-h-5 min-w-0 items-center gap-2">
            {delta}
            {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
          </div>
          {spark ? (
            <Sparkline
              data={spark}
              label={`${label}: tendência no período`}
              variant="area"
              color={color}
              interactive
              formatValue={format}
              className="mt-auto"
            />
          ) : null}
        </>
      )}
    </div>
  );
}

export function KpiStrip({
  items,
  isLoading,
  className,
}: {
  items: Kpi[];
  isLoading: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3", className)}>
      {items.map((item) => (
        <KpiCard key={item.label} {...item} isLoading={isLoading} />
      ))}
    </div>
  );
}
