"use client";

import { createContext, use, useId, useState } from "react";
import {
  ArrowUpRightIcon,
  BellIcon,
  BellOffIcon,
  EllipsisIcon,
  PanelRightOpenIcon,
  UserPlusIcon,
} from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { CenterMorphModal, CenterMorphModalContent } from "@/components/motion/center-morph-modal";
import { Input } from "@/components/motion/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isReviewerOrAuthor, type SnoozeKind } from "@/domain/pull-request";
import {
  SNOOZE_LABELS,
  useAddMeAsReviewer,
  useSnooze,
  type PullRequestItem,
} from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";

type PullRequestActionsValue = {
  meUuid: string | null;
  openPreview: (pr: PullRequestItem) => void;
  openSnooze: (pr: PullRequestItem) => void;
};

const PullRequestActionsContext = createContext<PullRequestActionsValue | null>(null);

export function usePullRequestActions() {
  const ctx = use(PullRequestActionsContext);
  if (!ctx) throw new Error("usePullRequestActions must be used within PullRequestActionsProvider");
  return ctx;
}

/** Estado das ações por linha (preview e silenciar), compartilhado entre a tabela e o drawer. */
export function PullRequestActionsProvider({
  meUuid,
  onOpenPreview,
  children,
}: {
  meUuid: string | null;
  onOpenPreview: (pr: PullRequestItem) => void;
  children: React.ReactNode;
}) {
  const [snoozeTarget, setSnoozeTarget] = useState<PullRequestItem | null>(null);
  return (
    <PullRequestActionsContext
      value={{ meUuid, openPreview: onOpenPreview, openSnooze: setSnoozeTarget }}
    >
      {children}
      <SnoozeDialog pr={snoozeTarget} onClose={() => setSnoozeTarget(null)} />
    </PullRequestActionsContext>
  );
}

export function canAddMeAsReviewer(pr: PullRequestItem, meUuid: string | null) {
  return Boolean(meUuid) && !isReviewerOrAuthor(pr, meUuid);
}

export function PullRequestRowMenu({ pr }: { pr: PullRequestItem }) {
  const { meUuid, openPreview, openSnooze } = usePullRequestActions();
  const snooze = useSnooze();
  const addMe = useAddMeAsReviewer();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Ações para ${pr.repository.slug} #${pr.id}`}
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none data-popup-open:bg-muted"
      >
        <EllipsisIcon aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => openPreview(pr)}>
          <PanelRightOpenIcon />
          Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(pr.url, "_blank", "noopener,noreferrer")}>
          <ArrowUpRightIcon />
          Abrir no Bitbucket
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {pr.snooze ? (
          <DropdownMenuItem onClick={() => snooze.clear.mutate(pr)}>
            <BellIcon />
            Remover silêncio
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => openSnooze(pr)}>
            <BellOffIcon />
            Silenciar…
          </DropdownMenuItem>
        )}
        {canAddMeAsReviewer(pr, meUuid) ? (
          <DropdownMenuItem disabled={addMe.isPending} onClick={() => addMe.mutate(pr)}>
            <UserPlusIcon />
            Me adicionar como revisor
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const REASON_PRESETS = [
  "Aguardando deploy",
  "Aguardando outro PR",
  "Bloqueado por dependência",
  "Fora do meu escopo agora",
];

const SNOOZE_KINDS: SnoozeKind[] = ["24h", "tomorrow", "until_change"];

function SnoozeForm({ pr, onClose }: { pr: PullRequestItem; onClose: () => void }) {
  const { set } = useSnooze();
  const descriptionId = useId();
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<SnoozeKind>("24h");
  const [touched, setTouched] = useState(false);
  const error = touched && !reason.trim() ? "Informe o motivo." : undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!reason.trim()) return;
    set.mutate({ pr, reason: reason.trim(), kind }, { onSuccess: onClose });
  }

  return (
    <form onSubmit={submit} aria-describedby={descriptionId} className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1 pr-10">
        <h2 className="text-lg font-semibold">Silenciar PR</h2>
        <p id={descriptionId} className="text-sm text-muted-foreground">
          <span className="font-mono">
            {pr.repository.slug} #{pr.id}
          </span>{" "}
          sai do contador, do badge e das notificações até o silêncio vencer.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Input
          label="Motivo"
          value={reason}
          onChange={setReason}
          onBlur={() => setTouched(true)}
          placeholder="Ex.: aguardando deploy da API"
          maxLength={200}
          error={error}
          classNames={{ input: "text-sm" }}
        />
        <div className="flex flex-wrap gap-1.5">
          {REASON_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setReason(preset)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Duração</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {SNOOZE_KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-center text-sm transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
                kind === k
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
            >
              <input
                type="radio"
                name="snooze-kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              {SNOOZE_LABELS[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={set.isPending}>
          <BellOffIcon />
          Silenciar
        </Button>
      </div>
    </form>
  );
}

function SnoozeDialog({ pr, onClose }: { pr: PullRequestItem | null; onClose: () => void }) {
  return (
    <CenterMorphModal open={pr !== null} onOpenChange={(open) => !open && onClose()}>
      <CenterMorphModalContent ariaLabel="Silenciar PR" closeButtonLabel="Fechar" className="max-w-lg">
        {pr ? <SnoozeForm key={`${pr.repository.uuid}:${pr.id}`} pr={pr} onClose={onClose} /> : null}
      </CenterMorphModalContent>
    </CenterMorphModal>
  );
}
