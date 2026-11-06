"use client";

import { Trash2Icon } from "lucide-react";
import { HoldActionButton } from "@/components/motion/hold-action-button";
import { cn } from "@/lib/utils";

/**
 * Exclusão sem diálogo de confirmação: segurar o botão (ou Enter/Espaço) até
 * a barra encher confirma; soltar antes cancela.
 */
export function HoldToDelete({
  label,
  itemName,
  onDelete,
  disabled,
  className,
}: {
  label: string;
  /** Nome do item, para o rótulo acessível. */
  itemName: string;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <HoldActionButton
      type="horizontal"
      holdDuration={1200}
      disabled={disabled}
      onHoldComplete={onDelete}
      aria-label={`Segure para excluir ${itemName}`}
      holdingLabel="Segure…"
      completeLabel="Excluindo"
      className={cn(
        "h-8 min-w-0 px-3 text-on-destructive [--hold-fill:var(--destructive)] [--hold-radius:9999px]",
        "bg-destructive/10 focus-visible:ring-destructive",
        className,
      )}
      labelClassName="text-xs font-medium [&>span:first-child]:text-destructive-foreground"
    >
      <span className="inline-flex items-center gap-1.5">
        <Trash2Icon aria-hidden className="size-3.5" />
        {label}
      </span>
    </HoldActionButton>
  );
}
