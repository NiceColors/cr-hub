"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Kbd } from "@/components/ui/kbd";
import { useCommandMenu } from "@/components/command-menu";
import { TokenStatus } from "@/components/token-status";
import { NAV_ITEMS, isActivePath } from "@/components/nav-items";

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpen } = useCommandMenu();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              tooltip="CR Tracker"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary font-mono text-xs font-semibold text-primary-foreground">
                CR
              </div>
              <div className="grid flex-1 text-left leading-tight whitespace-nowrap transition-opacity duration-base ease-in-out group-data-[collapsible=icon]:opacity-0">
                <span className="truncate text-sm font-semibold">CR Tracker</span>
                <span className="truncate text-xs text-muted-foreground">
                  Bitbucket Cloud
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Buscar comandos"
                  onClick={() => setOpen(true)}
                  className="text-muted-foreground"
                >
                  <SearchIcon />
                  <span>Buscar</span>
                  <Kbd className="ml-auto transition-opacity duration-base ease-in-out group-data-[collapsible=icon]:opacity-0">
                    ⌘K
                  </Kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActivePath(pathname, item.href)}
                    tooltip={item.title}
                    render={
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      />
                    }
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <TokenStatus />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
