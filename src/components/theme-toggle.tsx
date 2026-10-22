"use client";

import { useCallback } from "react";
import { flushSync } from "react-dom";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const THEME_OPTIONS = [
  { value: "dark", label: "Escuro", icon: MoonIcon },
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const;

/**
 * Switches the theme inside a view transition, so light and dark crossfade
 * in --duration-base. Kept under reduced motion (a plain crossfade). Without
 * the View Transitions API the switch is instant.
 */
export function useThemeTransition() {
  const { theme, setTheme } = useTheme();

  return useCallback(
    (next: string) => {
      if (next === theme) return;
      if (typeof document.startViewTransition !== "function") {
        setTheme(next);
        return;
      }
      const { style } = document.documentElement;
      style.setProperty("--root-transition-duration", "var(--duration-base)");
      style.setProperty("--root-transition-ease", "var(--ease-in-out)");
      // next-themes applies the class in an effect; flushSync runs it before
      // the browser captures the new snapshot.
      const transition = document.startViewTransition(() => {
        flushSync(() => setTheme(next));
      });
      transition.finished.finally(() => {
        style.removeProperty("--root-transition-duration");
        style.removeProperty("--root-transition-ease");
      });
    },
    [theme, setTheme],
  );
}

export function ThemeToggle() {
  const { theme } = useTheme();
  const setTheme = useThemeTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Alterar tema" />}
      >
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(String(v))}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
