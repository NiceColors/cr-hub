"use client";

import { useId, useState, type ReactNode } from "react";
import { ChartColumnIcon, HistoryIcon, TableIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ChartState = "loading" | "empty" | "ready";

export const HISTORY_EMPTY = {
  title: "Ainda não há histórico",
  description:
    "O histórico é gravado a cada atualização da fila com o Bitbucket. Os gráficos aparecem depois das primeiras atualizações.",
};

export function chartState(isLoading: boolean, hasData: boolean): ChartState {
  if (isLoading) return "loading";
  return hasData ? "ready" : "empty";
}

/**
 * Moldura comum dos gráficos do dashboard: skeleton enquanto carrega, estado
 * vazio, resumo no `aria-label` e a alternância para tabela.
 */
export function ChartCard({
  title,
  description,
  state,
  summary,
  table,
  empty,
  actions,
  bodyClassName = "min-h-80",
  className,
  children,
}: {
  title: string;
  description: ReactNode;
  /** Controles do gráfico, ao lado de "Ver como tabela". */
  actions?: ReactNode;
  state: ChartState;
  /** Frase que resume o gráfico para leitores de tela. */
  summary: string;
  table: ReactNode;
  empty: { title: string; description: ReactNode; icon?: LucideIcon };
  /** Altura reservada para skeleton e vazio, igual à do gráfico pronto. */
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  const EmptyIcon = empty.icon ?? HistoryIcon;

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={state === "loading"}
      className={cn("flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
          <h2 id={titleId} className="text-sm font-medium">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {state === "ready" ? (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={asTable}
              aria-label="Ver como tabela"
              title={asTable ? "Voltar ao gráfico" : "Ver como tabela"}
              onClick={() => setAsTable((v) => !v)}
              className={cn("shrink-0", asTable && "bg-muted text-foreground")}
            >
              {asTable ? (
                <ChartColumnIcon aria-hidden className="size-3.5" />
              ) : (
                <TableIcon aria-hidden className="size-3.5" />
              )}
              <span aria-hidden className="hidden sm:inline">
                Tabela
              </span>
            </Button>
          ) : null}
        </div>
      </header>

      {state === "loading" ? (
        <div role="status" className={cn("flex flex-col gap-3", bodyClassName)}>
          <span className="sr-only">Carregando {title.toLowerCase()}</span>
          <Skeleton aria-hidden className="w-full flex-1 rounded-xl" />
          <div aria-hidden className="flex gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ) : state === "empty" ? (
        <Empty className={cn("border", bodyClassName)}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <EmptyIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{empty.title}</EmptyTitle>
            <EmptyDescription>{empty.description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : asTable ? (
        table
      ) : (
        <figure role="group" aria-label={summary} className="m-0 min-w-0">
          {children}
        </figure>
      )}
    </section>
  );
}

export type DataColumn<T> = {
  key: string;
  header: string;
  numeric?: boolean;
  cell: (row: T) => ReactNode;
};

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return (
    <div className="max-h-80 overflow-auto rounded-xl border">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-card">
          <tr className="border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-3 py-2 font-medium whitespace-nowrap text-muted-foreground",
                  column.numeric ? "text-right" : "text-left",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b last:border-b-0">
              {columns.map((column, i) => {
                const Cell = i === 0 ? "th" : "td";
                return (
                  <Cell
                    key={column.key}
                    scope={i === 0 ? "row" : undefined}
                    className={cn(
                      "px-3 py-1.5 font-normal whitespace-nowrap tabular-nums",
                      column.numeric ? "text-right font-mono" : "text-left",
                    )}
                  >
                    {column.cell(row)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
