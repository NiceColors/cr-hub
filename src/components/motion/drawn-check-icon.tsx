"use client";

import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_IN_OUT, EASE_OUT } from "@/components/motion/tokens";

const CIRCLE = { duration: DURATION.slow, ease: EASE_IN_OUT };
const CHECK = { duration: DURATION.base, ease: EASE_OUT, delay: DURATION.slow * 0.6 };

/**
 * Lucide's circle-check, drawn once on mount (stroke-dashoffset via Motion's
 * pathLength). Static under reduced motion.
 */
export function DrawnCheckIcon({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? false : { pathLength: 0 };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <motion.circle
        cx={12}
        cy={12}
        r={10}
        initial={initial}
        animate={{ pathLength: 1 }}
        transition={CIRCLE}
      />
      <motion.path d="m9 12 2 2 4-4" initial={initial} animate={{ pathLength: 1 }} transition={CHECK} />
    </svg>
  );
}
