import type { Metadata } from "next";

// página reservada: nunca aparece em buscadores
export const metadata: Metadata = { title: "Quartos · Vida Vitoriosa", robots: { index: false, follow: false } };

export default function LayoutQuartos({ children }: { children: React.ReactNode }) {
  return children;
}
