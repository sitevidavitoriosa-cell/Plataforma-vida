"use client";
import { useEffect, useState } from "react";

/** Registra o service worker (app abre sem internet) e entrega à ele os arquivos já carregados. */
export function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let vivo = true;
    navigator.serviceWorker.register("/sw.js").then(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!vivo) return;
      const urls = performance.getEntriesByType("resource").map((r) => r.name).filter((u) => u.includes("/_next/static/"));
      (reg.active ?? navigator.serviceWorker.controller)?.postMessage({ tipo: "cachear", urls });
    }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return null;
}

/** Faixa fina quando o aparelho está sem internet. */
export function AvisoSemInternet() {
  const [off, setOff] = useState(false);
  useEffect(() => {
    const f = () => setOff(!navigator.onLine);
    f(); window.addEventListener("online", f); window.addEventListener("offline", f);
    return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); };
  }, []);
  if (!off) return null;
  return <div role="status" className="sticky top-0 z-50 bg-texto px-4 py-2 text-center text-sm font-bold text-white print:hidden">Sem internet. Você vê o que já estava guardado neste aparelho; alterações só com sinal.</div>;
}

type EvInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
/** Instalar como app: no Android/Chrome abre o pedido; no iPhone mostra o caminho (Compartilhar > Adicionar à Tela de Início). */
export function useInstalar() {
  const [ev, setEv] = useState<EvInstalar | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const antes = (e: Event) => { e.preventDefault(); setEv(e as EvInstalar); };
    const feito = () => { setInstalado(true); setEv(null); };
    window.addEventListener("beforeinstallprompt", antes); window.addEventListener("appinstalled", feito);
    setInstalado(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    return () => { window.removeEventListener("beforeinstallprompt", antes); window.removeEventListener("appinstalled", feito); };
  }, []);
  return { instalado, ios, pode: !!ev, instalar: async () => { if (!ev) return; await ev.prompt(); setEv(null); } };
}
