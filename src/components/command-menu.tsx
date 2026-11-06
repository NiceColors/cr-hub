"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { BookmarkIcon, PaletteIcon, RefreshCwIcon, RepeatIcon } from "lucide-react";
import { CommandPalette, type CommandItem } from "@/components/motion/command-palette";
import { ALL_NAV_ITEMS, navItemsFor } from "@/components/nav-items";
import { useProfile } from "@/components/profile-provider";
import { ENABLE_LEAD_VIEW } from "@/lib/features";
import { PROFILE_LABELS, type Profile } from "@/lib/profile";
import { useSavedViews } from "@/hooks/use-config";
import { THEME_OPTIONS } from "@/components/theme-toggle";
import { applyPalette, PALETTES } from "@/lib/palette";
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
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (pendingG) {
        pendingG = false;
        clearTimeout(timer);
        const item = ALL_NAV_ITEMS.find((i) => i.shortcut === `G ${key.toUpperCase()}`);
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  const views = useSavedViews().data?.views;
  const { profile, setProfile } = useProfile();
  const otherProfile: Profile = profile === "dev" ? "lead" : "dev";

  const items = useMemo<CommandItem[]>(
    () => [
      ...navItemsFor(profile).map((item) => ({
        id: `nav:${item.href}`,
        label: item.title,
        group: "Navegação",
        hint: item.shortcut,
        icon: item.icon,
        onSelect: () => router.push(item.href),
      })),
      ...(views ?? []).map((view) => ({
        id: `view:${view.id}`,
        label: view.name,
        group: "Visões",
        keywords: ["visão", "filtro"],
        icon: BookmarkIcon,
        onSelect: () => router.push(`/?view=${view.id}`),
      })),
      {
        id: "action:refresh",
        label: "Recarregar fila de PRs",
        group: "Ações",
        keywords: ["atualizar", "refresh"],
        icon: RefreshCwIcon,
        onSelect: () => void queryClient.refetchQueries({ queryKey: queryKeys.pullRequests }),
      },
      ...(ENABLE_LEAD_VIEW
        ? [
            {
              id: "action:profile",
              label: `Mudar para perfil ${PROFILE_LABELS[otherProfile]}`,
              group: "Ações",
              keywords: ["perfil", "líder", "po", "dev", "modo"],
              icon: RepeatIcon,
              onSelect: () => setProfile(otherProfile),
            },
          ]
        : []),
      ...THEME_OPTIONS.map(({ value, label, icon }) => ({
        id: `theme:${value}`,
        label: `Tema ${label.toLowerCase()}`,
        group: "Tema",
        icon,
        onSelect: () => setTheme(value),
      })),
      ...PALETTES.map(({ id, label }) => ({
        id: `palette:${id}`,
        label: `Paleta ${label.toLowerCase()}`,
        group: "Tema",
        keywords: ["cor", "paleta", label],
        icon: PaletteIcon,
        onSelect: () => applyPalette(id),
      })),
    ],
    [router, queryClient, setTheme, views, profile, otherProfile, setProfile],
  );

  return (
    <CommandPalette
      items={items}
      open={open}
      onOpenChange={setOpen}
      placeholder="Digite um comando ou busque…"
      emptyMessage="Nenhum comando encontrado."
    />
  );
}
