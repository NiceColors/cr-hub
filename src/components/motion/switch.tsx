"use client";
// beui.dev/components/motion/switch

import { animate, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Heavy, deliberate thumb — high mass keeps the travel weighty without wobble.
const THUMB_SPRING = { type: "spring", stiffness: 800, damping: 80, mass: 4 } as const;

const SIZE = {
  sm: { track: "h-5 w-9 px-0.5", thumb: "size-4" },
  md: { track: "h-7 w-12 px-1", thumb: "size-5" },
} as const;

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  /** Supporting text under the label, announced as the description. */
  description?: string;
  size?: keyof typeof SIZE;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  size = "md",
  className,
  id: idProp,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: SwitchProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const thumbRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [isPressed, setIsPressed] = useState(false);
  const [isPointer, setIsPointer] = useState(false);
  const descriptionId = description ? `${id}-description` : undefined;
  const describedBy = [ariaDescribedBy, descriptionId].filter(Boolean).join(" ") || undefined;

  // Disabled shake feedback when pressed.
  useEffect(() => {
    if (!thumbRef.current || reduce) return;
    if (disabled && isPressed) {
      animate(
        thumbRef.current,
        { x: [0, -2, 2, -1, 0] },
        { delay: 0.2, duration: 0.6 },
      );
    }
  }, [disabled, isPressed, reduce]);

  const squish = !disabled && isPointer && isPressed && !reduce;

  return (
    <MotionConfig transition={reduce ? { duration: 0 } : THUMB_SPRING}>
      <span
        className={cn(
          "inline-flex gap-3",
          description ? "items-start" : "items-center",
          className,
        )}
      >
        <motion.button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => !disabled && onCheckedChange(!checked)}
          onPointerDown={(e) => {
            setIsPressed(true);
            setIsPointer(e.type.startsWith("pointer"));
          }}
          onPointerUp={() => setIsPressed(false)}
          onPointerLeave={() => setIsPressed(false)}
          initial={false}
          data-state={checked ? "checked" : "unchecked"}
          className={cn(
            "group peer inline-flex shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors duration-200",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-60",
            SIZE[size].track,
            checked ? "justify-end bg-primary" : "justify-start bg-muted-foreground/40",
          )}
        >
          <motion.div
            ref={thumbRef}
            layout
            animate={{ scale: squish ? 0.9 : 1 }}
            className={cn(
              "pointer-events-none block rounded-full bg-background shadow-md",
              SIZE[size].thumb,
            )}
          >
            {/* Stretch toward the destination while active. */}
            <div
              className={cn(
                SIZE[size].thumb,
                squish && (checked ? "ml-1" : "mr-1"),
              )}
            />
          </motion.div>
        </motion.button>
        {label || description ? (
          <span className={cn("flex min-w-0 flex-col gap-0.5", disabled && "opacity-60")}>
            {label ? (
              <label
                htmlFor={id}
                className={cn(
                  "text-sm text-foreground select-none",
                  disabled ? "cursor-not-allowed" : "cursor-pointer",
                )}
              >
                {label}
              </label>
            ) : null}
            {description ? (
              <span id={descriptionId} className="text-xs text-muted-foreground">
                {description}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </MotionConfig>
  );
}
