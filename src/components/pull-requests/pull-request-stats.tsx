import { AnimatedNumber } from "@/components/motion/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { isReadyToMerge, prKey } from "@/domain/pull-request";
import type { PullRequestInsight, PullRequestItem } from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: number;
  hint: string;
  tone?: "warning" | "destructive" | "success";
};

function computeStats(
  prs: PullRequestItem[],
  insights: Record<string, PullRequestInsight>,
): Stat[] {
  let warning = 0;
  let critical = 0;
  let ready = 0;
  for (const pr of prs) {
    if (pr.ageBand !== "normal") warning++;
    if (pr.ageBand === "critical") critical++;
    if (isReadyToMerge(pr, insights[prKey(pr.repository.uuid, pr.id)]?.build)) ready++;
  }
  return [
    { label: "Abertos", value: prs.length, hint: "no filtro atual" },
    { label: "Acima da atenção", value: warning, hint: "SLA de atenção", tone: "warning" },
    { label: "Críticos", value: critical, hint: "SLA crítico", tone: "destructive" },
    {
      label: "Prontos para merge",
      value: ready,
      hint: "aprovados, sem tarefas",
      tone: "success",
    },
  ];
}

export function PullRequestStats({
  pullRequests,
  insights,
  isLoading,
}: {
  pullRequests: PullRequestItem[];
  insights: Record<string, PullRequestInsight>;
  isLoading: boolean;
}) {
  const stats = computeStats(pullRequests, insights);

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card lg:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            "flex flex-col gap-1 px-4 py-3",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t lg:border-t-0",
            i === 2 && "lg:border-l",
          )}
        >
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="flex items-baseline gap-2">
            {isLoading ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <AnimatedNumber
                value={stat.value}
                duration={0.6}
                className={cn(
                  "font-mono text-2xl font-semibold",
                  stat.value > 0 && stat.tone === "warning" && "text-warning-foreground",
                  stat.value > 0 && stat.tone === "destructive" && "text-destructive-foreground",
                  stat.value > 0 && stat.tone === "success" && "text-success-foreground",
                )}
              />
            )}
            <span className="truncate text-xs text-muted-foreground">{stat.hint}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
