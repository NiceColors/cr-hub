import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import type { AgeBand, ReviewState } from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

const REVIEW_STATE: Record<ReviewState, { label: string; status: AnimatedBadgeStatus }> = {
  approved: { label: "Aprovado", status: "success" },
  changes_requested: { label: "Mudanças pedidas", status: "danger" },
  in_review: { label: "Em revisão", status: "info" },
  waiting: { label: "Aguardando", status: "neutral" },
};

export function ReviewStateBadge({ state }: { state: ReviewState }) {
  const { label, status } = REVIEW_STATE[state];
  return (
    <AnimatedBadge status={status} size="sm">
      {label}
    </AnimatedBadge>
  );
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
      <div className="flex gap-0.5">
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-3 rounded-full",
              i < approvals ? (met ? "bg-success" : "bg-primary") : "bg-secondary",
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "font-mono text-xs tabular-nums",
          met ? "text-success-foreground" : "text-muted-foreground",
        )}
      >
        {approvals}/{required}
      </span>
    </div>
  );
}
