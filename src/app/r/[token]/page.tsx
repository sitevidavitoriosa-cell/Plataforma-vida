"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { norm } from "@/lib/tipos";
import type { BotaoDec } from "@/lib/decisoes";

type Info = { ok: boolean; edicao?: string; botoes?: BotaoDec[]; pessoas?: { id: string; nome: string; cod: string | null }[]; marcadas?: { p: string; b: string }[] };

/** Página pública (sem login) para voluntários anotarem decisões nas filas. */
export default function Registro() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [nome, setNome] = useState("");
  const [nomeOk, setNomeOk] = useState(false);
  const [botao, setBotao] = useState("");
  const [q, setQ] = useState("");
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [meus, setMeus] = useState<{ p: string; b: string; nome: string }[]>([]);

  useEffect(() => { try { const n = localStorage.getItem("vv-voluntario"); if (n) { setNome(n); setNomeOk(true); } } catch {} }, []);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("link_info", { p_token: token });
    if (error) { setFalhou(true); return; }
    setFalhou(false);
    const i = data as Info;
    setInfo(i);
    if (i.ok) setFeitas(new Set((i.marcadas ?? []).map((m) => m.p + "|" + m.b)));
  }, [token]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, [carregar]);
  useEffect(() => { if (info?.ok && !botao && info.botoes?.length) setBotao(info.botoes[0].id); }, [info, botao]);

  const aviso = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };
  const bt = info?.botoes?.find((b) => b.id === botao);
  // Resultados da busca: só aparecem depois de digitar.
  const lista = useMemo(() => {
    const n = norm(q);
    if (n.length < 2) return [];
    return (info?.pessoas ?? []).filter((p) => norm(p.nome + " " + (p.cod ?? "")).includes(n)).slice(0, 8);
  }, [info, q]);
  // Lista de baixo: separada por decisão (os mais recentes primeiro).
  const grupos = useMemo(() => {
    const por = new Map((info?.pessoas ?? []).map((p) => [p.id, p]));
    return (info?.botoes ?? []).map((b) => {
      const ordem = meus.filter((m) => m.b === b.id).map((m) => m.p);
      const ids = [...ordem, ...Array.from(feitas).filter((k) => k.endsWith("|" + b.id)).map((k) => k.split("|")[0]).filter((id) => !ordem.includes(id))];
      return { b, pessoas: ids.map((id) => por.get(id)).filter((p): p is { id: string; nome: string; cod: string | null } => !!p) };
    });
  }, [info, feitas, meus]);

  async function marcar(p: { id: string; nome: string }, marcar: boolean, botaoId?: string) {
    const bt = info?.botoes?.find((b) => b.id === (botaoId ?? botao));
    if (!bt) return;
    const k = p.id + "|" + bt.id;
    const { data, error } = await supabase.rpc("registrar_decisao", { p_token: token, p_pessoa: p.id, p_botao: bt.id, p_marcar: marcar, p_por: nome });
    const r = data as { ok: boolean; erro?: string } | null;
    if (error || !r?.ok) { aviso(r?.erro === "link_invalido" ? "Este link foi desligado." : "Não consegui registrar. Tente de novo."); carregar(); return; }
    setFeitas((s) => { const n = new Set(s); if (marcar) n.add(k); else n.delete(k); return n; });
    setMeus((m) => (marcar ? [{ p: p.id, b: bt.id, nome: p.nome }, ...m].slice(0, 15) : m.filter((x) => !(x.p === p.id && x.b === bt.id))));
    if (marcar) setQ("");
    aviso(marcar ? `Registrado: ${p.nome}` : `Desfeito: ${p.nome}`);
  }

  const casca = (c: React.ReactNode) => (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-marca font-extrabold text-white">V</div>
        <div className="leading-tight"><b>Registro de decisões</b><div className="text-xs text-suave">{info?.edicao ?? "Vida Vitoriosa"}</div></div></div>
      {c}
      {msg && <div role="status" className="fixed inset-x-4 bottom-6 mx-auto max-w-md rounded-2xl bg-texto px-4 py-3 text-center text-sm font-bold text-white">{msg}</div>}
    </div>
  );

  if (falhou && !info) return casca(<p className="text-suave">Não consegui abrir agora. Verifique a internet e recarregue a página.</p>);
  if (!info) return casca(<p className="text-suave">Carregando…</p>);
  if (!info.ok) return casca(<div className="rounded-3xl border border-borda bg-white p-5"><b className="block text-lg">Link indisponível</b><p className="mb-0 text-suave">Este link foi desligado ou trocado. Peça um novo link a quem coordena o registro.</p></div>);

  if (!nomeOk) return casca(
    <form className="flex flex-col gap-3 rounded-3xl border border-borda bg-white p-5" onSubmit={(e) => { e.preventDefault(); if (nome.trim().length < 2) return; try { localStorage.setItem("vv-voluntario", nome.trim()); } catch {} setNome(nome.trim()); setNomeOk(true); }}>
      <b className="text-lg">Qual é o seu nome?</b>
      <p className="m-0 text-sm text-suave">Para a coordenação saber quem anotou cada decisão.</p>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" aria-label="Seu nome" maxLength={60} className="min-h-12 rounded-2xl border border-borda px-4 text-base outline-none" />
      <button type="submit" className="min-h-12 rounded-2xl bg-marca font-extrabold text-white">Continuar</button>
    </form>
  );

  return casca(
    <>
      <p className="mb-3 mt-0 text-sm text-suave">Escolha a decisão, busque o nome e toque para registrar. Anotando como <b>{nome}</b> · <button type="button" className="font-bold text-marca" onClick={() => setNomeOk(false)}>trocar</button></p>
      <div className="flex flex-wrap gap-2">
        {(info.botoes ?? []).map((b) => (
          <button key={b.id} type="button" onClick={() => setBotao(b.id)} className="min-h-12 rounded-2xl border-2 px-4 text-[15px] font-extrabold"
            style={botao === b.id ? { background: b.cor, borderColor: b.cor, color: "#fff" } : { borderColor: b.cor, color: b.cor, background: "#fff" }}>{b.nome}</button>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome da pessoa" aria-label="Buscar nome" className="mt-4 min-h-12 w-full rounded-2xl border border-borda bg-white px-4 text-base outline-none" />
      {lista.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {lista.map((p) => {
            const ja = feitas.has(p.id + "|" + bt?.id);
            return (
              <button key={p.id} type="button" onClick={() => !ja && marcar(p, true)} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-borda bg-white px-4 text-left">
                <span className="min-w-0"><b className="block truncate">{p.nome}</b>{p.cod && <span className="text-xs text-suave">Inscrição {p.cod}</span>}</span>
                <span className="shrink-0 text-sm font-bold" style={{ color: bt?.cor }}>{ja ? "✓ já registrado" : "Registrar"}</span>
              </button>
            );
          })}
        </div>
      )}
      {q.trim().length >= 2 && lista.length === 0 && <p className="mt-2 text-sm text-suave">Ninguém com esse nome.</p>}
      <div className="mt-6 flex flex-col gap-4">
        {grupos.map(({ b, pessoas }) => (
          <section key={b.id}>
            <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-extrabold text-white" style={{ background: b.cor }}><span>{b.nome}</span><span>{pessoas.length}</span></div>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {pessoas.length === 0 && <p className="m-0 px-1 text-sm text-suave">Ninguém ainda.</p>}
              {pessoas.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-fundo px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-bold">{p.nome}</span>
                  <button type="button" onClick={() => marcar(p, false, b.id)} className="shrink-0 font-bold text-suave">desfazer</button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
