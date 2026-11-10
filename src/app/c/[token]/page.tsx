"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { baixarArquivo, baixarZip, COR_TIPO, dataBr, extDe, tam, tipoDe, type ArqPrev, type NoZip } from "@/lib/drive";
import { Previa } from "@/components/previa";
import { Icone } from "@/components/ui";

type P = { id: string; nome: string; pai_id: string | null };
type A = ArqPrev & { pasta_id: string | null };
type Info = { ok: boolean; tipo?: "pasta" | "arquivo"; nome?: string; raiz?: string; pastas?: P[]; arquivos?: A[] };

/** Página pública (sem login) de um link compartilhado do Organizacional: pasta com subpastas ou um arquivo. Ver, imprimir e baixar. */
export default function Compartilhado() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [cur, setCur] = useState<string | null>(null);
  const [prev, setPrev] = useState<A | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.rpc("org_link_info", { p_token: token }).then(({ data, error }) => {
      if (error) setFalhou(true);
      else { const i = data as Info; setInfo(i); setCur(i.raiz ?? null); if (i.ok && i.tipo === "arquivo" && i.arquivos?.[0]) setPrev(i.arquivos[0]); }
    });
  }, [token]);

  const pastas = useMemo(() => info?.pastas ?? [], [info]);
  const arquivos = useMemo(() => info?.arquivos ?? [], [info]);
  const subs = useMemo(() => pastas.filter((p) => p.pai_id === cur), [pastas, cur]);
  const fs = useMemo(() => arquivos.filter((a) => a.pasta_id === cur), [arquivos, cur]);
  const trilha = useMemo(() => { const r: P[] = []; let p = pastas.find((x) => x.id === cur); while (p) { r.unshift(p); const pai: string | null = p.pai_id; p = pai ? pastas.find((x) => x.id === pai) : undefined; if (r.length && r[0].id === info?.raiz) break; } return r; }, [pastas, cur, info]);

  const casca = (c: React.ReactNode) => (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-marca font-extrabold text-white">V</div>
        <div className="leading-tight"><b>{info?.nome ?? "Arquivos compartilhados"}</b><div className="text-xs text-suave">Vida Vitoriosa</div></div></div>
      {c}
    </div>
  );

  if (falhou && !info) return casca(<p className="text-suave">Não consegui abrir agora. Verifique a internet e recarregue a página.</p>);
  if (!info) return casca(<p className="text-suave">Carregando…</p>);
  if (!info.ok) return casca(<div className="rounded-3xl border border-borda bg-white p-5"><b className="block text-lg">Link indisponível</b><p className="mb-0 text-suave">Este link foi desligado, expirou ou o conteúdo foi removido. Peça um novo link a quem compartilhou.</p></div>);

  const noDe = (pid: string): NoZip[] => [
    ...pastas.filter((p) => p.pai_id === pid).map((p) => ({ nome: p.nome, filhos: noDe(p.id) })),
    ...arquivos.filter((a) => a.pasta_id === pid).map((a) => ({ nome: a.nome, caminho: a.caminho })),
  ];
  async function zip() {
    setMsg("Preparando o .zip…");
    const ok = await baixarZip(info!.nome ?? "Arquivos", noDe(info!.raiz!), (f, t) => setMsg(`Compactando ${f} de ${t}…`));
    setMsg(ok ? "" : "Não consegui gerar o .zip agora.");
  }

  const tela = info.tipo === "arquivo" ? (
    <div className="rounded-3xl border border-borda bg-white p-5">
      <b className="block text-lg">{arquivos[0].nome}</b>
      <p className="mb-3 mt-1 text-sm text-suave">{tam(arquivos[0].tamanho)} · {dataBr(arquivos[0].criado_em)}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPrev(arquivos[0])} className="min-h-12 rounded-2xl bg-marca px-5 font-extrabold text-white">Abrir</button>
        <button type="button" onClick={async () => { if (!(await baixarArquivo(arquivos[0]))) setMsg("Não consegui baixar agora."); }} className="min-h-12 rounded-2xl border border-borda bg-white px-5 font-extrabold">Baixar</button>
      </div>
    </div>
  ) : (
    <>
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm" aria-label="Caminho">
        {trilha.map((p, n) => (
          <span key={p.id} className="flex items-center gap-1">{n > 0 && <span className="text-suave">›</span>}
            <button type="button" onClick={() => setCur(p.id)} className={`min-h-9 rounded-lg px-2 font-bold ${n === trilha.length - 1 ? "text-texto" : "text-marca"}`}>{p.nome}</button></span>
        ))}
      </nav>
      <div className="mb-3 flex flex-wrap gap-2"><button type="button" onClick={zip} className="flex min-h-11 items-center gap-1.5 rounded-2xl border border-borda bg-white px-4 text-sm font-extrabold"><Icone n="baixar" tam={18} />Baixar tudo (.zip)</button></div>
      {subs.length === 0 && fs.length === 0 && <p className="text-suave">Pasta vazia.</p>}
      <div className="flex flex-col gap-2">
        {subs.map((p) => (
          <button key={p.id} type="button" onClick={() => setCur(p.id)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-borda bg-white px-3 text-left"><span className="grid h-11 w-11 place-items-center rounded-xl bg-marca-clara text-marca"><Icone n="pasta" tam={24} /></span><b className="flex-1 truncate">{p.nome}</b><span className="text-suave">›</span></button>
        ))}
        {fs.map((a) => (
          <div key={a.id} className="flex min-h-14 items-center gap-3 rounded-2xl border border-borda bg-white px-3 py-2">
            <button type="button" onClick={() => setPrev(a)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white" style={{ background: COR_TIPO[tipoDe(a)] }}>{(extDe(a.nome) || "arq").toUpperCase().slice(0, 4)}</span>
              <span className="min-w-0 leading-tight"><b className="block truncate text-[15px]">{a.nome}</b><span className="text-xs text-suave">{tam(a.tamanho)} · {dataBr(a.criado_em)}</span></span>
            </button>
            <button type="button" onClick={async () => { if (!(await baixarArquivo(a))) setMsg("Não consegui baixar agora."); }} aria-label={`Baixar ${a.nome}`} className="grid h-10 w-10 shrink-0 place-items-center text-suave"><Icone n="baixar" tam={20} /></button>
          </div>
        ))}
      </div>
    </>
  );

  return casca(
    <>
      {msg && <div role="status" className="mb-3 rounded-2xl bg-marca-clara px-4 py-2 text-sm font-bold text-marca-esc">{msg}</div>}
      {tela}
      <p className="mb-0 mt-6 text-xs text-suave">Conteúdo reservado do Vida Vitoriosa. Não repasse este link.</p>
      {prev && <Previa arquivo={prev} lista={fs.some((x) => x.id === prev.id) ? fs : undefined} onTrocar={(a) => setPrev(arquivos.find((x) => x.id === a.id) ?? null)} onFechar={() => setPrev(null)} />}
    </>
  );
}
