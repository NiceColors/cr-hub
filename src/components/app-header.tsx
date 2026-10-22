"use client";

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
import { useCommandMenu } from "@/components/command-menu";
import { NAV_ITEMS, isActivePath } from "@/components/nav-items";

export function AppHeader() {
  const pathname = usePathname();
  const { setOpen } = useCommandMenu();
  const current = NAV_ITEMS.find((item) => isActivePath(pathname, item.href));

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
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
