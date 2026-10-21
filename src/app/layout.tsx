import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Providers } from "@/app/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <Providers>
          <TooltipProvider>
          <header className="border-b border-zinc-200/70 bg-white/70 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-900/60">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950">
                  CR
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">CR Tracker</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Bitbucket Cloud
                  </div>
                </div>
              </div>
              <nav className="flex items-center gap-2 text-sm">
                <Link
                  href="/"
                  className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Pull Requests
                </Link>
                <Link
                  href="/config"
                  className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Configuração
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
            {children}
          </main>
          <Toaster />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
