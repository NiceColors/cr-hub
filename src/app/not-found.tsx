import type { Metadata } from "next";
import { NotFoundTerminal } from "@/components/motion/not-found/terminal";

export const metadata: Metadata = {
  title: "Página não encontrada · CR Tracker",
};

export default function NotFound() {
  return <NotFoundTerminal className="min-h-[60vh]" />;
}
