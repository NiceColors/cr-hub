"use client";

import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import { Tooltip } from "@/components/motion/tooltip";
import {
  HEALTH_LABELS,
  RISK_DESCRIPTIONS,
  RISK_LABELS,
  RISK_SEVERITY,
  type HealthStatus,
  type RiskKind,
  type RiskSeverity,
} from "@/domain/lead";
import { cn } from "@/lib/utils";

const SEVERITY_STATUS: Record<RiskSeverity, AnimatedBadgeStatus> = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
};

const HEALTH_STATUS: Record<HealthStatus, AnimatedBadgeStatus> = {
  ok: "success",
  attention: "warning",
  critical: "danger",
};

export function RiskBadge({ kind, tooltip = true }: { kind: RiskKind; tooltip?: boolean }) {
  const badge = (
    <AnimatedBadge size="sm" status={SEVERITY_STATUS[RISK_SEVERITY[kind]]} showIcon={false}>
      {RISK_LABELS[kind]}
    </AnimatedBadge>
  );
  return tooltip ? <Tooltip content={RISK_DESCRIPTIONS[kind]}>{badge}</Tooltip> : badge;
}

/**
 * Chips dos sinais de risco, do mais grave para o menos. Sem `tooltip` dentro
 * de superfícies que já são um botão, para não aninhar controles.
 */
export function RiskBadges({
  risks,
  max = 3,
  tooltip = true,
  className,
}: {
  risks: readonly RiskKind[];
  max?: number;
  tooltip?: boolean;
  className?: string;
}) {
  if (risks.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Sem riscos</span>;
  }
  const shown = risks.slice(0, max);
  const rest = risks.slice(max);
  const more =
    rest.length > 0 ? (
      <AnimatedBadge size="sm" status="neutral" showIcon={false}>
        +{rest.length}
      </AnimatedBadge>
    ) : null;
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((kind) => (
        <RiskBadge key={kind} kind={kind} tooltip={tooltip} />
      ))}
      {more && tooltip ? (
        <Tooltip content={rest.map((k) => RISK_LABELS[k]).join(", ")}>{more}</Tooltip>
      ) : (
        more
      )}
    </span>
  );
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <AnimatedBadge
      size="sm"
      status={HEALTH_STATUS[status]}
      contentKey={status}
      pulse={status === "critical"}
    >
      {HEALTH_LABELS[status]}
    </AnimatedBadge>
  );
}

/** Cores da saúde, usadas no histórico diário dos times. */
export const HEALTH_COLORS: Record<HealthStatus, string> = {
  ok: "var(--success)",
  attention: "var(--warning)",
  critical: "var(--destructive)",
};
