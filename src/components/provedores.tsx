"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Acesso } from "@/lib/perm";

type Ctx = { carregando: boolean; sessao: Session | null; acesso: Acesso | null; sair: () => Promise<void>; recarregar: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ carregando: true, sessao: null, acesso: null, sair: async () => {}, recarregar: async () => {} });
export const useAuth = () => useContext(AuthCtx);

const ToastCtx = createContext<(m: string) => void>(() => {});
export const useAviso = () => useContext(ToastCtx);

export function Provedores({ children }: { children: React.ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Session | null>(null);
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  const [msg, setMsg] = useState("");

  const aviso = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg((x) => (x === m ? "" : x)), 3800); }, []);

  const carregarAcesso = useCallback(async (s: Session | null) => {
    if (!s) { setAcesso(null); return; }
    const { data } = await supabase.rpc("meu_acesso");
    setAcesso((data as Acesso | null) ?? null);
  }, []);

  const recarregar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSessao(data.session);
    await carregarAcesso(data.session);
  }, [carregarAcesso]);

  useEffect(() => {
    let vivo = true;
    (async () => { await recarregar(); if (vivo) setCarregando(false); })();
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      setSessao(s);
      // não chamar o banco dentro do callback do auth (evita travar); agenda para depois
      setTimeout(() => { carregarAcesso(s); }, 0);
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, [recarregar, carregarAcesso]);

  const sair = useCallback(async () => { await supabase.auth.signOut(); setAcesso(null); setSessao(null); }, []);

  return (
    <AuthCtx.Provider value={{ carregando, sessao, acesso, sair, recarregar }}>
      <ToastCtx.Provider value={aviso}>
        {children}
        {msg && (
          <div role="status" className="fixed left-1/2 z-[100] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-texto px-4 py-3 text-[15px] font-semibold text-white shadow-lg" style={{ bottom: "calc(env(safe-area-inset-bottom) + 92px)" }}>
            {msg}
          </div>
        )}
      </ToastCtx.Provider>
    </AuthCtx.Provider>
  );
}
