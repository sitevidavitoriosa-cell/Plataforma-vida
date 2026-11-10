"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { useAviso } from "@/components/provedores";
import { Botao, Janela } from "@/components/ui";

/** Botão + janela do link único dos quartos da edição (o mesmo para anjos, Secretaria e Saúde). */
export function LinkQuartosBotao({ edicaoId, edicaoNome, className }: { edicaoId: string; edicaoNome: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao v="sec" onClick={() => setAberto(true)} className={className ?? "!min-h-11"}>Link dos quartos</Botao>
      {aberto && <JanelaLink edicaoId={edicaoId} edicaoNome={edicaoNome} onFechar={() => setAberto(false)} />}
    </>
  );
}

function JanelaLink({ edicaoId, edicaoNome, onFechar }: { edicaoId: string; edicaoNome: string; onFechar: () => void }) {
  const aviso = useAviso();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [confirma, setConfirma] = useState<"novo" | "desligar" | null>(null);
  useEffect(() => {
    supabase.rpc("link_quartos", { p_edicao: edicaoId }).then(({ data, error }) => { if (error) { aviso(msgErro(error)); setToken(null); } else setToken(data as string); });
  }, [edicaoId, aviso]);
  const url = token ? `${window.location.origin}/q/${token}` : "";
  async function copiar() { try { await navigator.clipboard.writeText(url); aviso("Link copiado."); } catch { aviso("Copie o link na tela."); } }
  async function renovar() {
    if (confirma !== "novo") { setConfirma("novo"); return; }
    const { data, error } = await supabase.rpc("renovar_link_quartos", { p_edicao: edicaoId });
    setConfirma(null);
    if (error) { aviso(msgErro(error)); return; }
    setToken(data as string); aviso("Link novo gerado. O anterior parou de funcionar.");
  }
  async function desligar() {
    if (confirma !== "desligar") { setConfirma("desligar"); return; }
    const { error } = await supabase.rpc("desligar_link_quartos", { p_edicao: edicaoId });
    setConfirma(null);
    if (error) { aviso(msgErro(error)); return; }
    setToken(null); aviso("Link desligado.");
  }
  async function ligar() {
    const { data, error } = await supabase.rpc("link_quartos", { p_edicao: edicaoId });
    if (error) aviso(msgErro(error)); else setToken(data as string);
  }
  return (
    <Janela titulo="Link dos quartos" onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-suave">Um só link para {edicaoNome}: mostra o card de cada quarto com os encontristas e o perfil de cada um. Serve para os anjos, a Secretaria e a equipe de Saúde (que também descobre o quarto de cada pessoa). Tem dados de saúde: envie só a quem precisa.</p>
        {token === undefined ? <p className="m-0 text-suave">Carregando…</p> : token ? (
          <>
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link dos quartos" className="min-h-11 rounded-xl border border-borda px-3 text-sm" />
            <div className="flex flex-wrap gap-2">
              <Botao onClick={copiar} className="!min-h-11">Copiar</Botao>
              <a className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-borda bg-white px-5 text-[15px] font-extrabold text-marca" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Quartos de ${edicaoNome} (reservado, não repasse): ${url}`)}`}>WhatsApp</a>
              <a className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-borda bg-white px-5 text-[15px] font-extrabold text-marca" target="_blank" rel="noopener noreferrer" href={url}>Abrir</a>
            </div>
            <div className="flex flex-wrap gap-2">
              <Botao v="sec" onClick={renovar} className="!min-h-11">{confirma === "novo" ? "Confirmar: trocar link" : "Gerar link novo"}</Botao>
              <Botao v="sec" onClick={desligar} className="!min-h-11 !text-alerta">{confirma === "desligar" ? "Confirmar: desligar" : "Desligar"}</Botao>
            </div>
            {confirma && <p className="m-0 text-sm text-suave">{confirma === "novo" ? "O link atual deixa de funcionar para quem já recebeu." : "Ninguém mais consegue abrir até você ligar de novo."}</p>}
          </>
        ) : <Botao onClick={ligar}>Ativar link dos quartos</Botao>}
      </div>
    </Janela>
  );
}
