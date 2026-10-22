import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandMenuProvider } from "@/components/command-menu";
import { AppShell } from "@/components/app-shell";
import { AttentionSync } from "@/components/attention-sync";
import { Toaster } from "@/components/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  applicationName: "CR Tracker",
  icons: { apple: "/icons/192" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
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
            <AttentionSync />
            <TooltipProvider delay={200}>
              <CommandMenuProvider>
                <AppShell defaultOpen={sidebarOpen}>{children}</AppShell>
              </CommandMenuProvider>
            </TooltipProvider>
          </Providers>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
