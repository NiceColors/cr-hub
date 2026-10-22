import { Skeleton } from "@/components/ui/skeleton";
import type { PullRequestItem } from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: number;
  hint: string;
  tone?: "warning" | "destructive" | "success";
};

function computeStats(prs: PullRequestItem[]): Stat[] {
  let over24 = 0;
  let over72 = 0;
  let approved = 0;
  for (const pr of prs) {
    if (pr.ageBand !== "normal") over24++;
    if (pr.ageBand === "critical") over72++;
    if (pr.reviewState === "approved") approved++;
  }
  return [
    { label: "Abertos", value: prs.length, hint: "no filtro atual" },
    { label: "Acima de 24h", value: over24, hint: "precisam de atenção", tone: "warning" },
    { label: "Acima de 72h", value: over72, hint: "críticos", tone: "destructive" },
    { label: "Aprovados", value: approved, hint: "prontos para merge", tone: "success" },
  ];
}

export function PullRequestStats({
  pullRequests,
  isLoading,
}: {
  pullRequests: PullRequestItem[];
  isLoading: boolean;
}) {
  const stats = computeStats(pullRequests);

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card lg:grid-cols-4">
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
              <span
                className={cn(
                  "font-mono text-2xl font-semibold tabular-nums",
                  stat.value > 0 && stat.tone === "warning" && "text-warning-foreground",
                  stat.value > 0 && stat.tone === "destructive" && "text-destructive-foreground",
                  stat.value > 0 && stat.tone === "success" && "text-success-foreground",
                )}
              >
                {stat.value}
              </span>
            )}
            <span className="truncate text-xs text-muted-foreground">{stat.hint}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
