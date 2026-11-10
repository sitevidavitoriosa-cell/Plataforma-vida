"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { useAviso } from "@/components/provedores";
import { Botao, Icone } from "@/components/ui";

export type LinkOrg = { id: string; token: string; pasta_id: string | null; arquivo_id: string | null; expira_em: string | null; ativo: boolean; criado_em: string };
export const urlLink = (token: string) => `${window.location.origin}/c/${token}`;
/** Link interno: abre o item dentro do Organizacional para quem já tem acesso (entra com login). */
export const urlInterno = (tipo: "pasta" | "arquivo", id: string) => `${window.location.origin}/organizacional?item=${tipo === "pasta" ? "p" : "a"}:${id}`;
export const validade = (l: LinkOrg) => (!l.expira_em ? "Sem validade" : new Date(l.expira_em) < new Date() ? "Expirado" : `Vale até ${new Date(l.expira_em).toLocaleDateString("pt-BR")}`);

const PRAZOS = [{ v: "0", t: "Sem validade" }, { v: "1", t: "1 dia" }, { v: "7", t: "7 dias" }, { v: "30", t: "30 dias" }];

/** Janela "Compartilhar", como a do Drive: Acesso geral (Restrito ou Qualquer pessoa com o link) e Copiar link. */
export function Compartilhar({ item, podeMudar, onFechar, onMudou }: { item: { tipo: "pasta" | "arquivo"; id: string; nome: string }; podeMudar: boolean; onFechar: () => void; onMudou?: () => void }) {
  const aviso = useAviso();
  const [links, setLinks] = useState<LinkOrg[] | null>(null);
  const [prazo, setPrazo] = useState("0");
  const [aberto, setAberto] = useState(false);
  const col = item.tipo === "pasta" ? "pasta_id" : "arquivo_id";
  const publico = links?.find((l) => l.ativo && (!l.expira_em || new Date(l.expira_em) > new Date())) ?? null;

  async function carregar() {
    const { data, error } = await supabase.from("org_links").select("*").eq(col, item.id).order("criado_em", { ascending: false });
    if (error) { aviso(msgErro(error)); setLinks([]); } else setLinks((data as LinkOrg[]) ?? []);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [item.id]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, [onFechar]);
  useEffect(() => { if (publico) { const d = publico.expira_em ? Math.round((new Date(publico.expira_em).getTime() - Date.now()) / 86400000) : 0; setPrazo(d <= 0 ? "0" : d <= 1 ? "1" : d <= 7 ? "7" : "30"); } }, [publico?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function escolher(modo: "restrito" | "publico") {
    if (!podeMudar) return;
    if (modo === "publico" && !publico) {
      const { error } = await supabase.from("org_links").insert({ [col]: item.id, expira_em: null });
      if (error) { aviso(msgErro(error)); return; }
    }
    if (modo === "restrito" && links?.length) {
      const { error } = await supabase.from("org_links").delete().eq(col, item.id);
      if (error) { aviso(msgErro(error)); return; }
      aviso("Link público desligado. Só quem tem acesso ao Organizacional abre.");
    }
    carregar(); onMudou?.();
  }
  async function mudarPrazo(v: string) {
    if (!publico) return;
    setPrazo(v);
    const dias = Number(v);
    const { error } = await supabase.from("org_links").update({ expira_em: dias ? new Date(Date.now() + dias * 86400000).toISOString() : null }).eq("id", publico.id);
    if (error) { aviso(msgErro(error)); return; }
    carregar(); onMudou?.();
  }
  async function copiar() {
    const u = publico ? urlLink(publico.token) : urlInterno(item.tipo, item.id);
    try { await navigator.clipboard.writeText(u); aviso("Link copiado."); } catch { aviso("Não consegui copiar. Copie pelo campo."); }
  }
  const link = publico ? urlLink(publico.token) : typeof window !== "undefined" ? urlInterno(item.tipo, item.id) : "";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" aria-label={`Compartilhar ${item.nome}`} className="flex max-h-[92dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-white p-6 sm:rounded-[28px]">
        <h2 className="m-0 truncate text-[22px] font-medium">Compartilhar “{item.nome}”</h2>

        <div>
          <b className="mb-2 block text-base">Acesso geral</b>
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${publico ? "bg-green-100 text-green-800" : "bg-[#eceff1] text-suave"}`}><Icone n={publico ? "globo" : "cadeado"} tam={20} /></span>
            <div className="min-w-0 flex-1">
              <div className="relative inline-block">
                <button type="button" disabled={!podeMudar} onClick={() => setAberto((a) => !a)} aria-haspopup="listbox" aria-expanded={aberto} className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-[15px] font-bold hover:bg-fundo disabled:cursor-default disabled:hover:bg-transparent">
                  {publico ? "Qualquer pessoa com o link" : "Restrito"}{podeMudar && <span className="text-xs">▾</span>}
                </button>
                {aberto && (
                  <ul role="listbox" className="absolute left-0 top-full z-10 mt-1 w-72 overflow-hidden rounded-xl border border-borda bg-white py-1 shadow-xl">
                    {([["restrito", "Restrito", "Só quem tem acesso ao Organizacional, entrando com login."], ["publico", "Qualquer pessoa com o link", "Qualquer pessoa na internet com o link pode ver, imprimir e baixar."]] as const).map(([k, t, d]) => (
                      <li key={k}><button type="button" role="option" aria-selected={(k === "publico") === !!publico} onClick={() => { setAberto(false); escolher(k); }} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-fundo"><span className="w-4 pt-0.5 text-marca">{(k === "publico") === !!publico ? "✓" : ""}</span><span><b className="block text-sm">{t}</b><span className="text-xs text-suave">{d}</span></span></button></li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="m-0 px-2 text-sm text-suave">{publico ? "Qualquer pessoa na internet com o link pode ver, imprimir e baixar. Sem login." : "Só quem tem acesso ao Organizacional pode abrir com o link, entrando com login."}</p>
              {publico && (
                <div className="mt-2 flex items-center gap-2 px-2 text-sm">
                  <span className="text-suave">Função: <b className="text-texto">Leitor</b></span><span className="text-suave">·</span>
                  <label className="flex items-center gap-1.5 text-suave">Validade
                    <select value={prazo} disabled={!podeMudar} onChange={(e) => mudarPrazo(e.target.value)} className="min-h-9 rounded-lg border border-borda bg-white px-2 text-texto">{PRAZOS.map((p) => <option key={p.v} value={p.v}>{p.t}</option>)}</select>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {links === null && <p className="m-0 text-sm text-suave">Carregando…</p>}
        {publico && (
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link" className="min-h-11 rounded-xl border border-borda bg-fundo px-3 text-sm" />
        )}
        {!podeMudar && <p className="m-0 text-xs text-suave">Só administrador e coordenação mudam o acesso geral.</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button type="button" onClick={copiar} className="flex min-h-11 items-center gap-2 rounded-full border border-marca px-5 text-[15px] font-bold text-marca hover:bg-marca-clara"><Icone n="compartilhar" tam={18} />Copiar link</button>
          <div className="flex gap-2">
            {publico && <a className="inline-flex min-h-11 items-center rounded-full border border-borda px-4 text-[15px] font-bold text-marca" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${item.nome} (Vida Vitoriosa): ${link}`)}`}>WhatsApp</a>}
            <Botao onClick={onFechar} className="!min-h-11 !rounded-full">Concluído</Botao>
          </div>
        </div>
      </div>
    </div>
  );
}
