import type { Metadata } from "next";

// página reservada: nunca aparece em buscadores
export const metadata: Metadata = { title: "Arquivos compartilhados · Vida Vitoriosa", robots: { index: false, follow: false } };

export default function LayoutCompartilhado({ children }: { children: React.ReactNode }) {
  return children;
}
