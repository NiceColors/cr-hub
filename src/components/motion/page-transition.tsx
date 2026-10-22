import { ViewTransition } from "react";

/**
 * Route content fade. Next.js runs App Router navigations inside a view
 * transition, so the leaving and entering pages crossfade (see the
 * .page-enter/.page-exit rules in globals.css). Must wrap the page itself,
 * not the layout, which persists across navigations.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
