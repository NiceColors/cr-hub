import {
  CompassIcon,
  GitPullRequestIcon,
  LayoutDashboardIcon,
  NotebookPenIcon,
  Settings2Icon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { ENABLE_LEAD_VIEW } from "@/lib/features";
import type { Profile } from "@/lib/profile";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  shortcut: string;
};

const QUEUE: NavItem = { title: "Fila de CRs", href: "/", icon: GitPullRequestIcon, shortcut: "G F" };
const BENCH: NavItem = { title: "Homologação", href: "/revisao", icon: NotebookPenIcon, shortcut: "G H" };
const DASHBOARD: NavItem = { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon, shortcut: "G D" };
const TEAM: NavItem = { title: "Equipe", href: "/equipe", icon: UsersRoundIcon, shortcut: "G E" };
const CONFIG: NavItem = { title: "Configuração", href: "/config", icon: Settings2Icon, shortcut: "G C" };
const LEAD: NavItem = { title: "Painel do líder", href: "/lideranca", icon: CompassIcon, shortcut: "G L" };

export const NAV_ITEMS: readonly NavItem[] = [QUEUE, BENCH, DASHBOARD, TEAM, CONFIG];

const LEAD_NAV_ITEMS: readonly NavItem[] = [LEAD, QUEUE, DASHBOARD, TEAM, CONFIG];

/** Itens do menu do perfil. Atalhos de todas as rotas seguem valendo nos dois perfis. */
export function navItemsFor(profile: Profile): readonly NavItem[] {
  if (!ENABLE_LEAD_VIEW) return NAV_ITEMS;
  return profile === "lead" ? LEAD_NAV_ITEMS : NAV_ITEMS;
}

/** Rotas com atalho. Sem a visão de líder, `G L` deixa de existir. */
export const ALL_NAV_ITEMS: readonly NavItem[] = ENABLE_LEAD_VIEW ? [LEAD, ...NAV_ITEMS] : NAV_ITEMS;

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
