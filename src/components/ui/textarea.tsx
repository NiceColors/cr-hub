import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Campo de texto multilinha no mesmo visual do Input: borda, foco e rótulo. */
export function Textarea({
  label,
  hint,
  id: idProp,
  className,
  ...props
}: ComponentProps<"textarea"> & { label?: string; hint?: string }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const field = (
    <textarea
      id={id}
      aria-describedby={hintId}
      {...props}
      className={cn(
        "min-h-20 w-full resize-y rounded-2xl border border-border bg-transparent px-3.5 py-2.5 text-sm text-foreground",
        "transition-colors duration-200 placeholder:text-muted-foreground hover:border-border-strong",
        "outline-none focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
  if (!label && !hint) return field;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      {field}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
