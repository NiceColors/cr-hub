"use client";
import { type ReactNode, useState } from "react";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Tooltip } from "@/components/motion/tooltip";
import { cn } from "@/lib/utils";
import { useHeatCalendar } from "./context";
import { fmtDay, fmtRange, GAP, MONTH_ROW, PITCH } from "./utils";

export function HeatCalendarTooltip({
  children,
  className,
}: {
  children?: ReactNode | ((data: NonNullable<ReturnType<typeof useHeatCalendar>["tooltip"]>) => ReactNode);
  className?: string;
}) {
  const { gridRef, tooltipId, tip, tooltip, unitFor, weeks, tipX, tipY } = useHeatCalendar();
  const [dismissed, setDismissed] = useState<typeof tip>(null);
  // Anchored to the grid, which never changes, at the cell's point within it. Swapping the
  // anchor element in the same commit that opens the tooltip leaves it unpositioned.
  const anchorPoint = { x: tipX / (weeks * PITCH - GAP), y: tipY / (MONTH_ROW + 7 * PITCH) };
  return (
    <Tooltip
      open={tooltip !== null && dismissed !== tip}
      onOpenChange={(open) => { if (!open) setDismissed(tip); }}
      id={tooltipId}
      anchorRef={gridRef}
      anchorPoint={anchorPoint}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      content={tooltip &&
        (typeof children === "function"
          ? children(tooltip)
          : (children ?? (
              <>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                  <NumberTicker
                    value={tooltip.days > 1 ? tooltip.total : tooltip.count}
                    duration={0.35}
                    startOnView={false}
                  />{" "}
                  {unitFor(tooltip.days > 1 ? tooltip.total : tooltip.count)}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {tooltip.days > 1 && tooltip.startDate && tooltip.endDate
                    ? `${fmtRange.format(tooltip.startDate)} – ${fmtRange.format(tooltip.endDate)}`
                    : fmtDay.format(tooltip.date)}
                </span>
                {tooltip.days > 1 ? <span className="text-muted-foreground tabular-nums">{tooltip.days} dias</span> : null}
              </>
            )))}
    />
  );
}
