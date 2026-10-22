import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandMenuProvider } from "@/components/command-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CR Tracker",
  description: "Monitoramento local de Pull Requests abertos no Bitbucket Cloud",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(geistSans.variable, geistMono.variable, "h-full")}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <TooltipProvider delay={200}>
              <CommandMenuProvider>
                <SidebarProvider defaultOpen={sidebarOpen}>
                  <AppSidebar />
                  <SidebarInset>
                    <AppHeader />
                    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
                      {children}
                    </div>
                  </SidebarInset>
                </SidebarProvider>
              </CommandMenuProvider>
            </TooltipProvider>
          </Providers>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
