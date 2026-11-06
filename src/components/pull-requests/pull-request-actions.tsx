"use client";

import { createContext, use, useId, useState, type ReactNode } from "react";
import {
  ArrowUpRightIcon,
  BellIcon,
  BellOffIcon,
  EllipsisIcon,
  FolderKanbanIcon,
  GaugeIcon,
  PanelRightOpenIcon,
  PinIcon,
  PinOffIcon,
  UserPlusIcon,
} from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { CenterMorphModal, CenterMorphModalContent } from "@/components/motion/center-morph-modal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/motion/context-menu";
import { Input } from "@/components/motion/input";
import { RadioGroup, RadioGroupItem } from "@/components/motion/radio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COMPLEXITIES,
  isReviewerOrAuthor,
  prKey,
  type Complexity,
  type SnoozeKind,
} from "@/domain/pull-request";
import { FOCUS_LIMIT, useFocus, useFocusActions } from "@/hooks/use-focus";
import {
  COMPLEXITY_LABELS,
  SNOOZE_LABELS,
  useAddMeAsReviewer,
  useComplexity,
  useSnooze,
  type PullRequestItem,
} from "@/hooks/use-pull-requests";
import { COMPLEXITY_ICON } from "@/components/pull-requests/pull-request-badges";
import { AssociatePullRequestDialog } from "@/components/projects/associate-dialog";

type PullRequestActionsValue = {
  meUuid: string | null;
  openPreview: (pr: PullRequestItem) => void;
  openSnooze: (pr: PullRequestItem) => void;
  openAssociate: (pr: PullRequestItem) => void;
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
  const [associateTarget, setAssociateTarget] = useState<PullRequestItem | null>(null);
  return (
    <PullRequestActionsContext
      value={{
        meUuid,
        openPreview: onOpenPreview,
        openSnooze: setSnoozeTarget,
        openAssociate: setAssociateTarget,
      }}
    >
      {children}
      <SnoozeDialog pr={snoozeTarget} onClose={() => setSnoozeTarget(null)} />
      <AssociatePullRequestDialog pr={associateTarget} onClose={() => setAssociateTarget(null)} />
    </PullRequestActionsContext>
  );
}

export function canAddMeAsReviewer(pr: PullRequestItem, meUuid: string | null) {
  return Boolean(meUuid) && !isReviewerOrAuthor(pr, meUuid);
}

/** Estado do PR na fila de foco: fixado (com o item), livre, ou sem vaga. */
export function useFocusState(pr: PullRequestItem) {
  const { items } = useFocus();
  const key = prKey(pr.repository.uuid, pr.id);
  const item = items.find((i) => i.prKey === key) ?? null;
  return { item, full: !item && items.length >= FOCUS_LIMIT };
}

const NO_COMPLEXITY = "none";

function ComplexitySubmenu({ pr }: { pr: PullRequestItem }) {
  const { set, clear } = useComplexity();
  const Icon = pr.complexity ? COMPLEXITY_ICON[pr.complexity] : GaugeIcon;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon />
        Complexidade
        {pr.complexity ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {COMPLEXITY_LABELS[pr.complexity]}
          </span>
        ) : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-40">
        <DropdownMenuRadioGroup
          value={pr.complexity ?? NO_COMPLEXITY}
          onValueChange={(value) => {
            if (value === NO_COMPLEXITY) clear.mutate(pr);
            else set.mutate({ pr, complexity: value as Complexity });
          }}
        >
          {COMPLEXITIES.map((c) => {
            const ItemIcon = COMPLEXITY_ICON[c];
            return (
              <DropdownMenuRadioItem key={c} value={c}>
                <ItemIcon />
                {COMPLEXITY_LABELS[c]}
              </DropdownMenuRadioItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value={NO_COMPLEXITY}>Sem complexidade</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function FocusMenuItem({ pr }: { pr: PullRequestItem }) {
  const { item, full } = useFocusState(pr);
  const { add, remove } = useFocusActions();
  if (item) {
    return (
      <DropdownMenuItem onClick={() => remove.mutate(item.id)}>
        <PinOffIcon />
        Tirar do foco de hoje
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem disabled={full || add.isPending} onClick={() => add.mutate(pr)}>
      <PinIcon />
      {full ? `Foco cheio (${FOCUS_LIMIT}/${FOCUS_LIMIT})` : "Fixar no foco de hoje"}
    </DropdownMenuItem>
  );
}

export function PullRequestRowMenu({ pr }: { pr: PullRequestItem }) {
  const { meUuid, openPreview, openSnooze, openAssociate } = usePullRequestActions();
  const snooze = useSnooze();
  const addMe = useAddMeAsReviewer();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Ações para ${pr.repository.slug} #${pr.id}`}
        render={<Button variant="ghost" size="icon" className="data-popup-open:bg-muted" />}
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
        <DropdownMenuItem onClick={() => openAssociate(pr)}>
          <FolderKanbanIcon />
          Vincular…
        </DropdownMenuItem>
        <ComplexitySubmenu pr={pr} />
        <FocusMenuItem pr={pr} />
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

function rowIdFrom(target: EventTarget | null) {
  return target instanceof Element
    ? (target.closest<HTMLElement>("[data-row-id]")?.dataset.rowId ?? null)
    : null;
}

/**
 * Clique direito, toque longo ou a tecla Menu numa linha da fila abrem as
 * mesmas ações do menu ⋯. No cabeçalho e no vazio da tabela, nenhum menu abre.
 */
export function PullRequestContextMenu({
  resolve,
  children,
}: {
  resolve: (rowId: string) => PullRequestItem | null;
  children: ReactNode;
}) {
  const [pr, setPr] = useState<PullRequestItem | null>(null);
  const pick = (target: EventTarget | null) => {
    const rowId = rowIdFrom(target);
    const found = rowId ? resolve(rowId) : null;
    setPr(found);
    return found;
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          onPointerDown={(event) => {
            const pressToOpen = event.pointerType === "touch" || event.pointerType === "pen";
            if (!pick(event.target) && pressToOpen) event.preventDefault();
          }}
          onContextMenu={(event) => {
            if (!pick(event.target)) event.preventDefault();
          }}
          onKeyDown={(event) => {
            const menuKey = event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
            if (menuKey && !pick(event.target)) event.preventDefault();
          }}
        >
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        ariaLabel={pr ? `Ações para ${pr.repository.slug} #${pr.id}` : "Ações do PR"}
      >
        {pr ? <PullRequestContextItems pr={pr} /> : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function PullRequestContextItems({ pr }: { pr: PullRequestItem }) {
  const { meUuid, openPreview, openSnooze, openAssociate } = usePullRequestActions();
  const snooze = useSnooze();
  const addMe = useAddMeAsReviewer();
  const { set, clear } = useComplexity();
  const { item, full } = useFocusState(pr);
  const focusActions = useFocusActions();

  return (
    <>
      <ContextMenuItem onSelect={() => openPreview(pr)}>
        <PanelRightOpenIcon aria-hidden className="size-4" />
        Ver detalhes
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => window.open(pr.url, "_blank", "noopener,noreferrer")}>
        <ArrowUpRightIcon aria-hidden className="size-4" />
        Abrir no Bitbucket
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => openAssociate(pr)}>
        <FolderKanbanIcon aria-hidden className="size-4" />
        Vincular…
      </ContextMenuItem>
      {item ? (
        <ContextMenuItem onSelect={() => focusActions.remove.mutate(item.id)}>
          <PinOffIcon aria-hidden className="size-4" />
          Tirar do foco de hoje
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          disabled={full || focusActions.add.isPending}
          onSelect={() => focusActions.add.mutate(pr)}
        >
          <PinIcon aria-hidden className="size-4" />
          {full ? `Foco cheio (${FOCUS_LIMIT}/${FOCUS_LIMIT})` : "Fixar no foco de hoje"}
        </ContextMenuItem>
      )}
      {pr.snooze ? (
        <ContextMenuItem onSelect={() => snooze.clear.mutate(pr)}>
          <BellIcon aria-hidden className="size-4" />
          Remover silêncio
        </ContextMenuItem>
      ) : (
        <ContextMenuItem onSelect={() => openSnooze(pr)}>
          <BellOffIcon aria-hidden className="size-4" />
          Silenciar…
        </ContextMenuItem>
      )}
      {canAddMeAsReviewer(pr, meUuid) ? (
        <ContextMenuItem disabled={addMe.isPending} onSelect={() => addMe.mutate(pr)}>
          <UserPlusIcon aria-hidden className="size-4" />
          Me adicionar como revisor
        </ContextMenuItem>
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuLabel>Complexidade</ContextMenuLabel>
      <ContextMenuRadioGroup
        value={pr.complexity ?? NO_COMPLEXITY}
        onValueChange={(value) => {
          if (value === NO_COMPLEXITY) clear.mutate(pr);
          else set.mutate({ pr, complexity: value as Complexity });
        }}
      >
        {COMPLEXITIES.map((c) => (
          <ContextMenuRadioItem key={c} value={c}>
            {COMPLEXITY_LABELS[c]}
          </ContextMenuRadioItem>
        ))}
        <ContextMenuRadioItem value={NO_COMPLEXITY}>Sem complexidade</ContextMenuRadioItem>
      </ContextMenuRadioGroup>
    </>
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
  const durationId = useId();
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

      <div className="flex flex-col gap-2">
        <span id={durationId} className="text-sm font-medium">
          Duração
        </span>
        <RadioGroup
          aria-labelledby={durationId}
          orientation="horizontal"
          value={kind}
          onValueChange={(value) => setKind(value as SnoozeKind)}
          className="gap-x-5 gap-y-2"
        >
          {SNOOZE_KINDS.map((k) => (
            <RadioGroupItem key={k} value={k} label={SNOOZE_LABELS[k]} />
          ))}
        </RadioGroup>
      </div>

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
