"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { norm } from "@/lib/tipos";
import { ContatoLinha } from "@/components/contato";
import { useAuth, useAviso, useEdicao } from "@/components/provedores";
import { LinkQuartosBotao } from "@/components/linkQuartos";
import { excelSaude, pdfSaude, tagsDe, TAGS, type LinhaSaude } from "@/lib/saudePdf";
import { Botao, Carregando, Cartao, Chip, Icone, Janela, Selo, Vazio } from "@/components/ui";

type Linha = LinhaSaude;

export function Saude() {
  const { ed } = useEdicao();
  const aviso = useAviso();
  const [dados, setDados] = useState<Linha[] | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [aberta, setAberta] = useState<Linha | null>(null);

  const carregar = useCallback(async () => {
    if (!ed) return;
    const { data, error } = await supabase.rpc("saude_lista", { p_edicao: ed.id });
    if (error) { aviso(msgErro(error)); setDados([]); return; }
    setDados((data as Linha[]) ?? []);
  }, [ed, aviso]);
  useEffect(() => { setDados(null); carregar(); }, [carregar]);

  const [gerando, setGerando] = useState("");
  async function exportar(tipo: "pdf" | "xlsx") {
    if (!ed || !dados) return;
    setGerando(tipo);
    try {
      const blob = tipo === "pdf" ? await pdfSaude(ed, dados) : await excelSaude(ed, dados);
      const nome = `Saude_${ed.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_")}.${tipo}`;
      if (tipo === "pdf") { window.open(URL.createObjectURL(blob), "_blank"); }
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    } catch { aviso("Não consegui gerar o arquivo. Tente de novo."); }
    setGerando("");
  }

  const vis = useMemo(() => (dados ?? []).filter((l) => (!tag || tagsDe(l.necessidade).includes(tag)) && (!q || norm(l.nome + " " + (l.necessidade ?? "") + " " + (l.quarto ?? "")).includes(norm(q)))), [dados, q, tag]);
  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!dados) return <Carregando />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Botao onClick={() => exportar("pdf")} disabled={!!gerando} className="!min-h-11">{gerando === "pdf" ? "Gerando…" : "Imprimir (PDF)"}</Botao>
        <Botao v="sec" onClick={() => exportar("xlsx")} disabled={!!gerando} className="!min-h-11">{gerando === "xlsx" ? "Gerando…" : "Planilha (Excel)"}</Botao>
        <LinkQuartosBotao edicaoId={ed.id} edicaoNome={ed.nome} />
      </div>
      <p className="m-0 text-sm text-suave">{dados.length} {dados.length === 1 ? "pessoa com necessidade" : "pessoas com necessidade"} em {ed.nome}. O PDF sai pronto para imprimir, com quarto, necessidade e contatos de emergência.</p>
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-borda bg-white px-3">
        <Icone n="busca" tam={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, remédio ou quarto" aria-label="Buscar" className="min-w-0 flex-1 bg-transparent outline-none" />
      </label>
      <div className="flex gap-2 overflow-x-auto">
        <Chip ativo={!tag} onClick={() => setTag("")}>Todos</Chip>
        {Object.keys(TAGS).map((t) => <Chip key={t} ativo={tag === t} onClick={() => setTag(tag === t ? "" : t)}>{t}</Chip>)}
      </div>
      {vis.length === 0 && <Vazio>Ninguém encontrado.</Vazio>}
      {vis.map((l) => (
        <Cartao key={l.id} className="flex flex-col gap-2 p-4">
          <button type="button" onClick={() => setAberta(l)} className="flex flex-col gap-1.5 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><b className="block text-lg leading-tight">{l.nome}</b><span className="text-sm text-suave">{l.idade ? `${l.idade} anos` : ""}</span></div>
              {l.quarto ? <span className="shrink-0 rounded-xl bg-marca px-3 py-1.5 text-sm font-extrabold text-white">{l.quarto}</span> : <span className="shrink-0 text-xs text-suave">sem quarto</span>}
            </div>
            <p className="m-0 text-[15px]">{l.necessidade}</p>
            <div className="flex flex-wrap gap-1.5">{tagsDe(l.necessidade).map((t) => <Selo key={t} tom="aviso">{t}</Selo>)}{l.observacao && <Selo tom="ok">com observação</Selo>}</div>
          </button>
          {l.contatos && l.contatos.length > 0 && (
            <div className="flex flex-col border-t border-borda pt-1">
              <span className="text-[11px] font-bold uppercase text-suave">Contato de emergência</span>
              {l.contatos.map((c, i) => <ContatoLinha key={i} texto={c} />)}
            </div>
          )}
        </Cartao>
      ))}
      {aberta && <Detalhe l={aberta} onFechar={() => setAberta(null)} onSalvo={() => { setAberta(null); carregar(); }} />}
    </div>
  );
}

function Detalhe({ l, onFechar, onSalvo }: { l: Linha; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const { acesso } = useAuth();
  const edita = acesso?.perfil !== "secretaria1"; // Secretaria 1 só lê a saúde
  const [obs, setObs] = useState(l.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [confirma, setConfirma] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  async function excluir() {
    if (!confirma) { setConfirma(true); return; }
    setExcluindo(true);
    const { error } = await supabase.rpc("excluir_da_saude", { p_id: l.id });
    setExcluindo(false);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Pessoa retirada da lista de saúde."); onSalvo();
  }
  async function salvar() {
    setSalvando(true);
    const { error } = await supabase.rpc("salvar_obs_saude", { p_id: l.id, p_obs: obs });
    setSalvando(false);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Observação salva."); onSalvo();
  }
  return (
    <Janela titulo={l.nome} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <div><div className="text-xs font-bold uppercase text-suave">Necessidade</div><p className="m-0">{l.necessidade}</p></div>
        {l.contatos && l.contatos.length > 0 && <div><div className="text-xs font-bold uppercase text-suave">Contato de emergência</div>{l.contatos.map((c, i) => <ContatoLinha key={i} texto={c} />)}</div>}
        {!edita ? (l.observacao ? <div><div className="text-xs font-bold uppercase text-suave">Observação da equipe de saúde</div><p className="m-0">{l.observacao}</p></div> : null) : <>
        <label className="flex flex-col gap-1.5 text-sm font-bold">Observação da equipe de saúde
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className="rounded-2xl border border-borda bg-white p-3 text-base font-normal outline-none focus:border-marca" placeholder="Ex.: medicação guardada com a enfermeira" />
        </label>
        <div className="flex gap-2">
          <Botao onClick={salvar} disabled={salvando || excluindo || obs === (l.observacao ?? "")} className="flex-1">Salvar observação</Botao>
          <Botao v="sec" onClick={excluir} disabled={salvando || excluindo} className={`!min-h-12 ${confirma ? "!border-alerta !bg-alerta !text-white" : "!text-alerta"}`}>{confirma ? "Confirmar" : "Excluir"}</Botao>
        </div>
        {confirma && <p className="m-0 text-sm text-suave">Toque em “Confirmar” para tirar {l.nome.split(" ")[0]} da lista de saúde. A ficha e o quarto não mudam.</p>}</>}
      </div>
    </Janela>
  );
}
