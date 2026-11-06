import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandMenuProvider } from "@/components/command-menu";
import { AppShell } from "@/components/app-shell";
import { AttentionSync } from "@/components/attention-sync";
import { ProfileProvider } from "@/components/profile-provider";
import { Toaster } from "@/components/toaster";
import { PALETTE_BOOT_SCRIPT } from "@/lib/palette";
import { parseProfile, PROFILE_COOKIE } from "@/lib/profile";
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
  const profile = parseProfile(cookieStore.get(PROFILE_COOKIE)?.value);

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(geistSans.variable, geistMono.variable, "h-full")}
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: PALETTE_BOOT_SCRIPT }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <AttentionSync />
            <ProfileProvider initialProfile={profile}>
              <CommandMenuProvider>
                <AppShell defaultOpen={sidebarOpen}>{children}</AppShell>
              </CommandMenuProvider>
            </ProfileProvider>
          </Providers>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
