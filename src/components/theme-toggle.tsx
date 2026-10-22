"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ThemeToggle as BeuiThemeToggle } from "@/components/motion/theme-toggle";

export const THEME_OPTIONS = [
  { value: "dark", label: "Escuro", icon: MoonIcon },
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  return (
    <BeuiThemeToggle
      variant="circle"
      start="top-right"
      title="Alternar tema"
      aria-label="Alternar entre tema claro e escuro"
      className="size-8 rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      iconClassName="size-4"
    />
  );
}
