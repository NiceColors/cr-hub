"use client";

import { memo, useEffect, useRef } from "react";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DURATION,
  EASE_IN_OUT,
  EASE_IN_OUT_CSS,
  EASE_OUT_CSS,
} from "@/components/motion/tokens";
import type { PullRequestItem } from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

type Tone = "warning" | "destructive" | "success";

type Stat = {
  label: string;
  value: number;
  hint: string;
  tone?: Tone;
};

const ROLL_TIMING = { duration: DURATION.slow * 1000, easing: EASE_IN_OUT_CSS };
const FADE_TIMING = { duration: DURATION.base * 1000, easing: EASE_OUT_CSS };

function computeStats(prs: PullRequestItem[]): Stat[] {
  let over24 = 0;
  let over72 = 0;
  let approved = 0;
  for (const pr of prs) {
    if (pr.ageBand !== "normal") over24++;
    if (pr.ageBand === "critical") over72++;
    if (pr.reviewState === "approved") approved++;
  }
  return [
    { label: "Abertos", value: prs.length, hint: "no filtro atual" },
    { label: "Acima de 24h", value: over24, hint: "precisam de atenção", tone: "warning" },
    { label: "Acima de 72h", value: over72, hint: "críticos", tone: "destructive" },
    { label: "Aprovados", value: approved, hint: "prontos para merge", tone: "success" },
  ];
}

/**
 * Rolls between values; a toned stat leaving zero takes its color with a
 * transition and pulses once. Mounts with the loaded value, so the first
 * value never pulses.
 */
function StatNumber({ value, tone }: { value: number; tone?: Tone }) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const reduceMotion = useReducedMotion();
  const previous = useRef(value);

  useEffect(() => {
    const was = previous.current;
    previous.current = value;
    if (tone && was === 0 && value > 0 && !reduceMotion) {
      animate(
        scope.current,
        { scale: [1, 1.08, 1] },
        { duration: DURATION.slow, ease: EASE_IN_OUT },
      );
    }
  }, [value, tone, reduceMotion, animate, scope]);

  return (
    <span
      ref={scope}
      data-tone={value > 0 ? tone : undefined}
      className={cn(
        // NumberFlow's box is taller than the line (its roll mask); a fixed
        // line-high box keeps the strip at the skeleton's height.
        "inline-flex h-8 origin-left items-center font-mono text-2xl font-semibold tabular-nums",
        "transition-colors duration-slow ease-out",
        "data-[tone=warning]:text-warning-foreground data-[tone=destructive]:text-destructive-foreground data-[tone=success]:text-success-foreground",
      )}
    >
      <NumberFlow
        value={value}
        transformTiming={ROLL_TIMING}
        spinTiming={ROLL_TIMING}
        opacityTiming={FADE_TIMING}
      />
    </span>
  );
}

export const PullRequestStats = memo(function PullRequestStats({
  pullRequests,
  isLoading,
}: {
  pullRequests: PullRequestItem[];
  isLoading: boolean;
}) {
  const stats = computeStats(pullRequests);

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card lg:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            "flex flex-col gap-1 border-border/60 px-4 py-3",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t lg:border-t-0",
            i === 2 && "lg:border-l",
          )}
        >
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="flex items-baseline gap-2">
            {/* Skeleton and number share one grid cell, so they crossfade in
                place; the skeleton carries a transparent digit to keep the
                same baseline and the hint text from shifting. */}
            <span className="grid">
              <AnimatePresence initial={false}>
                {isLoading ? (
                  <motion.span
                    key="skeleton"
                    aria-hidden
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="[grid-area:1/1]"
                  >
                    <Skeleton className="inline-block w-10 font-mono text-2xl font-semibold text-transparent">
                      0
                    </Skeleton>
                  </motion.span>
                ) : (
                  <motion.span
                    key="value"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="[grid-area:1/1]"
                  >
                    <StatNumber value={stat.value} tone={stat.tone} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="truncate text-xs text-muted-foreground/80">{stat.hint}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
});
