/**
 * Motion durations for Motion (JS). Must match --duration-* in
 * src/app/globals.css. Motion takes seconds. Easing curves live in
 * src/lib/ease.ts.
 */
export const DURATION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const;

export { EASE_IN_OUT, EASE_IN_OUT_CSS, EASE_OUT, EASE_OUT_CSS } from "@/lib/ease";
