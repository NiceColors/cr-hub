import { GitPullRequestIcon, Settings2Icon, type LucideIcon } from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  shortcut: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { title: "Fila de CRs", href: "/", icon: GitPullRequestIcon, shortcut: "G F" },
  { title: "Configuração", href: "/config", icon: Settings2Icon, shortcut: "G C" },
];

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
