"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { brl, dmy, norm, num, type Edicao, type Item } from "@/lib/tipos";
import { podeEscrever } from "@/lib/perm";
import { useAuth, useAviso, useEdicao } from "@/components/provedores";
import { AlugadosTab, Barras, ComprarTab, edicaoPadrao, type Alug, type Rep } from "@/components/financeiroIntegrado";
import { relatorioFinanceiroHtml } from "@/lib/financeiroRelatorio";
import { imprimirHtml } from "@/lib/drive";
import { temaDe } from "@/lib/cores";
import { Botao, Campo, Carregando, Cartao, Chip, Icone, Janela, Seletor, Titulo, Vazio, cx } from "@/components/ui";

type Lanc = { id: string; edicao_id: string | null; tipo: "entrada" | "saida"; descricao: string; categoria: string | null; valor: number; data: string; setor: string | null; comp_path: string | null; comp_nome: string | null; origem?: "manual" | "reposicao" | "aluguel"; qtd?: number | null };
const CATEGORIAS = ["Alimentação", "Material", "Transporte", "Local / hospedagem", "Impressão", "Inscrições", "Doações", "Outros"];

type Aba = "resumo" | "comprar" | "alugados" | "lancamentos" | "relatorio";

export default function Financeiro() {
  const { acesso } = useAuth();
  const { ed, eds, todas } = useEdicao();
  const aviso = useAviso();
  const lanc = useLista<Lanc>("lancamentos", "*", "data");
  const itens = useLista<Item>("itens", "*", "nome");
  const alugQ = useLista<Alug>("alugueis", "*", "criado_em");
  const [rep, setRep] = useState<Rep[] | null>(null);
  const [aba, setAba] = useState<Aba>("resumo");
  const [tipo, setTipo] = useState<"todos" | "entrada" | "saida">("todos");
  const [setor, setSetor] = useState("");
  const [form, setForm] = useState<Lanc | "novo" | null>(null);
  const [lim, setLim] = useState(50);
  const pode = podeEscrever(acesso, "financeiro") && ed?.status !== "fechada";
  const edAberta = (id: string | null) => eds.find((e) => e.id === id)?.status !== "fechada";

  const carregarRep = useCallback(async () => {
    const { data, error } = await supabase.rpc("reposicao_prevista");
    if (error) { aviso(msgErro(error)); setRep([]); return; }
    setRep(((data as Rep[]) ?? []).map((r) => ({ ...r, qtd: Number(r.qtd), minimo: Number(r.minimo), preco: Number(r.preco), falta: Number(r.falta), previsto: Number(r.previsto) })));
  }, [aviso]);
  useEffect(() => { carregarRep(); }, [carregarRep]);
  useEffect(() => { try { const a = localStorage.getItem("vv-aba-fin") as Aba | null; if (a) setAba(a); } catch {} }, []);
  const trocaAba = (a: Aba) => { setAba(a); try { localStorage.setItem("vv-aba-fin", a); } catch {} };
  const mudou = () => { lanc.recarregar(); itens.recarregar(); alugQ.recarregar(); carregarRep(); };

  const todos = useMemo(() => (lanc.dados ?? []).filter((l) => (ed ? l.edicao_id === ed.id : !!l.edicao_id)), [lanc.dados, ed]);
  const nomeEd = useMemo(() => new Map(eds.map((e) => [e.id, e.nome])), [eds]);
  const setores = useMemo(() => Array.from(new Set([...(itens.dados ?? []).map((i) => i.setor), ...todos.map((l) => l.setor ?? "")].filter(Boolean))).sort((a, b) => a.localeCompare(b)), [itens.dados, todos]);
  const cats = useMemo(() => Array.from(new Set([...CATEGORIAS, "Reposição de estoque", "Aluguel", ...(lanc.dados ?? []).map((l) => l.categoria ?? "")].filter(Boolean))), [lanc.dados]);
  const mapaItens = useMemo(() => new Map((itens.dados ?? []).map((i) => [i.id, i])), [itens.dados]);

  if (!ed && !todas) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!lanc.dados || !itens.dados || !alugQ.dados || !rep) return <Carregando />;

  const repOk: Rep[] = rep;
  const soma = (t: "entrada" | "saida") => todos.filter((l) => l.tipo === t).reduce((s, l) => s + Number(l.valor), 0);
  const ent = soma("entrada"), sai = soma("saida");
  const alugEd = alugQ.dados.filter((a) => !ed || a.edicao_id === ed.id);
  const escopo = ed ? ed.nome : "Todas as edições";
  const prevRep = rep.reduce((s, r) => s + Number(r.previsto), 0);
  const prevAlug = alugEd.filter((a) => !a.lancamento_id).reduce((s, a) => s + Number(a.valor), 0);
  const aPagar = prevRep + prevAlug;
  const semPreco = rep.filter((r) => !(Number(r.preco) > 0)).length;
  const vis = todos.filter((l) => (tipo === "todos" || l.tipo === tipo) && (!setor || l.setor === setor)).sort((a, b) => b.data.localeCompare(a.data) || 0);

  // gráficos: pago (lançamentos de saída) + a pagar (reposição e aluguéis ainda não pagos)
  const porSetor = new Map<string, { pago: number; previsto: number }>();
  const soma2 = (m: Map<string, { pago: number; previsto: number }>, k: string, campo: "pago" | "previsto", v: number) => { const x = m.get(k) ?? { pago: 0, previsto: 0 }; x[campo] += v; m.set(k, x); };
  todos.filter((l) => l.tipo === "saida").forEach((l) => soma2(porSetor, l.setor || "Sem setor", "pago", Number(l.valor)));
  rep.forEach((r) => soma2(porSetor, r.setor, "previsto", Number(r.previsto)));
  alugEd.filter((a) => !a.lancamento_id).forEach((a) => soma2(porSetor, mapaItens.get(a.item_id)?.setor ?? "Sem setor", "previsto", Number(a.valor)));
  const porCat = new Map<string, { pago: number; previsto: number }>();
  todos.filter((l) => l.tipo === "saida").forEach((l) => soma2(porCat, l.categoria || "Sem categoria", "pago", Number(l.valor)));
  if (prevRep > 0) soma2(porCat, "Reposição de estoque", "previsto", prevRep);
  if (prevAlug > 0) soma2(porCat, "Aluguel", "previsto", prevAlug);
  const linhas = (m: Map<string, { pago: number; previsto: number }>) => Array.from(m.entries()).map(([nome, v]) => ({ nome, ...v })).filter((l) => l.pago + l.previsto > 0).sort((a, b) => b.pago + b.previsto - (a.pago + a.previsto));

  const porEdicao = todas ? eds.map((e) => {
    const ls = todos.filter((l) => l.edicao_id === e.id);
    return { nome: e.nome, entrou: ls.filter((l) => l.tipo === "entrada").reduce((x, l) => x + Number(l.valor), 0), saiu: ls.filter((l) => l.tipo === "saida").reduce((x, l) => x + Number(l.valor), 0), aPagar: alugEd.filter((a) => a.edicao_id === e.id && !a.lancamento_id).reduce((x, a) => x + Number(a.valor), 0) };
  }).filter((e) => e.entrou + e.saiu + e.aPagar > 0) : undefined;
  const dadosRel = () => ({
    titulo: escopo, subtitulo: ed ? "uma edição" : "todas as edições somadas", cor: temaDe(ed).marca,
    entrou: ent, saiu: sai, aPagar, porEdicao, porCategoria: linhas(porCat), porSetor: linhas(porSetor),
    compras: todos.filter((l) => l.origem === "reposicao").sort((a, b) => a.data.localeCompare(b.data)).map((l) => ({ data: l.data, item: l.descricao.replace(/^Compra: /, ""), setor: l.setor ?? "", qtd: Number(l.qtd ?? 0), valor: Number(l.valor), edicao: nomeEd.get(l.edicao_id ?? "") ?? "" })),
    aComprar: repOk.map((r) => ({ item: r.nome, setor: r.setor, falta: r.falta, un: r.un, preco: Number(r.preco), previsto: Number(r.previsto) })),
    alugueis: alugEd.map((a) => ({ item: mapaItens.get(a.item_id)?.nome ?? "", qtd: Number(a.qtd), fornecedor: a.fornecedor ?? "", valor: Number(a.valor), pago: !!a.lancamento_id, edicao: nomeEd.get(a.edicao_id) ?? "" })),
    lancamentos: todos.slice().sort((a, b) => b.data.localeCompare(a.data)).map((l) => ({ data: l.data, tipo: l.tipo, descricao: l.descricao, categoria: l.categoria ?? "", setor: l.setor ?? "", valor: Number(l.valor), edicao: nomeEd.get(l.edicao_id ?? "") ?? "" })),
  });
  const htmlRel = relatorioFinanceiroHtml(dadosRel());

  async function anexo(l: Lanc) {
    if (!l.comp_path) return;
    const { data, error } = await supabase.storage.from("comprovantes").createSignedUrl(l.comp_path, 300);
    if (error || !data) { aviso("Não consegui abrir o anexo."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }
  async function excel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Edição", "Data", "Tipo", "Descrição", "Categoria", "Setor", "Valor", "Anexo"], ...todos.slice().sort((a, b) => a.data.localeCompare(b.data)).map((l) => [nomeEd.get(l.edicao_id ?? "") ?? "", dmy(l.data), l.tipo === "entrada" ? "Entrada" : "Saída", l.descricao, l.categoria ?? "", l.setor ?? "", l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor), l.comp_nome ?? ""]), [], ["", "", "", "", "", "Entradas", ent], ["", "", "", "", "", "Saídas", -sai], ["", "", "", "", "", "Resultado", ent - sai]]), "Lançamentos");
    if (porEdicao) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Edição", "Entrou", "Saiu", "Aluguéis a pagar", "Resultado"], ...porEdicao.map((e) => [e.nome, e.entrou, e.saiu, e.aPagar, e.entrou - e.saiu])]), "Por edição");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Categoria", "Pago", "A pagar"], ...linhas(porCat).map((l) => [l.nome, l.pago, l.previsto])]), "Por categoria");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Setor", "Pago", "A pagar"], ...linhas(porSetor).map((l) => [l.nome, l.pago, l.previsto])]), "Por setor");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Item", "Setor", "Tem", "Mínimo", "Comprar", "Unidade", "Preço unit.", "Previsto"], ...repOk.map((r) => [r.nome, r.setor, r.qtd, r.minimo, r.falta, r.un, r.preco, r.previsto])]), "A comprar");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Edição", "Item", "Setor", "Qtd", "Fornecedor", "Valor", "Situação"], ...alugEd.map((a) => [nomeEd.get(a.edicao_id) ?? "", mapaItens.get(a.item_id)?.nome ?? "", mapaItens.get(a.item_id)?.setor ?? "", Number(a.qtd), a.fornecedor ?? "", Number(a.valor), a.lancamento_id ? "Pago" : "A pagar"])]), "Alugados");
    XLSX.writeFile(wb, `Financeiro_${escopo.replace(/[^a-zA-Z0-9]+/g, "_")}.xlsx`);
  }

  const ABAS: { v: Aba; t: string; n?: number }[] = [{ v: "resumo", t: "Resumo" }, { v: "comprar", t: "A comprar", n: rep.length }, { v: "alugados", t: "Alugados", n: alugEd.filter((a) => !a.lancamento_id).length }, { v: "lancamentos", t: "Lançamentos" }, { v: "relatorio", t: "Relatório" }];

  return (
    <div className="pb-28">
      <Titulo direita={<Botao v="sec" className="!min-h-11" onClick={excel}>Exportar</Botao>}>Financeiro</Titulo>
      <p className="m-0 pb-3 text-sm text-suave">{escopo} · {ed ? "o que é gasto aqui vale para esta edição" : "somando todas as edições; ao lançar um valor você escolhe a edição"}</p>

      <div className="flex gap-2 overflow-x-auto pb-3">
        {ABAS.map((a) => <Chip key={a.v} ativo={aba === a.v} onClick={() => trocaAba(a.v)}>{a.t}{a.n ? <span className={cx("ml-2 rounded-full px-2 text-xs", aba === a.v ? "bg-white/25" : "bg-alerta-clara text-[#8e2e18]")}>{a.n}</span> : null}</Chip>)}
      </div>

      {aba === "resumo" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-3xl border border-borda bg-white p-4"><div className="text-xs text-suave">Entrou</div><b className="text-xl text-[#1e7a50]">{brl(ent)}</b></div>
            <div className="rounded-3xl border border-borda bg-white p-4"><div className="text-xs text-suave">Saiu (pago)</div><b className="text-xl text-alerta">{brl(sai)}</b></div>
            <div className="rounded-3xl border border-borda bg-white p-4"><div className="text-xs text-suave">Sobrou agora</div><b className={cx("text-xl", ent - sai < 0 && "text-alerta")}>{brl(ent - sai)}</b></div>
            <button type="button" onClick={() => trocaAba("comprar")} className="rounded-3xl border-2 border-[#e8a400] bg-white p-4 text-left"><div className="text-xs text-suave">Ainda a pagar</div><b className="text-xl">{brl(aPagar)}</b><div className="text-xs text-suave">Reposição {brl(prevRep)} · Aluguéis {brl(prevAlug)}</div></button>
          </div>
          <Cartao className={cx("flex flex-wrap items-center justify-between gap-2 p-4", ent - sai - aPagar < 0 && "!border-alerta")}>
            <span className="text-sm text-suave">Se tudo que está previsto for pago, o caixa {ed ? "desta edição" : "geral"} fica em</span>
            <b className={cx("text-xl", ent - sai - aPagar < 0 && "text-alerta")}>{brl(ent - sai - aPagar)}</b>
          </Cartao>
          {semPreco > 0 && (
            <button type="button" onClick={() => trocaAba("comprar")} className="rounded-2xl bg-aviso-clara px-4 py-3 text-left text-sm font-bold text-aviso">{semPreco} {semPreco === 1 ? "item abaixo do mínimo está" : "itens abaixo do mínimo estão"} sem preço, então o custo previsto está subestimado. Toque para informar os preços.</button>
          )}
          {porEdicao && (
            <Cartao className="overflow-hidden">
              <div className="bg-fundo px-4 py-2.5"><b>Por edição</b></div>
              {porEdicao.length === 0 && <p className="m-0 px-4 py-3 text-sm text-suave">Nenhum valor lançado ainda em nenhuma edição.</p>}
              {porEdicao.map((e) => (
                <div key={e.nome} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-borda px-4 py-3 first:border-t-0">
                  <b className="min-w-[140px]">{e.nome}</b>
                  <span className="text-sm text-suave">Entrou <b className="text-[#1e7a50]">{brl(e.entrou)}</b> · Saiu <b className="text-alerta">{brl(e.saiu)}</b>{e.aPagar > 0 ? <> · A pagar <b className="text-texto">{brl(e.aPagar)}</b></> : null}</span>
                  <b className={cx(e.entrou - e.saiu < 0 && "text-alerta")}>{brl(e.entrou - e.saiu)}</b>
                </div>
              ))}
            </Cartao>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Barras titulo="Por setor" linhas={linhas(porSetor)} />
            <Barras titulo="Por categoria" linhas={linhas(porCat)} />
          </div>
          <Cartao className="p-4">
            <b>Últimos lançamentos</b>
            {todos.length === 0 && <p className="m-0 mt-2 text-sm text-suave">Nenhum lançamento ainda.</p>}
            {todos.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 border-t border-borda py-2 first:mt-2 first:border-t-0"><span className="min-w-0 truncate text-sm">{l.descricao}<span className="block text-xs text-suave">{dmy(l.data)}</span></span><b className={cx("shrink-0 text-sm", l.tipo === "saida" ? "text-alerta" : "text-[#1e7a50]")}>{l.tipo === "saida" ? "− " : "+ "}{brl(Number(l.valor))}</b></div>
            ))}
            {todos.length > 5 && <button type="button" onClick={() => trocaAba("lancamentos")} className="mt-2 text-sm font-bold text-marca">Ver todos</button>}
          </Cartao>
        </div>
      )}

      {aba === "comprar" && <ComprarTab rep={rep} pode={pode} edicaoId={ed?.id ?? null} edicoes={eds} onMudou={mudou} />}
      {aba === "alugados" && <AlugadosTab alug={alugQ.dados} itens={itens.dados} pode={pode} edicaoId={ed?.id ?? null} edicoes={eds} onMudou={mudou} />}

      {aba === "relatorio" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Botao className="!min-h-11" onClick={() => imprimirHtml(htmlRel)}><Icone n="imprimir" tam={18} />Imprimir / salvar PDF</Botao>
            <Botao v="sec" className="!min-h-11" onClick={excel}>Baixar Excel</Botao>
          </div>
          <p className="m-0 text-sm text-suave">{ed ? "Relatório desta edição." : "Relatório anual: todas as edições somadas, com o quadro por edição."} Na janela de impressão escolha “Salvar como PDF”.</p>
          <iframe title="Relatório financeiro" sandbox="" srcDoc={htmlRel} className="h-[75dvh] w-full rounded-2xl border border-borda bg-white" />
        </div>
      )}

      {aba === "lancamentos" && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Chip ativo={tipo === "todos"} onClick={() => setTipo("todos")}>Tudo</Chip>
            <Chip ativo={tipo === "saida"} onClick={() => setTipo("saida")}>Despesas</Chip>
            <Chip ativo={tipo === "entrada"} onClick={() => setTipo("entrada")}>Receitas</Chip>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3">
            <Chip ativo={!setor} onClick={() => setSetor("")}>Todos os setores</Chip>
            {setores.map((s) => <Chip key={s} ativo={setor === s} onClick={() => setSetor(setor === s ? "" : s)}>{s}</Chip>)}
          </div>
          {vis.length === 0 && <Vazio>Nenhum lançamento encontrado.</Vazio>}
          <Cartao className="overflow-hidden">
            {vis.slice(0, lim).map((l, i) => {
              const neg = l.tipo === "saida";
              return (
                <div key={l.id} className={cx("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-borda")}>
                  <div className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-extrabold", neg ? "bg-alerta-clara text-alerta" : "bg-[#e3f5ec] text-[#1e7a50]")}>{neg ? "−" : "+"}</div>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{l.descricao}</b>
                    <span className="text-xs text-suave">{!ed && nomeEd.get(l.edicao_id ?? "") ? `${nomeEd.get(l.edicao_id ?? "")} · ` : ""}{dmy(l.data)} · {l.setor || (neg ? "Sem setor" : "Receita")}{l.categoria ? ` · ${l.categoria}` : ""}</span>
                    <div className="text-xs">{l.origem === "reposicao" && <span className="mr-2 font-bold text-marca">Reposição do estoque</span>}{l.origem === "aluguel" && <span className="mr-2 font-bold text-marca">Aluguel</span>}{l.comp_path ? <button type="button" onClick={() => anexo(l)} className="font-bold text-marca">Ver anexo</button> : neg ? <span className="text-suave">Sem anexo</span> : null}</div>
                  </div>
                  <b className={cx("shrink-0", neg ? "text-alerta" : "text-[#1e7a50]")}>{neg ? "− " : "+ "}{brl(Number(l.valor))}</b>
                  {pode && edAberta(l.edicao_id) && <button type="button" aria-label={`Editar ${l.descricao}`} onClick={() => setForm(l)} className="grid h-10 w-10 shrink-0 place-items-center text-suave"><Icone n="lapis" tam={18} /></button>}
                </div>
              );
            })}
          </Cartao>
          {vis.length > lim && <div className="pt-3 text-center"><Botao v="sec" className="!min-h-11" onClick={() => setLim(lim + 50)}>Ver mais ({vis.length - lim})</Botao></div>}
        </>
      )}

      {pode && (aba === "resumo" || aba === "lancamentos") && (
        <button type="button" onClick={() => setForm("novo")} className="fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-marca px-5 text-base font-extrabold text-white shadow-lg md:bottom-8 md:right-8" style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}>
          <Icone n="mais1" tam={20} />Lançar valor
        </button>
      )}
      {form && <FormLanc l={form === "novo" ? null : form} edicaoId={ed?.id ?? null} edicoes={eds.filter((e) => e.status !== "fechada")} setores={setores} cats={cats} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); lanc.recarregar(); alugQ.recarregar(); }} />}
    </div>
  );
}

function FormLanc({ l, edicaoId, edicoes, setores, cats, onFechar, onSalvo }: { l: Lanc | null; edicaoId: string | null; edicoes: Edicao[]; setores: string[]; cats: string[]; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const { acesso } = useAuth();
  const [f, setF] = useState({ tipo: (l?.tipo ?? "saida") as "entrada" | "saida", descricao: l?.descricao ?? "", valor: l ? String(l.valor).replace(".", ",") : "", data: l?.data ?? new Date().toISOString().slice(0, 10), categoria: l?.categoria ?? "", setor: l?.setor ?? "" });
  const [edSel, setEdSel] = useState(l?.edicao_id ?? edicaoId ?? edicaoPadrao(edicoes));
  const [arq, setArq] = useState<File | null>(null);
  const [tiraAnexo, setTiraAnexo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [del, setDel] = useState(false);
  useEffect(() => { if (f.tipo === "entrada" && f.setor) setF((x) => ({ ...x, setor: "" })); }, [f.tipo, f.setor]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = num(f.valor);
    if (!f.descricao.trim()) { aviso("Descreva o lançamento."); return; }
    if (!isFinite(v) || v <= 0) { aviso("Informe um valor maior que zero."); return; }
    if (arq && arq.size > 8 * 1024 * 1024) { aviso("O anexo passa de 8 MB."); return; }
    if (!edSel) { aviso("Escolha a edição."); return; }
    setSalvando(true);
    let comp_path = l?.comp_path ?? null, comp_nome = l?.comp_nome ?? null;
    if ((tiraAnexo || arq) && l?.comp_path) { await supabase.storage.from("comprovantes").remove([l.comp_path]); comp_path = null; comp_nome = null; }
    if (arq) {
      const caminho = `${edSel}/${Date.now()}-${arq.name.normalize("NFD").replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
      const up = await supabase.storage.from("comprovantes").upload(caminho, arq, { contentType: arq.type || undefined });
      if (up.error) { setSalvando(false); aviso(msgErro(up.error)); return; }
      comp_path = caminho; comp_nome = arq.name;
    }
    const d = { edicao_id: edSel, tipo: f.tipo, descricao: f.descricao.trim(), valor: v, data: f.data, categoria: f.categoria.trim() || null, setor: f.tipo === "saida" ? f.setor || null : null, comp_path, comp_nome };
    const r = l ? await supabase.from("lancamentos").update(d).eq("id", l.id) : await supabase.from("lancamentos").insert({ ...d, por: acesso?.id ?? null });
    setSalvando(false);
    if (r.error) { aviso(msgErro(r.error)); return; }
    aviso(l ? "Lançamento atualizado." : "Lançamento salvo."); onSalvo();
  }
  async function excluir() {
    if (!l) return;
    if (l.comp_path) await supabase.storage.from("comprovantes").remove([l.comp_path]);
    const { error } = await supabase.from("lancamentos").delete().eq("id", l.id);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Lançamento excluído."); onSalvo();
  }

  return (
    <Janela titulo={l ? "Editar lançamento" : "Lançar valor"} onFechar={onFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-3.5">
        {!edicaoId && !l && <Seletor rotulo="Edição" value={edSel} onChange={(e) => setEdSel(e.target.value)}>{edicoes.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.status === "planejada" ? " (planejada)" : ""}</option>)}</Seletor>}
        <div className="grid grid-cols-2 gap-2">
          <Chip ativo={f.tipo === "saida"} onClick={() => setF({ ...f, tipo: "saida" })}>Despesa</Chip>
          <Chip ativo={f.tipo === "entrada"} onClick={() => setF({ ...f, tipo: "entrada" })}>Receita</Chip>
        </div>
        <Campo rotulo="Descrição" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: Compra de balões" />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Valor (R$)" inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder="0,00" />
          <Campo rotulo="Data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-bold">Categoria
          <input list="cats-fin" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} className="min-h-12 rounded-2xl border border-borda bg-white px-4 text-base font-normal outline-none focus:border-marca" placeholder="Escolha ou digite" />
          <datalist id="cats-fin">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        {f.tipo === "saida" && (
          <Seletor rotulo="Setor que gastou" value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })}>
            <option value="">Sem setor</option>
            {setores.map((s) => <option key={s} value={s}>{s}</option>)}
          </Seletor>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Comprovante (foto ou PDF)</span>
          {l?.comp_nome && !tiraAnexo && !arq && <div className="flex items-center justify-between rounded-xl bg-fundo px-3 py-2 text-sm"><span className="truncate">{l.comp_nome}</span><button type="button" className="font-bold text-alerta" onClick={() => setTiraAnexo(true)}>Remover</button></div>}
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setArq(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        <Botao type="submit" bloco disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao>
        {l && !del && <Botao v="sec" bloco className="!text-alerta" onClick={() => setDel(true)}><Icone n="lixo" tam={18} />Excluir lançamento</Botao>}
        {l && del && <Botao v="perigo" bloco onClick={excluir}>Confirmar: excluir</Botao>}
      </form>
    </Janela>
  );
}
