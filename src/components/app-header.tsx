"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { FetchProgress } from "@/components/fetch-progress";
import { cn } from "@/lib/utils";
import { useCommandMenu } from "@/components/command-menu";
import { NAV_ITEMS, isActivePath } from "@/components/nav-items";

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** Re-renders only when the page crosses the top, not on every scroll event. */
function useScrolledPastTop() {
  return useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 0,
    () => false,
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { setOpen } = useCommandMenu();
  const current = NAV_ITEMS.find((item) => isActivePath(pathname, item.href));
  const scrolled = useScrolledPastTop();

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        "sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 bg-background px-4",
        "transition-[background-color] duration-base ease-out",
        "data-scrolled:bg-background/80 data-scrolled:backdrop-blur-md",
        // The bottom border fades in once content scrolls under the header.
        "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border after:opacity-0 after:transition-opacity after:duration-base after:ease-out data-scrolled:after:opacity-100",
      )}
    >
      <FetchProgress />
      <SidebarTrigger className="-ml-2" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">Workspace</BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>{current?.title ?? "CR Tracker"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="hidden w-56 justify-start text-muted-foreground sm:inline-flex"
        >
          <SearchIcon data-icon="inline-start" />
          Buscar comandos…
          <Kbd className="ml-auto">⌘K</Kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(true)}
          className="sm:hidden"
          aria-label="Buscar comandos"
        >
          <SearchIcon />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
