/**
 * Motion tokens for Motion (JS). Must match the CSS tokens in
 * src/app/globals.css (--duration-* and --ease-*). Motion takes seconds.
 */
export const DURATION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const;

/** Entrances and state changes that start from rest. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Elements that move or resize on screen (layout changes). */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/** Same curves as CSS strings, for WAAPI-based libraries (NumberFlow). */
export const EASE_OUT_CSS = "cubic-bezier(0.23, 1, 0.32, 1)";
export const EASE_IN_OUT_CSS = "cubic-bezier(0.77, 0, 0.175, 1)";
