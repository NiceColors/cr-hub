"use client";

import {
  AnimatedSidebarInset,
  AnimatedSidebarProvider,
} from "@/components/motion/animated-sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function persistSidebarState(open: boolean) {
  document.cookie = `sidebar_state=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
}

export function AppShell({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatedSidebarProvider defaultOpen={defaultOpen} onOpenChange={persistSidebarState}>
      <AppSidebar />
      <AnimatedSidebarInset>
        <AppHeader />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </AnimatedSidebarInset>
    </AnimatedSidebarProvider>
  );
}
