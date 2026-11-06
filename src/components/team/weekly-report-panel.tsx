"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckIcon, ClipboardCopyIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/config/section-header";
import { toIsoDate } from "@/domain/rotation";
import { weekRange, weekStartOf } from "@/domain/weekly-report";
import { useHydrated } from "@/hooks/use-hydrated";
import { getJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/lib/toast";

const reportSchema = z.object({
  weekStart: z.string(),
  markdown: z.string(),
  stats: z.object({
    opened: z.number(),
    closed: z.number(),
    openAtEnd: z.number(),
    firstReviewMedianMs: z.number().nullable(),
    firstReviewSample: z.number(),
  }),
});

const WEEKS_BACK = 6;
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

function weekOptions() {
  const thisMonday = weekStartOf(new Date());
  const [y, m, d] = thisMonday.split("-").map(Number);
  return Array.from({ length: WEEKS_BACK }, (_, i) => {
    const monday = toIsoDate(new Date(y!, m! - 1, d! - 7 * i));
    const { endMs, startMs } = weekRange(monday);
    const range = `${shortDate.format(startMs)} a ${shortDate.format(endMs - 1)}`;
    const label = i === 0 ? `Esta semana (${range})` : i === 1 ? `Semana passada (${range})` : range;
    return { value: monday, label };
  });
}

/** Relatório da semana em Markdown, pronto para colar na retro. */
export function WeeklyReportPanel() {
  const hydrated = useHydrated();
  const options = hydrated ? weekOptions() : [];
  const [selected, setSelected] = useState<string | null>(null);
  // Por padrão a semana passada: a retro costuma olhar a semana que fechou.
  const week = selected ?? options[1]?.value ?? null;
  const [copied, setCopied] = useState(false);

  const report = useQuery({
    queryKey: queryKeys.weeklyReport(week ?? ""),
    queryFn: () => getJson(`/api/reports/weekly?week=${week}`, reportSchema),
    enabled: week !== null,
  });

  async function copy() {
    if (!report.data) return;
    try {
      await navigator.clipboard.writeText(report.data.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  function download() {
    if (!report.data) return;
    const blob = new Blob([report.data.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retro-cr-${report.data.weekStart}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-label="Relatório semanal" className="flex flex-col gap-4">
      <SectionHeader
        title="Relatório para a retro"
        description="PRs mais demorados, mediana até a primeira revisão, ciclos de mudança e o tempo registrado na fila de foco, em Markdown."
        actions={
          <>
            {options.length > 0 && week ? (
              <Select value={week} onValueChange={setSelected} className="z-30 w-60">
                <SelectTrigger className="h-8 py-0">
                  <span className="sr-only">Semana:</span>
                  <SelectValue className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button variant="outline" size="sm" onClick={copy} disabled={!report.data}>
              {copied ? <CheckIcon className="size-3.5" /> : <ClipboardCopyIcon className="size-3.5" />}
              {copied ? "Copiado" : "Copiar Markdown"}
            </Button>
            <Button variant="ghost" size="sm" onClick={download} disabled={!report.data}>
              <DownloadIcon className="size-3.5" />
              Baixar .md
            </Button>
          </>
        }
      />

      {report.isError ? (
        <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Não foi possível gerar o relatório.
        </p>
      ) : !report.data ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <pre
          tabIndex={0}
          aria-label="Prévia do relatório em Markdown"
          className="max-h-96 overflow-auto rounded-2xl border bg-card p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {report.data.markdown}
        </pre>
      )}
    </section>
  );
}
