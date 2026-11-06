import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  actionsOnTitleRow = false,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Título à esquerda e ações à direita, na mesma linha. */
  actionsOnTitleRow?: boolean;
}) {
  const actionCluster = actions ? (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2",
        actionsOnTitleRow && "ml-auto justify-end",
      )}
    >
      {actions}
    </div>
  ) : null;

  if (actionsOnTitleRow) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {actionCluster}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actionCluster}
    </div>
  );
}
