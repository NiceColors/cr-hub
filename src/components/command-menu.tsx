"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { RefreshCwIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/components/nav-items";
import { THEME_OPTIONS } from "@/components/theme-toggle";
import { DURATION, EASE_OUT } from "@/components/motion/tokens";
import { queryKeys } from "@/lib/query-keys";

type CommandMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export function useCommandMenu() {
  const ctx = useContext(CommandMenuContext);
  if (!ctx) throw new Error("useCommandMenu must be used within CommandMenuProvider");
  return ctx;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (pendingG) {
        pendingG = false;
        clearTimeout(timer);
        const item = NAV_ITEMS.find((i) => i.shortcut === `G ${key.toUpperCase()}`);
        if (item) {
          event.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (key === "g") {
        pendingG = true;
        timer = setTimeout(() => (pendingG = false), 800);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, [router]);

  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      <CommandMenu />
    </CommandMenuContext.Provider>
  );
}

function CommandMenu() {
  const { open, setOpen } = useCommandMenu();

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Paleta de comandos"
      description="Navegue ou execute uma ação"
    >
      <CommandPalette onDone={() => setOpen(false)} />
    </CommandDialog>
  );
}

/** Mounted with the dialog content, so the active item resets on every open. */
function CommandPalette({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  const [active, setActive] = useState("");

  function run(action: () => void) {
    onDone();
    action();
  }

  return (
    <Command value={active} onValueChange={setActive}>
      <CommandInput placeholder="Digite um comando ou busque…" />
      <CommandList>
        <CommandEmpty>Nenhum comando encontrado.</CommandEmpty>
        <CommandGroup heading="Navegação">
          {NAV_ITEMS.map((item) => (
            <PaletteItem
              key={item.href}
              value={item.title}
              active={active}
              onSelect={() => run(() => router.push(item.href))}
            >
              <item.icon />
              {item.title}
              <CommandShortcut>{item.shortcut}</CommandShortcut>
            </PaletteItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações">
          <PaletteItem
            value="Recarregar fila de PRs"
            active={active}
            onSelect={() =>
              run(() => void queryClient.refetchQueries({ queryKey: queryKeys.pullRequests }))
            }
          >
            <RefreshCwIcon />
            Recarregar fila de PRs
          </PaletteItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tema">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <PaletteItem
              key={value}
              value={`Tema ${label}`}
              active={active}
              onSelect={() => run(() => setTheme(value))}
            >
              <Icon />
              Tema {label.toLowerCase()}
            </PaletteItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

const HIGHLIGHT_TRANSITION = { duration: DURATION.fast, ease: EASE_OUT };

/** The active item's background is one shared element that slides between items. */
function PaletteItem({
  value,
  active,
  children,
  ...props
}: React.ComponentProps<typeof CommandItem> & { value: string; active: string }) {
  return (
    <CommandItem value={value} className="isolate data-selected:bg-transparent" {...props}>
      {active === value ? (
        <motion.span
          layoutId="command-menu-highlight"
          aria-hidden
          className="absolute inset-0 -z-10 rounded-lg bg-muted"
          transition={HIGHLIGHT_TRANSITION}
        />
      ) : null}
      {children}
    </CommandItem>
  );
}
