"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Decorative icon before the label. */
  icon?: ReactNode;
  /** Trailing count or badge. */
  suffix?: ReactNode;
  title?: string;
  disabled?: boolean;
};

/**
 * Escolha única entre poucas opções curtas (período, recorte, visualização).
 * Um radiogroup de verdade: setas, Home e End movem a seleção; Tab entra só
 * na opção marcada.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  label: string;
  className?: string;
}) {
  const layoutId = useId();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.flatMap((option, index) => (option.disabled ? [] : [index]));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const edge = { Home: 0, End: enabled.length - 1 }[event.key];
    if ((step === undefined && edge === undefined) || enabled.length === 0) return;
    event.preventDefault();
    const at = Math.max(0, enabled.indexOf(options.findIndex((o) => o.value === value)));
    const next = enabled[edge ?? (at + step! + enabled.length) % enabled.length]!;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex h-8 max-w-full items-center overflow-x-auto rounded-full border bg-card p-0.5",
        className,
      )}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            title={option.title}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-ring relative inline-flex h-full shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors duration-fast",
              "disabled:pointer-events-none disabled:opacity-50",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected ? (
              <motion.span
                aria-hidden
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-muted"
                transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
              />
            ) : null}
            {option.icon ? (
              <span aria-hidden className="relative [&_svg]:size-3.5">
                {option.icon}
              </span>
            ) : null}
            <span className="relative">{option.label}</span>
            {option.suffix !== undefined ? <span className="relative">{option.suffix}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
