"use client";
import { useMemo, useState } from "react";
import { useLista } from "@/lib/dados";
import { dmy, fmtN, type Envio, type Item } from "@/lib/tipos";
import { podeVerFicha } from "@/lib/perm";
import { descricaoEd } from "@/lib/cores";
import { useAuth, useAviso, useEdicao } from "@/components/provedores";
import { Botao, Carregando, Chip, Titulo, Vazio } from "@/components/ui";

type Enc = { id: string; edicao_id: string; nome: string; categoria: string | null; sexo: string | null; cancelada: boolean;
  encontrista_saude: { tem_necessidade: boolean } | { tem_necessidade: boolean }[] | null;
  encontrista_espiritual: { batizado: boolean | null; rede: string | null } | { batizado: boolean | null; rede: string | null }[] | null };
type Dec = { edicao_id: string; encontrista_id: string; botao: string; criado_em: string; por: string | null };
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const conta = <T,>(l: T[], f: (x: T) => string) => { const m = new Map<string, number>(); l.forEach((x) => { const k = f(x) || "Não informado"; m.set(k, (m.get(k) ?? 0) + 1); }); return Array.from(m.entries()).sort((a, b) => b[1] - a[1]); };

export default function Relatorio() {
  const { acesso } = useAuth();
  const { ed } = useEdicao();
  const aviso = useAviso();
  const itens = useLista<Item>("itens", "*", "nome");
  const envios = useLista<Envio>("envios");
  const decs = useLista<Dec>("decisoes");
  const encs = useLista<Enc>("encontristas", "id, edicao_id, nome, categoria, sexo, cancelada, encontrista_saude(tem_necessidade), encontrista_espiritual(batizado, rede)", "nome");
  const [sec, setSec] = useState({ materiais: true, pessoas: true, decisoes: true });
  const [nomes, setNomes] = useState(false);
  const admin = podeVerFicha(acesso);

  const dados = useMemo(() => {
    if (!ed || !itens.dados || !envios.dados) return null;
    const porId = new Map(itens.dados.map((i) => [i.id, i]));
    const linhas = envios.dados.filter((x) => x.edicao_id === ed.id).map((x) => {
      const it = porId.get(x.item_id); if (!it) return null;
      const volta = x.volta ?? Number(x.env) + Number(x.comp);
      return { setor: it.setor, nome: it.nome, un: it.un, env: Number(x.env), comp: Number(x.comp), volta, cons: Number(x.env) + Number(x.comp) - volta, estoque: Number(it.qtd), min: Number(it.min), fechado: x.aplicado != null };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    const setores = Array.from(new Set(linhas.map((l) => l.setor))).sort((a, b) => a.localeCompare(b));
    const emFalta = itens.dados.filter((i) => i.min > 0 && i.qtd < i.min).length;
    const pessoas = (encs.dados ?? []).filter((e) => e.edicao_id === ed.id);
    const ativos = pessoas.filter((e) => !e.cancelada);
    const dec = (decs.dados ?? []).filter((d) => d.edicao_id === ed.id);
    return { linhas, setores, emFalta, pessoas, ativos, dec, nomePor: new Map((encs.dados ?? []).map((e) => [e.id, e.nome])) };
  }, [ed, itens.dados, envios.dados, encs.dados, decs.dados]);

  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!dados) return <Carregando />;
  const { linhas, setores, emFalta, pessoas, ativos, dec, nomePor } = dados;
  const principais = ativos.filter((e) => (e.categoria ?? "").trim() === "Encontrista");
  const equipe = ativos.length - principais.length;
  const batizados = principais.filter((e) => um(e.encontrista_espiritual)?.batizado === true).length;
  const saude = ativos.filter((e) => um(e.encontrista_saude)?.tem_necessidade).length;
  const porBotao = conta(dec, (d) => d.botao);

  async function excel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const add = (nome: string, rows: (string | number)[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), nome.slice(0, 31));
    add("Resumo", [["Edição", ed!.nome], ["Rede/tipo", descricaoEd(ed!)], ["Período", `${dmy(ed!.data_ini)} a ${dmy(ed!.data_fim)}`], ["Local", ed!.local ?? ""], ["Responsável", ed!.resp ?? ""],
      ["Itens enviados", linhas.length], ["Itens em falta (estoque geral)", emFalta], ...(admin ? [["Encontristas", principais.length], ["Equipe", equipe], ["Batizados", batizados], ["Com necessidade de saúde", saude]] : []), ["Decisões registradas", dec.length]] as (string | number)[][]);
    if (sec.materiais) add("Materiais", [["Setor", "Item", "Medida", "Enviado", "Comprado", "Voltou", "Consumo", "Estoque atual", "Mínimo", "Balanço"], ...linhas.map((l) => [l.setor, l.nome, l.un, l.env, l.comp, l.volta, l.cons, l.estoque, l.min, l.fechado ? "fechado" : "aberto"])]);
    if (sec.pessoas && admin) {
      add("Pessoas", [["Indicador", "Valor"], ["Encontristas", principais.length], ["Equipe", equipe], ["Cancelados", pessoas.length - ativos.length], ["Batizados", batizados], ["Necessidade de saúde", saude],
        [], ["Rede", "Encontristas"], ...conta(principais, (e) => um(e.encontrista_espiritual)?.rede ?? ""), [], ["Sexo", "Encontristas"], ...conta(principais, (e) => e.sexo ?? "")]);
      if (nomes) add("Lista nominal", [["Nome", "Categoria", "Rede"], ...ativos.map((e) => [e.nome, e.categoria ?? "", um(e.encontrista_espiritual)?.rede ?? ""])]);
    }
    if (sec.decisoes) add("Decisões", [["Decisão", "Quantidade"], ...porBotao, ...(admin && nomes ? [[], ["Nome", "Decisão", "Data"], ...dec.map((d) => [nomePor.get(d.encontrista_id) ?? "", d.botao, new Date(d.criado_em).toLocaleDateString("pt-BR")])] : [])] as (string | number)[][]);
    XLSX.writeFile(wb, `Relatorio_${ed!.nome.replace(/[^a-zA-Z0-9]+/g, "_")}.xlsx`);
    aviso("Planilha gerada.");
  }

  const Tit = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 mt-8 border-b-2 border-detalhe pb-1.5 text-xl font-extrabold print:mt-6 print:break-after-avoid">{children}</h2>;
  const Kpi = ({ v, t }: { v: number | string; t: string }) => <div className="rounded-2xl border border-borda bg-white p-3 print:break-inside-avoid"><div className="text-2xl font-extrabold leading-none">{v}</div><div className="mt-1 text-xs text-suave">{t}</div></div>;
  const Tab = ({ cab, linhas: ls }: { cab: string[]; linhas: (string | number)[][] }) => (
    <div className="overflow-x-auto rounded-2xl border border-borda bg-white print:overflow-visible">
      <table className="w-full border-collapse text-sm">
        <thead><tr className="bg-marca-clara text-left">{cab.map((c, i) => <th key={c} className={`px-3 py-2 font-bold ${i > 1 ? "text-right" : ""}`}>{c}</th>)}</tr></thead>
        <tbody>{ls.map((r, i) => <tr key={i} className="border-t border-borda print:break-inside-avoid">{r.map((c, j) => <td key={j} className={`px-3 py-1.5 ${j > 1 ? "text-right" : ""}`}>{typeof c === "number" ? fmtN(c) : c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );

  return (
    <div className="pb-8">
      <div className="print:hidden">
        <Titulo>Relatório geral</Titulo>
        <p className="m-0 pb-3 text-sm text-suave">Para apresentação e comprovação. Escolha o que entra e imprima (ou salve em PDF) ou baixe em Excel.</p>
        <div className="flex flex-wrap gap-2 pb-3">
          <Chip ativo={sec.materiais} onClick={() => setSec({ ...sec, materiais: !sec.materiais })}>Materiais</Chip>
          {admin && <Chip ativo={sec.pessoas} onClick={() => setSec({ ...sec, pessoas: !sec.pessoas })}>Pessoas</Chip>}
          <Chip ativo={sec.decisoes} onClick={() => setSec({ ...sec, decisoes: !sec.decisoes })}>Decisões</Chip>
          {admin && <Chip ativo={nomes} onClick={() => setNomes(!nomes)}>Com lista de nomes</Chip>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => window.print()} className="!min-h-11">Imprimir / salvar PDF</Botao>
          <Botao v="sec" onClick={excel} className="!min-h-11">Baixar Excel</Botao>
        </div>
      </div>

      <header className="mt-6 print:mt-0">
        <div className="text-xs font-extrabold uppercase tracking-wide text-marca">Relatório geral · {descricaoEd(ed)}</div>
        <h1 className="m-0 text-3xl font-extrabold">{ed.nome}</h1>
        <p className="m-0 text-sm text-suave">{dmy(ed.data_ini)}{ed.data_fim ? ` a ${dmy(ed.data_fim)}` : ""}{ed.local ? ` · ${ed.local}` : ""}{ed.resp ? ` · Responsável: ${ed.resp}` : ""}</p>
        <p className="m-0 text-xs text-suave">Gerado em {new Date().toLocaleString("pt-BR")}</p>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi v={linhas.length} t="itens enviados" />
        <Kpi v={emFalta} t="itens em falta no estoque" />
        {admin && <Kpi v={principais.length} t="encontristas" />}
        {admin && <Kpi v={equipe} t="equipe" />}
        <Kpi v={dec.length} t="decisões registradas" />
      </div>

      {sec.materiais && (
        <>
          <Tit>Materiais por setor</Tit>
          {setores.length === 0 && <Vazio>Nenhum item enviado para esta edição.</Vazio>}
          {setores.map((s) => {
            const l = linhas.filter((x) => x.setor === s);
            return (
              <section key={s} className="mb-5 print:break-inside-avoid-page">
                <h3 className="mb-2 flex items-baseline justify-between text-base font-extrabold"><span>{s}</span><span className="text-xs font-normal text-suave">{l.length} itens · balanço {l.every((x) => x.fechado) ? "fechado" : "aberto"}</span></h3>
                <Tab cab={["Item", "Medida", "Enviado", "Comprado", "Voltou", "Consumo", "Estoque"]} linhas={l.map((x) => [x.nome, x.un, x.env, x.comp, x.volta, x.cons, x.estoque])} />
              </section>
            );
          })}
        </>
      )}

      {sec.pessoas && admin && (
        <>
          <Tit>Pessoas</Tit>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi v={principais.length} t="encontristas" /><Kpi v={equipe} t="equipe" /><Kpi v={batizados} t="encontristas batizados" /><Kpi v={saude} t="com necessidade de saúde" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><h3 className="mb-2 text-base font-extrabold">Por rede</h3><Tab cab={["Rede", "Encontristas"]} linhas={conta(principais, (e) => um(e.encontrista_espiritual)?.rede ?? "")} /></div>
            <div><h3 className="mb-2 text-base font-extrabold">Por sexo</h3><Tab cab={["Sexo", "Encontristas"]} linhas={conta(principais, (e) => e.sexo ?? "")} /></div>
          </div>
          {nomes && (
            <div className="mt-4"><h3 className="mb-2 text-base font-extrabold">Lista nominal ({ativos.length})</h3>
              <Tab cab={["Nome", "Categoria", "Rede"]} linhas={ativos.map((e) => [e.nome, e.categoria ?? "", um(e.encontrista_espiritual)?.rede ?? ""])} /></div>
          )}
        </>
      )}

      {sec.decisoes && (
        <>
          <Tit>Decisões</Tit>
          {dec.length === 0 ? <Vazio>Nenhuma decisão registrada nesta edição.</Vazio> : (
            <>
              <Tab cab={["Decisão", "Quantidade"]} linhas={porBotao} />
              {admin && nomes && <div className="mt-4"><Tab cab={["Nome", "Decisão", "Data"]} linhas={dec.map((d) => [nomePor.get(d.encontrista_id) ?? "", d.botao, new Date(d.criado_em).toLocaleDateString("pt-BR")])} /></div>}
            </>
          )}
        </>
      )}
    </div>
  );
}
