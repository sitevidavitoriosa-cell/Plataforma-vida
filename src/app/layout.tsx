import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Provedores } from "@/components/provedores";

export const metadata: Metadata = {
  title: "Vida Vitoriosa · Plataforma de Gestão",
  description: "Estoque, edições, financeiro e decisões do Vida Vitoriosa.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#1f6f5c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><Provedores>{children}</Provedores></body>
    </html>
  );
}
