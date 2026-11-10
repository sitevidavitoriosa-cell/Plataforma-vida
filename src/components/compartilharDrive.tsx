"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { useAviso } from "@/components/provedores";
import { Botao, Janela } from "@/components/ui";

export type LinkOrg = { id: string; token: string; pasta_id: string | null; arquivo_id: string | null; expira_em: string | null; ativo: boolean; criado_em: string };
export const urlLink = (token: string) => `${window.location.origin}/c/${token}`;
export const validade = (l: LinkOrg) => (!l.expira_em ? "Sem validade" : new Date(l.expira_em) < new Date() ? "Expirado" : `Vale até ${new Date(l.expira_em).toLocaleDateString("pt-BR")}`);

const PRAZOS = [{ v: "0", t: "Sem validade" }, { v: "1", t: "1 dia" }, { v: "7", t: "7 dias" }, { v: "30", t: "30 dias" }];

/** Compartilhar uma pasta (com tudo dentro) ou um arquivo por link. Quem tem o link vê, imprime e baixa, sem login. */
export function Compartilhar({ item, onFechar, onMudou }: { item: { tipo: "pasta" | "arquivo"; id: string; nome: string }; onFechar: () => void; onMudou?: () => void }) {
  const aviso = useAviso();
  const [links, setLinks] = useState<LinkOrg[] | null>(null);
  const [prazo, setPrazo] = useState("7");
  const col = item.tipo === "pasta" ? "pasta_id" : "arquivo_id";

  async function carregar() {
    const { data, error } = await supabase.from("org_links").select("*").eq(col, item.id).order("criado_em", { ascending: false });
    if (error) { aviso(msgErro(error)); setLinks([]); } else setLinks((data as LinkOrg[]) ?? []);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [item.id]);

  async function criar() {
    const dias = Number(prazo);
    const { error } = await supabase.from("org_links").insert({ [col]: item.id, expira_em: dias ? new Date(Date.now() + dias * 86400000).toISOString() : null });
    if (error) { aviso(msgErro(error)); return; }
    aviso("Link criado."); carregar(); onMudou?.();
  }
  async function copiar(l: LinkOrg) { try { await navigator.clipboard.writeText(urlLink(l.token)); aviso("Link copiado."); } catch { aviso("Copie o link na tela."); } }
  async function desligar(l: LinkOrg) {
    const { error } = await supabase.from("org_links").delete().eq("id", l.id);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Link desligado. Quem tinha o link não abre mais."); carregar(); onMudou?.();
  }

  return (
    <Janela titulo="Compartilhar" onFechar={onFechar}>
      <div className="flex flex-col gap-3 overflow-y-auto pb-2">
        <p className="m-0 text-sm text-suave">{item.tipo === "pasta" ? `A pasta “${item.nome}” e tudo que há dentro dela` : `O arquivo “${item.nome}”`}. Qualquer pessoa com o link vê, imprime e baixa, sem precisar de login. Envie só a quem deve receber.</p>
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5"><span className="text-[13px] font-bold text-suave">Validade do novo link</span>
            <select value={prazo} onChange={(e) => setPrazo(e.target.value)} className="min-h-12 rounded-2xl border border-borda bg-white px-3">{PRAZOS.map((p) => <option key={p.v} value={p.v}>{p.t}</option>)}</select>
          </label>
          <Botao onClick={criar}>Criar link</Botao>
        </div>
        {links === null && <p className="m-0 text-suave">Carregando…</p>}
        {links?.length === 0 && <p className="m-0 text-sm text-suave">Ainda não há link para este item.</p>}
        {links?.map((l) => (
          <div key={l.id} className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-3">
            <input readOnly value={urlLink(l.token)} onFocus={(e) => e.currentTarget.select()} aria-label="Link" className="min-h-11 rounded-xl border border-borda px-3 text-sm" />
            <span className="text-xs font-bold text-suave">{validade(l)} · criado em {new Date(l.criado_em).toLocaleDateString("pt-BR")}</span>
            <div className="flex flex-wrap gap-2">
              <Botao onClick={() => copiar(l)} className="!min-h-11">Copiar</Botao>
              <a className="inline-flex min-h-11 items-center rounded-2xl border border-borda bg-white px-4 text-[15px] font-extrabold text-marca" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${item.nome} (Vida Vitoriosa): ${urlLink(l.token)}`)}`}>WhatsApp</a>
              <Botao v="sec" onClick={() => desligar(l)} className="!min-h-11 !text-alerta">Desligar</Botao>
            </div>
          </div>
        ))}
      </div>
    </Janela>
  );
}
