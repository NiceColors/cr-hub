import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import type { AgeBand, ReviewState } from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

const REVIEW_STATE: Record<
  ReviewState,
  { label: string; variant: "success" | "destructive" | "info" | "secondary" }
> = {
  approved: { label: "Aprovado", variant: "success" },
  changes_requested: { label: "Mudanças pedidas", variant: "destructive" },
  in_review: { label: "Em revisão", variant: "info" },
  waiting: { label: "Aguardando", variant: "secondary" },
};

export function ReviewStateBadge({ state }: { state: ReviewState }) {
  const { label, variant } = REVIEW_STATE[state];
  return <Badge variant={variant}>{label}</Badge>;
}

export function AgeIndicator({ band }: { band: AgeBand }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        band === "critical" && "bg-destructive",
        band === "warning" && "bg-warning",
        band === "normal" && "bg-muted-foreground/40",
      )}
    />
  );
}

const SEGMENT_STAGGER_MS = 30;

export function ApprovalsMeter({
  approvals,
  required,
}: {
  approvals: number;
  required: number;
}) {
  const segments = Math.max(required, 1);
  const met = approvals >= required;
  return (
    <div
      className="flex items-center gap-2"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={segments}
      aria-valuenow={Math.min(approvals, segments)}
      aria-label={`${approvals} de ${required} aprovações`}
    >
      {/* Fills stagger 30ms apart; the success color waits for the last
          segment so every segment turns at once. */}
      <div
        className="flex gap-0.5"
        style={{ "--meter-met-delay": `${(segments - 1) * SEGMENT_STAGGER_MS}ms` } as CSSProperties}
      >
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className="relative h-1.5 w-3 overflow-hidden rounded-full bg-secondary">
            <span
              data-filled={i < approvals || undefined}
              data-met={met || undefined}
              style={{ "--meter-delay": `${i * SEGMENT_STAGGER_MS}ms` } as CSSProperties}
              className={cn(
                "absolute inset-0 origin-left scale-x-0 rounded-full bg-primary opacity-0",
                "transition-[scale,opacity,background-color] duration-base ease-out",
                "[transition-delay:var(--meter-delay),var(--meter-delay),var(--meter-met-delay)]",
                "data-filled:scale-x-100 data-filled:opacity-100 data-met:bg-success",
              )}
            />
          </span>
        ))}
      </div>
      <span
        className={cn(
          "font-mono text-xs tabular-nums transition-colors duration-base ease-out",
          met ? "text-success-foreground" : "text-muted-foreground",
        )}
      >
        {approvals}/{required}
      </span>
    </div>
  );
}
