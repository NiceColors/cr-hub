"use client";

import { cn } from "@/lib/utils";
import { useHeatCalendar } from "./context";
import { fmtRangeYear, STEPS } from "./utils";

export function HeatCalendarLegend({ className }: { className?: string }) {
  const { start, end, step, setStep, fill, canHover, reduce } = useHeatCalendar();
  return (
    <div className={cn("mt-3 flex flex-wrap items-center justify-between gap-3", className)}>
      <span className="text-xs text-muted-foreground tabular-nums">
        {start && end ? `${fmtRangeYear.format(start)} – ${fmtRangeYear.format(end)}` : "\u00a0"}
      </span>
      {/* hovering a step keeps only cells of that level lit, so the legend doubles as a filter */}
      <span className="flex items-center gap-1" onPointerLeave={() => setStep(null)}>
        <span className="mr-0.5 text-xs text-muted-foreground">menos</span>
        {STEPS.map((s, i) => (
          <button
            type="button"
            aria-label={`Mostrar nível de atividade ${i}`}
            aria-pressed={step === i}
            key={s}
            onPointerEnter={() => {
              if (canHover) setStep(i);
            }}
            onFocus={() => setStep(i)}
            onBlur={() => setStep(null)}
            onClick={() => setStep(step === i ? null : i)}
            className="size-3 rounded-[3px] transition-transform duration-150"
            style={{ background: fill(i), transform: !reduce && step === i ? "scale(1.25)" : undefined }}
          />
        ))}
        <span className="ml-0.5 text-xs text-muted-foreground">mais</span>
      </span>
    </div>
  );
}
