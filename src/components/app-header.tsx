"use client";

import { usePathname } from "next/navigation";
import { PanelLeftIcon, SearchIcon } from "lucide-react";
import { AnimatedSidebarTrigger } from "@/components/motion/animated-sidebar";
import { Button } from "@/components/motion/button/base";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/motion/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCommandMenu } from "@/components/command-menu";
import { NAV_ITEMS, isActivePath } from "@/components/nav-items";

export function AppHeader() {
  const pathname = usePathname();
  const { setOpen } = useCommandMenu();
  const current = NAV_ITEMS.find((item) => isActivePath(pathname, item.href));

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <AnimatedSidebarTrigger
        aria-label="Alternar menu lateral"
        className="-ml-2 size-8 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      >
        <PanelLeftIcon className="size-4" />
      </AnimatedSidebarTrigger>
      <span aria-hidden className="mr-1 h-4 w-px bg-border" />
      <Breadcrumb className="text-sm">
        <BreadcrumbList>
          <BreadcrumbItem key="workspace" className="hidden md:inline-flex">
            <span className="px-2 font-medium text-muted-foreground">Workspace</span>
          </BreadcrumbItem>
          <BreadcrumbItem key={current?.href ?? "root"}>
            <BreadcrumbSeparator className="hidden md:inline-flex" />
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
          <SearchIcon />
          Buscar comandos…
          <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
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
