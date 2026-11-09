"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Acesso } from "@/lib/perm";
import type { Edicao } from "@/lib/tipos";
import { temaDe } from "@/lib/cores";

type Ctx = { carregando: boolean; sessao: Session | null; acesso: Acesso | null; sair: () => Promise<void>; recarregar: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ carregando: true, sessao: null, acesso: null, sair: async () => {}, recarregar: async () => {} });
export const useAuth = () => useContext(AuthCtx);

type EdCtx = { eds: Edicao[]; ed: Edicao | null; carregou: boolean; trocar: (id: string) => void; recarregar: () => Promise<void> };
const EdicaoCtx = createContext<EdCtx>({ eds: [], ed: null, carregou: false, trocar: () => {}, recarregar: async () => {} });
/** Edição escolhida no topo: tudo no site (estoque, encontristas, painel) é dela. */
export const useEdicao = () => useContext(EdicaoCtx);

function EdicaoProvider({ children }: { children: React.ReactNode }) {
  const { acesso } = useAuth();
  const [eds, setEds] = useState<Edicao[]>([]);
  const [id, setId] = useState("");
  const [carregou, setCarregou] = useState(false);

  const recarregar = useCallback(async () => {
    const { data } = await supabase.from("edicoes").select("*").order("data_ini", { ascending: false });
    setEds((data as Edicao[] | null) ?? []);
    setCarregou(true);
  }, []);
  useEffect(() => { if (acesso) recarregar(); }, [acesso, recarregar]);
  useEffect(() => { try { setId(localStorage.getItem("vv-edicao") ?? ""); } catch {} }, []);

  const ed = eds.find((e) => e.id === id) ?? eds.find((e) => e.status === "aberta") ?? eds[0] ?? null;
  const trocar = useCallback((novo: string) => { setId(novo); try { localStorage.setItem("vv-edicao", novo); } catch {} }, []);

  useEffect(() => {
    const t = temaDe(ed), r = document.documentElement.style;
    r.setProperty("--color-marca", t.marca); r.setProperty("--color-marca-esc", t.esc); r.setProperty("--color-marca-clara", t.clara);
    r.setProperty("--color-detalhe", t.detalhe); r.setProperty("--color-fundo", t.fundo);
  }, [ed?.tipo, ed?.cor, ed?.rede2]);

  return <EdicaoCtx.Provider value={{ eds, ed, carregou, trocar, recarregar }}>{children}</EdicaoCtx.Provider>;
}

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
        <EdicaoProvider>{children}</EdicaoProvider>
        {msg && (
          <div role="status" className="fixed left-1/2 z-[100] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-texto px-4 py-3 text-[15px] font-semibold text-white shadow-lg" style={{ bottom: "calc(env(safe-area-inset-bottom) + 92px)" }}>
            {msg}
          </div>
        )}
      </ToastCtx.Provider>
    </AuthCtx.Provider>
  );
}
