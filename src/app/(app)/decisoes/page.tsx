"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { useAuth, useAviso, useEdicao } from "@/components/provedores";
import { Botao, Carregando, Cartao, Icone, Janela, Titulo, Vazio, cx } from "@/components/ui";
import { DEC_CORES, DEC_DEF, type BotaoDec } from "@/lib/decisoes";

type Rec = { encontrista_id: string; nome: string; cod: string | null; botao: string; por: string | null; criado_em: string };
type Link = { token: string; ativo: boolean; criado_em: string };

export default function Decisoes() {
  const { acesso } = useAuth();
  const { ed } = useEdicao();
  const aviso = useAviso();
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [botoes, setBotoes] = useState<BotaoDec[]>(DEC_DEF);
  const [links, setLinks] = useState<Link[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [editando, setEditando] = useState(false);
  const [excluir, setExcluir] = useState<Rec | null>(null);
  const [novoLink, setNovoLink] = useState(false);

  const carregar = useCallback(async () => {
    if (!ed) return;
    const [r, c, l] = await Promise.all([
      supabase.rpc("decisoes_lista", { p_edicao: ed.id }),
      supabase.from("decisoes_cfg").select("botoes").eq("edicao_id", ed.id).maybeSingle(),
      supabase.from("registro_links").select("token,ativo,criado_em").eq("edicao_id", ed.id).order("criado_em", { ascending: false }),
    ]);
    if (r.error) aviso(msgErro(r.error));
    setRecs((r.data as Rec[]) ?? []);
    const b = (c.data as { botoes: BotaoDec[] } | null)?.botoes;
    setBotoes(b && b.length ? b : DEC_DEF);
    setLinks((l.data as Link[]) ?? []);
  }, [ed, aviso]);

  useEffect(() => { setRecs(null); carregar(); }, [carregar]);
  useEffect(() => { const t = setInterval(carregar, 15000); window.addEventListener("focus", carregar); return () => { clearInterval(t); window.removeEventListener("focus", carregar); }; }, [carregar]);

  const porId = useMemo(() => new Map(botoes.map((b) => [b.id, b])), [botoes]);
  const link = links[0];
  const url = link ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${link.token}` : "";

  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!recs) return <Carregando />;

  const conta = (id: string) => recs.filter((r) => r.botao === id).length;
  const visiveis = recs.filter((r) => filtro === "todos" || r.botao === filtro);
  const volunt = new Map<string, number>(); recs.forEach((r) => { const k = r.por || "—"; volunt.set(k, (volunt.get(k) ?? 0) + 1); });

  async function garantirCfg() {
    const { data } = await supabase.from("decisoes_cfg").select("edicao_id").eq("edicao_id", ed!.id).maybeSingle();
    if (!data) await supabase.from("decisoes_cfg").insert({ edicao_id: ed!.id, botoes: DEC_DEF });
  }
  async function gerarLink() {
    await garantirCfg();
    if (link) await supabase.from("registro_links").update({ ativo: false }).eq("edicao_id", ed!.id);
    const { error } = await supabase.from("registro_links").insert({ edicao_id: ed!.id, ativo: true, criado_por: acesso?.id ?? null });
    if (error) { aviso(msgErro(error)); return; }
    setNovoLink(false); aviso("Link gerado."); carregar();
  }
  async function alternar() {
    if (!link) return;
    const { error } = await supabase.from("registro_links").update({ ativo: !link.ativo }).eq("token", link.token);
    if (error) aviso(msgErro(error)); else carregar();
  }
  async function copiar() { try { await navigator.clipboard.writeText(url); aviso("Link copiado."); } catch { aviso("Copie o link na tela."); } }
  async function apagar() {
    if (!excluir) return;
    const { error } = await supabase.from("decisoes").delete().match({ edicao_id: ed!.id, encontrista_id: excluir.encontrista_id, botao: excluir.botao });
    if (error) { aviso(msgErro(error)); return; }
    setExcluir(null); aviso("Registro excluído."); carregar();
  }
  function csv() {
    const cel = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [["Nome", "Decisão", "Código de inscrição", "Anotado por", "Data/hora"], ...recs!.map((r) => [r.nome, porId.get(r.botao)?.nome ?? r.botao, r.cod ?? "", r.por ?? "", new Date(r.criado_em).toLocaleString("pt-BR")])];
    const blob = new Blob(["﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `decisoes_${ed!.nome.replace(/[^a-zA-Z0-9]+/g, "_")}.csv`; a.click();
  }

  return (
    <div className="pb-8">
      <Titulo direita={<Botao v="sec" className="!min-h-11" onClick={csv} disabled={recs.length === 0}>Exportar</Botao>}>Decisões</Titulo>
      <p className="m-0 pb-3 text-sm text-suave">Chamado final de {ed.nome}: aceitou Jesus, batismo, células…</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {botoes.map((b) => (
          <button key={b.id} type="button" onClick={() => setFiltro(filtro === b.id ? "todos" : b.id)}
            className={cx("rounded-3xl border-2 bg-white p-4 text-left", filtro === b.id ? "" : "border-borda")} style={filtro === b.id ? { borderColor: b.cor } : undefined}>
            <div className="text-3xl font-extrabold leading-none" style={{ color: b.cor }}>{conta(b.id)}</div>
            <div className="mt-1.5 text-sm text-suave">{b.nome}{b.arq ? " (arquivado)" : ""}</div>
          </button>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-lg font-extrabold">Link de registro</h2>
      <Cartao className="flex flex-col gap-3 p-4">
        {link ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div><b>Aceitando registros</b><div className="text-sm text-suave">{link.ativo ? "Ligado: os voluntários conseguem registrar" : "Desligado: o link não abre para ninguém"}</div></div>
              <button type="button" role="switch" aria-checked={link.ativo} aria-label="Ligar ou desligar o link" onClick={alternar} className={cx("relative h-8 w-14 shrink-0 rounded-full transition", link.ativo ? "bg-marca" : "bg-borda")}>
                <span className={cx("absolute top-1 h-6 w-6 rounded-full bg-white transition-all", link.ativo ? "left-7" : "left-1")} />
              </button>
            </div>
            <div className="break-all rounded-xl bg-fundo p-3 text-sm">{url}</div>
            <div className="flex flex-wrap gap-2">
              <Botao v="sec" className="!min-h-11" onClick={copiar}><Icone n="copiar" tam={16} />Copiar link</Botao>
              <a className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-marca px-5 text-[15px] font-extrabold text-white" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Registro de decisões · ${ed.nome}: ${url}`)}`}>Enviar no WhatsApp</a>
              <Botao v="sec" className="!min-h-11" onClick={() => setNovoLink(true)}>Gerar novo link</Botao>
            </div>
            <p className="m-0 text-xs text-suave">Só quem tem o link abre. Se vazar, gere outro: o antigo para de funcionar na hora e os registros ficam salvos.</p>
          </>
        ) : (
          <>
            <p className="m-0 text-sm text-suave">Gere o link e envie aos voluntários que anotam os nomes nas filas. Eles não precisam de login e só enxergam os nomes dos encontristas.</p>
            <Botao onClick={gerarLink}>Gerar link de registro</Botao>
          </>
        )}
      </Cartao>

      <div className="mb-2 mt-6 flex items-center justify-between"><h2 className="m-0 text-lg font-extrabold">{filtro === "todos" ? `Todos os registros · ${recs.length}` : `${porId.get(filtro)?.nome} · ${visiveis.length}`}</h2></div>
      {visiveis.length === 0 && <Vazio>Nenhuma decisão registrada ainda.</Vazio>}
      <Cartao className="overflow-hidden">
        {visiveis.slice(0, 200).map((r, i) => {
          const b = porId.get(r.botao);
          return (
            <div key={r.encontrista_id + r.botao} className={cx("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-borda")}>
              <div className="min-w-0 flex-1"><b className="block truncate">{r.nome}</b><span className="text-xs text-suave">{r.cod ? `Inscrição ${r.cod} · ` : ""}por {r.por || "—"} · {new Date(r.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold text-white" style={{ background: b?.cor ?? "#888" }}>{b?.nome ?? r.botao}</span>
              <button type="button" aria-label={`Excluir registro de ${r.nome}`} onClick={() => setExcluir(r)} className="grid h-10 w-10 place-items-center text-suave"><Icone n="lixo" tam={18} /></button>
            </div>
          );
        })}
      </Cartao>

      {volunt.size > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-lg font-extrabold">Voluntários</h2>
          <Cartao className="overflow-hidden">
            {Array.from(volunt.entries()).sort((a, b) => b[1] - a[1]).map(([k, n], i) => <div key={k} className={cx("flex justify-between px-4 py-2.5", i > 0 && "border-t border-borda")}><b>{k}</b><span className="text-suave">{n} registros</span></div>)}
          </Cartao>
        </>
      )}

      <h2 className="mb-2 mt-6 text-lg font-extrabold">Botões do registro</h2>
      <Cartao className="flex flex-col gap-3 p-4">
        <p className="m-0 text-sm text-suave">Os voluntários só escolhem entre estes botões. Os nomes das pessoas vêm da planilha de encontristas, importada em “Encontristas”.</p>
        <div className="flex flex-wrap gap-2">{botoes.map((b) => <span key={b.id} className="rounded-full px-3 py-1 text-sm font-extrabold text-white" style={{ background: b.cor }}>{b.nome}{b.arq ? " · arquivado" : ""}</span>)}</div>
        <Botao v="sec" className="!min-h-11 self-start" onClick={() => setEditando(true)}><Icone n="lapis" tam={16} />Editar botões</Botao>
      </Cartao>

      {editando && <EditarBotoes edicaoId={ed.id} botoes={botoes} contagem={conta} onFechar={() => setEditando(false)} onSalvo={() => { setEditando(false); carregar(); }} />}
      {excluir && (
        <Janela titulo="Excluir este registro?" onFechar={() => setExcluir(null)}>
          <p className="mt-0">{excluir.nome} deixa de contar em “{porId.get(excluir.botao)?.nome ?? excluir.botao}”.</p>
          <div className="flex gap-2"><Botao v="sec" bloco onClick={() => setExcluir(null)}>Cancelar</Botao><Botao v="perigo" bloco onClick={apagar}>Excluir</Botao></div>
        </Janela>
      )}
      {novoLink && (
        <Janela titulo="Gerar um novo link?" onFechar={() => setNovoLink(false)}>
          <p className="mt-0">O link atual deixa de funcionar na hora. Quem estiver com ele aberto não consegue mais registrar. Os registros já feitos continuam salvos.</p>
          <div className="flex gap-2"><Botao v="sec" bloco onClick={() => setNovoLink(false)}>Cancelar</Botao><Botao bloco onClick={gerarLink}>Gerar novo link</Botao></div>
        </Janela>
      )}
    </div>
  );
}

function EditarBotoes({ edicaoId, botoes, contagem, onFechar, onSalvo }: { edicaoId: string; botoes: BotaoDec[]; contagem: (id: string) => number; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const [d, setD] = useState<BotaoDec[]>(botoes.map((b) => ({ ...b })));
  const mover = (i: number, j: number) => { if (j < 0 || j >= d.length) return; const n = d.slice(); [n[i], n[j]] = [n[j], n[i]]; setD(n); };
  const mudar = (i: number, p: Partial<BotaoDec>) => setD(d.map((b, k) => (k === i ? { ...b, ...p } : b)));
  async function salvar() {
    if (d.some((b) => !b.nome.trim())) { aviso("Todo botão precisa de nome."); return; }
    const { error } = await supabase.from("decisoes_cfg").upsert({ edicao_id: edicaoId, botoes: d.map((b) => ({ ...b, nome: b.nome.trim() })) });
    if (error) { aviso(msgErro(error)); return; }
    aviso("Botões salvos."); onSalvo();
  }
  return (
    <Janela titulo="Editar botões" onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        {d.map((b, i) => {
          const n = contagem(b.id);
          return (
            <div key={b.id} className="flex flex-col gap-2 rounded-2xl border border-borda p-3">
              <div className="flex items-center gap-2"><span className="h-4 w-4 shrink-0 rounded-full" style={{ background: b.cor }} />
                <input value={b.nome} maxLength={40} onChange={(e) => mudar(i, { nome: e.target.value })} aria-label="Nome do botão" className="min-h-11 flex-1 rounded-xl border border-borda px-3 outline-none" /></div>
              <div className="flex flex-wrap items-center gap-2">
                {DEC_CORES.map(([nome, hex]) => <button key={hex} type="button" aria-label={nome} onClick={() => mudar(i, { cor: hex })} className={cx("h-8 w-8 rounded-full border-2", b.cor === hex ? "border-texto" : "border-transparent")} style={{ background: hex }} />)}
                <span className="text-xs text-suave">{n ? `${n} registros` : "nenhum registro"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Botao v="sec" className="!min-h-9 !px-3 text-sm" onClick={() => mover(i, i - 1)}>Subir</Botao>
                <Botao v="sec" className="!min-h-9 !px-3 text-sm" onClick={() => mover(i, i + 1)}>Descer</Botao>
                {n === 0 ? <Botao v="sec" className="!min-h-9 !px-3 text-sm !text-alerta" onClick={() => setD(d.filter((_, k) => k !== i))}>Apagar</Botao>
                  : <Botao v="sec" className="!min-h-9 !px-3 text-sm" onClick={() => mudar(i, { arq: !b.arq })}>{b.arq ? "Restaurar" : "Arquivar"}</Botao>}
              </div>
            </div>
          );
        })}
        <Botao v="sec" onClick={() => setD([...d, { id: "b" + Date.now().toString(36), nome: "Novo botão", cor: DEC_CORES[1][1], arq: false }])}><Icone n="mais1" tam={16} />Adicionar botão</Botao>
        <Botao bloco onClick={salvar}>Salvar botões</Botao>
      </div>
    </Janela>
  );
}
