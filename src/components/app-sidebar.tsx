"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BookmarkIcon, SearchIcon } from "lucide-react";
import {
  AnimatedSidebar,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupContent,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarRail,
} from "@/components/motion/animated-sidebar";
import { useCommandMenu } from "@/components/command-menu";
import { TokenStatus } from "@/components/token-status";
import { navItemsFor, isActivePath } from "@/components/nav-items";
import { useProfile } from "@/components/profile-provider";
import { ProfileSwitch } from "@/components/profile-switch";
import { useAwaitingReview } from "@/hooks/use-awaiting-review";
import { useSavedViews } from "@/hooks/use-config";
import { useHydrated } from "@/hooks/use-hydrated";
import { useShortcutLabel } from "@/hooks/use-shortcut-label";
import { ENABLE_LEAD_VIEW } from "@/lib/features";
import { PROFILE_HOME } from "@/lib/profile";

function CountBadge({ count, label, tone }: { count: number; label: string; tone: "primary" | "destructive" }) {
  const hydrated = useHydrated();
  if (!hydrated || count === 0) return null;
  return (
    <span
      className={
        tone === "primary"
          ? "rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground tabular-nums"
          : "rounded-full bg-destructive px-1.5 font-mono text-[10px] text-on-destructive tabular-nums"
      }
      aria-label={label}
    >
      {count}
    </span>
  );
}

function AwaitingBadge() {
  const { count } = useAwaitingReview();
  return <CountBadge count={count} label={`${count} esperando sua revisão`} tone="primary" />;
}

function CriticalBadge() {
  const { criticalCount } = useAwaitingReview();
  return (
    <CountBadge count={criticalCount} label={`${criticalCount} PRs acima do SLA crítico`} tone="destructive" />
  );
}

function badgeFor(href: string, profile: "dev" | "lead") {
  if (profile === "dev" && href === "/") return <AwaitingBadge />;
  if (ENABLE_LEAD_VIEW && profile === "lead" && href === "/lideranca") return <CriticalBadge />;
  return undefined;
}

function NavGroup({ activeViewId }: { activeViewId: number | null }) {
  const pathname = usePathname();
  const { profile } = useProfile();
  return (
    <AnimatedSidebarMenu>
      {navItemsFor(profile).map((item) => (
        <AnimatedSidebarMenuItem key={item.href}>
          <AnimatedSidebarMenuButton
            href={item.href}
            isActive={isActivePath(pathname, item.href) && activeViewId === null}
            icon={<item.icon className="size-4" />}
            badge={badgeFor(item.href, profile)}
          >
            {item.title}
          </AnimatedSidebarMenuButton>
        </AnimatedSidebarMenuItem>
      ))}
    </AnimatedSidebarMenu>
  );
}

function ViewsGroup({ activeViewId }: { activeViewId: number | null }) {
  const hydrated = useHydrated();
  const views = useSavedViews().data?.views ?? [];
  if (!hydrated || views.length === 0) return null;
  return (
    <AnimatedSidebarGroup>
      <AnimatedSidebarGroupLabel>Visões</AnimatedSidebarGroupLabel>
      <AnimatedSidebarGroupContent>
        <AnimatedSidebarMenu>
          {views.map((view) => (
            <AnimatedSidebarMenuItem key={view.id}>
              <AnimatedSidebarMenuButton
                href={`/?view=${view.id}`}
                isActive={activeViewId === view.id}
                icon={<BookmarkIcon className="size-4" />}
              >
                {view.name}
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
          ))}
        </AnimatedSidebarMenu>
      </AnimatedSidebarGroupContent>
    </AnimatedSidebarGroup>
  );
}

function useActiveViewId() {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  return pathname === "/" && view && /^\d+$/.test(view) ? Number(view) : null;
}

function SidebarNavigation() {
  const activeViewId = useActiveViewId();
  return (
    <>
      <AnimatedSidebarGroup>
        <AnimatedSidebarGroupLabel>Navegação</AnimatedSidebarGroupLabel>
        <AnimatedSidebarGroupContent>
          <NavGroup activeViewId={activeViewId} />
        </AnimatedSidebarGroupContent>
      </AnimatedSidebarGroup>
      <ViewsGroup activeViewId={activeViewId} />
    </>
  );
}

export function AppSidebar() {
  const { setOpen } = useCommandMenu();
  const { profile } = useProfile();
  const shortcut = useShortcutLabel("K");

  return (
    <AnimatedSidebar collapsible="icon" ariaLabel="Navegação principal">
      <AnimatedSidebarHeader>
        <AnimatedSidebarMenu>
          <AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuButton
              href={PROFILE_HOME[profile]}
              icon={
                <span className="flex size-6 items-center justify-center rounded-md bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
                  CR
                </span>
              }
              badge={<span className="text-[10px]">Bitbucket</span>}
              className="font-semibold text-foreground"
            >
              CR Tracker
            </AnimatedSidebarMenuButton>
          </AnimatedSidebarMenuItem>
        </AnimatedSidebarMenu>
      </AnimatedSidebarHeader>

      <AnimatedSidebarContent>
        <AnimatedSidebarGroup>
          <AnimatedSidebarGroupContent>
            <AnimatedSidebarMenu>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  icon={<SearchIcon className="size-4" />}
                  badge={
                    <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">{shortcut}</kbd>
                  }
                  onSelect={() => setOpen(true)}
                >
                  Buscar
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>

        <Suspense
          fallback={
            <AnimatedSidebarGroup>
              <AnimatedSidebarGroupLabel>Navegação</AnimatedSidebarGroupLabel>
              <AnimatedSidebarGroupContent>
                <NavGroup activeViewId={null} />
              </AnimatedSidebarGroupContent>
            </AnimatedSidebarGroup>
          }
        >
          <SidebarNavigation />
        </Suspense>
      </AnimatedSidebarContent>

      <AnimatedSidebarFooter>
        <ProfileSwitch />
        <TokenStatus />
      </AnimatedSidebarFooter>
      <AnimatedSidebarRail aria-label="Recolher ou expandir menu" />
    </AnimatedSidebar>
  );
}
