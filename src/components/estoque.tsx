"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { fmtN, norm, num, type Edicao, type Envio, type Equipe, type Item } from "@/lib/tipos";
import { ehPaiol, podeEscrever, setoresDaEquipe } from "@/lib/perm";
import { useAuth, useAviso, useEdicao } from "@/components/provedores";
import { lerInventario, type ItemInv } from "@/lib/inventario";
import { Botao, Campo, Carregando, Chip, Cartao, Icone, Janela, Passo, Selo, Seletor, Titulo, Vazio, cx } from "@/components/ui";

type Aba = "geral" | "enviado" | "balanco";
const UNIDADES = ["un", "pacotes", "caixas", "rolos", "pares", "kg", "litros", "metros", "garrafas", "cilindros"];
const emFalta = (i: Item) => i.min > 0 && i.qtd < i.min;

export function Estoque({ setor }: { setor?: string }) {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const todos = useLista<Item>("itens", "*", "nome");
  const envios = useLista<Envio>("envios");
  const equipes = useLista<Equipe>("equipes", "*", "nome");
  const { eds: listaEd, ed } = useEdicao();
  const equipe = !!setor; // dentro de Equipes: só vê o que recebeu e informa o balanço; o estoque geral fica em /estoque
  const [aba, setAba] = useState<Aba>(equipe ? "enviado" : "geral");
  const [aberto, setAberto] = useState<Item | "novo" | null>(null);
  const [importando, setImportando] = useState(false);

  useEffect(() => { try { const a = localStorage.getItem("vv-aba-estoque") as Aba | null; if (a && (!equipe || a !== "geral")) setAba(a); } catch {} }, [equipe]);
  const trocaAba = (a: Aba) => { setAba(a); try { localStorage.setItem("vv-aba-estoque", a); } catch {} };

  const setores = useMemo(() => {
    const s = new Set<string>();
    (todos.dados ?? []).forEach((i) => s.add(i.setor));
    (equipes.dados ?? []).forEach((e) => e.setores.forEach((x) => s.add(x)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [todos.dados, equipes.dados]);

  const podeAlgum = setor ? podeEscrever(acesso, "estoque", setor) : podeEscrever(acesso, "estoque") || setoresDaEquipe(acesso).length > 0;

  if (!todos.dados || !envios.dados) return <Carregando />;
  const dados = setor ? todos.dados.filter((i) => i.setor === setor) : todos.dados;
  const itens = { ...todos, dados };

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-3">
        {!equipe && <Chip ativo={aba === "geral"} onClick={() => trocaAba("geral")}>Geral</Chip>}
        <Chip ativo={aba === "enviado"} onClick={() => trocaAba("enviado")}>{equipe ? "Material recebido" : "Enviado"}</Chip>
        <Chip ativo={aba === "balanco"} onClick={() => trocaAba("balanco")}>Balanço</Chip>
      </div>

      {aba !== "geral" && !ed && <Vazio>Crie uma edição em “Edições” para usar o enviado e o balanço.</Vazio>}

      {aba === "geral" && !setor && podeEscrever(acesso, "estoque") && (
        <div className="pb-3"><Botao v="sec" onClick={() => setImportando(true)} className="!min-h-11">Importar itens da planilha (Excel)</Botao></div>
      )}
      {!equipe && aba === "geral" && <Geral itens={itens.dados} onAbrir={setAberto} />}
      {aba === "enviado" && ed && <Enviado equipe={equipe} itens={itens.dados} envios={envios.dados} edicoes={listaEd} ed={ed} recarregar={() => { todos.recarregar(); envios.recarregar(); }} setItens={todos.setDados} setEnvios={envios.setDados} />}
      {aba === "balanco" && ed && (equipe
        ? <BalancoEquipe setor={setor!} itens={itens.dados} envios={envios.dados} ed={ed} recarregar={() => { todos.recarregar(); envios.recarregar(); }} />
        : <BalancoPaiol itens={itens.dados} envios={envios.dados} ed={ed} recarregar={() => { todos.recarregar(); envios.recarregar(); }} />)}

      {!equipe && aba === "geral" && podeAlgum && (
        <button type="button" onClick={() => setAberto("novo")} className="fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-marca px-5 text-base font-extrabold text-white shadow-lg md:bottom-8 md:right-8" style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}>
          <Icone n="mais1" tam={20} />Novo item
        </button>
      )}

      {importando && <ImportarItens existentes={todos.dados} onFechar={() => setImportando(false)} onFeito={() => todos.recarregar()} />}

      {aberto && (
        <ItemJanela item={aberto === "novo" ? null : aberto} setores={setores} setorPadrao={setor} onFechar={() => setAberto(null)}
          onMudou={() => { todos.recarregar(); }} aviso={aviso} />
      )}
    </div>
  );
}

/* ---------------- Geral ---------------- */
function Geral({ itens, onAbrir }: { itens: Item[]; onAbrir: (i: Item) => void }) {
  const [q, setQ] = useState("");
  const [soFalta, setSoFalta] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const nq = norm(q);
  const filtrados = itens.filter((i) => (!soFalta || emFalta(i)) && (!nq || norm(i.nome + " " + i.setor).includes(nq)));
  const grupos = useMemo(() => {
    const m = new Map<string, Item[]>();
    filtrados.forEach((i) => { if (!m.has(i.setor)) m.set(i.setor, []); m.get(i.setor)!.push(i); });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtrados]);
  const nFalta = itens.filter(emFalta).length;
  const forcarAberto = !!nq || soFalta;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-2xl border border-borda bg-white px-3">
        <Icone n="busca" tam={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item pelo nome (ex.: tesoura)" aria-label="Buscar item" className="min-h-12 flex-1 bg-transparent outline-none" />
      </div>
      {nFalta > 0 && (
        <button type="button" onClick={() => setSoFalta((v) => !v)} className={cx("flex min-h-12 items-center justify-between rounded-2xl px-4 text-[15px] font-extrabold", soFalta ? "bg-alerta text-white" : "bg-alerta-clara text-[#8e2e18]")}>
          <span>{nFalta} {nFalta === 1 ? "item em falta" : "itens em falta"}</span><span>{soFalta ? "Ver todos" : "Ver só eles"}</span>
        </button>
      )}
      {grupos.length === 0 && <Vazio>Nenhum item encontrado.</Vazio>}
      {grupos.map(([setor, lista]) => {
        const aberto = forcarAberto || abertos[setor] || grupos.length === 1;
        const faltas = lista.filter(emFalta).length;
        return (
          <Cartao key={setor} className="overflow-hidden">
            <button type="button" onClick={() => setAbertos((a) => ({ ...a, [setor]: !a[setor] }))} className="flex min-h-[60px] w-full items-center gap-2.5 px-4 text-left">
              <b className="flex-1 text-[17px]">{setor}</b>
              {faltas > 0 && <Selo tom="alerta">{faltas} em falta</Selo>}
              <span className="text-sm text-suave">{lista.length} {lista.length === 1 ? "item" : "itens"}</span>
              <span className={cx("text-suave transition", aberto && "rotate-180")}><Icone n="seta" tam={18} /></span>
            </button>
            {aberto && lista.map((i) => {
              const r = i.min > 0 ? Math.min(1, i.qtd / i.min) : 1, low = emFalta(i);
              return (
                <button key={i.id} type="button" onClick={() => onAbrir(i)} className="flex min-h-16 w-full items-center gap-3 border-t border-borda px-4 py-2 text-left">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <b className="text-[15px]">{i.nome}</b>
                    {i.min > 0 && <div className="h-1.5 overflow-hidden rounded-full bg-[#ecebe6]"><div className={cx("h-full", low ? "bg-alerta" : "bg-marca")} style={{ width: `${Math.round(r * 100)}%` }} /></div>}
                  </div>
                  <div className="text-right leading-tight">
                    <b className={cx("text-[22px]", low && "text-alerta")}>{fmtN(i.qtd)}</b>
                    <div className="text-xs text-suave">{i.un}{i.min > 0 ? ` · mín. ${fmtN(i.min)}` : ""}</div>
                  </div>
                </button>
              );
            })}
          </Cartao>
        );
      })}
    </div>
  );
}

/* ---------------- Enviado ---------------- */
function Enviado({ equipe, itens, envios, edicoes, ed, recarregar, setItens, setEnvios }: {
  equipe: boolean; itens: Item[]; envios: Envio[]; edicoes: Edicao[]; ed: Edicao; recarregar: () => void;
  setItens: React.Dispatch<React.SetStateAction<Item[] | null>>; setEnvios: React.Dispatch<React.SetStateAction<Envio[] | null>>;
}) {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const [q, setQ] = useState("");
  const nq = norm(q);
  const doEd = (id: string) => envios.find((x) => x.edicao_id === ed.id && x.item_id === id);
  const lista = itens.filter((i) => !nq || norm(i.nome + " " + i.setor).includes(nq));
  const ord = (a: Item, b: Item) => a.setor.localeCompare(b.setor) || a.nome.localeCompare(b.nome);
  const enviados = lista.filter((i) => doEd(i.id)).sort(ord);
  const resto = equipe ? [] : lista.filter((i) => !doEd(i.id)).sort(ord);
  const anterior = edicoes.filter((e) => e.id !== ed.id && (e.data_ini ?? "") <= (ed.data_ini ?? "") && envios.some((x) => x.edicao_id === e.id)).sort((a, b) => (b.data_ini ?? "").localeCompare(a.data_ini ?? ""))[0];
  const totalItens = envios.filter((x) => x.edicao_id === ed.id).length;
  const totalUn = envios.filter((x) => x.edicao_id === ed.id).reduce((s, x) => s + Number(x.env), 0);

  async function definir(i: Item, v: number) {
    const atual = doEd(i.id)?.env ?? 0;
    if (v === atual) return;
    // mostra já na tela; o banco confirma em seguida
    setItens((p) => (p ?? []).map((x) => (x.id === i.id ? { ...x, qtd: x.qtd + Number(atual) - v } : x)));
    setEnvios((p) => {
      const l = (p ?? []).filter((x) => !(x.edicao_id === ed.id && x.item_id === i.id));
      return v > 0 ? [...l, { edicao_id: ed.id, item_id: i.id, env: v, comp: 0, volta: null, aplicado: null }] : l;
    });
    const { error } = await supabase.rpc("definir_envio", { p_edicao: ed.id, p_item: i.id, p_env: v });
    if (error) aviso(msgErro(error));
    recarregar();
  }

  async function copiar() {
    if (!anterior) return;
    const { data, error } = await supabase.rpc("copiar_envio", { p_edicao: ed.id, p_origem: anterior.id });
    if (error) aviso(msgErro(error)); else aviso(`${data ?? 0} itens copiados de ${anterior.nome}.`);
    recarregar();
  }

  const linha = (i: Item) => {
    const x = doEd(i.id), v = x ? Number(x.env) : 0, fechado = !!x && (x.aplicado != null || !!x.informado);
    const pode = !equipe && ehPaiol(acesso);
    return (
      <div key={i.id} className={cx("flex min-h-16 items-center gap-2.5 rounded-2xl border px-3 py-2", v > 0 ? "border-[#a9d3c2] bg-marca-clara" : "border-borda bg-white")}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="text-[15px]">{i.nome}</b>
          {equipe ? <span className="text-xs text-suave">{i.un}</span> : <span className="text-xs text-suave">{i.setor} · no depósito {v > 0 && !fechado ? `${fmtN(i.qtd + v)} → ${fmtN(i.qtd)}` : fmtN(i.qtd)}</span>}
        </div>
        {pode && !fechado ? <Passo valor={v} onMudar={(n) => definir(i, n)} /> : <div className="text-right"><b>{fmtN(v)} {i.un}</b>{fechado && !equipe && <div className="text-xs text-suave">{doEd(i.id)?.aplicado != null ? "balanço conferido" : "balanço informado"}</div>}</div>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      {equipe && <p className="m-0 px-1 text-sm text-suave">É o material que o paiol enviou para a sua equipe nesta edição. {enviados.length === 0 ? "Nada foi enviado ainda." : "No fim, informe o que voltou em Balanço."}</p>}
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-borda bg-white px-3">
          <Icone n="busca" tam={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item pelo nome" aria-label="Buscar item" className="min-h-12 min-w-0 flex-1 bg-transparent outline-none" />
        </div>
        {!equipe && anterior && ehPaiol(acesso) && <Botao v="suave" onClick={copiar} className="!px-3 !text-sm">Copiar da última</Botao>}
      </div>
      {enviados.length > 0 && <div className="px-1 pt-1 text-[13px] font-extrabold uppercase tracking-wide text-marca">Enviados · {enviados.length}</div>}
      {enviados.map(linha)}
      {resto.length > 0 && <div className="px-1 pt-3 text-[13px] font-extrabold uppercase tracking-wide text-suave">{enviados.length ? "Todo o estoque" : "Itens do estoque"}</div>}
      {resto.map(linha)}
      {lista.length === 0 && <Vazio>Nenhum item com esse nome.</Vazio>}

      {!equipe && (
        <div className="fixed inset-x-0 z-30 flex items-center justify-between gap-3 border-t border-borda bg-white px-4 py-3 md:left-64" style={{ bottom: "calc(env(safe-area-inset-bottom) + 66px)" }}>
          <div className="leading-tight"><b>{totalItens} itens · {fmtN(totalUn)} un.</b><div className="text-xs text-suave">O estoque geral já desconta</div></div>
          <Selo tom="ok">Segue para o Balanço</Selo>
        </div>
      )}
      <div className="h-16" />
    </div>
  );
}

/* ---------------- Balanço da equipe (servo do setor) ---------------- */
function BalancoEquipe({ setor, itens, envios, ed, recarregar }: { setor: string; itens: Item[]; envios: Envio[]; ed: Edicao; recarregar: () => void }) {
  const aviso = useAviso();
  const [enviando, setEnviando] = useState(false);
  const lista = envios.filter((x) => x.edicao_id === ed.id).map((x) => ({ x, it: itens.find((i) => i.id === x.item_id)! })).filter((r) => r.it).sort((a, b) => a.it.nome.localeCompare(b.it.nome));
  const volta = (x: Envio) => (x.volta == null ? Number(x.env) + Number(x.comp) : Number(x.volta));
  const editaveis = lista.filter((r) => r.x.aplicado == null && !r.x.informado);

  async function salvar(r: { x: Envio; it: Item }, campo: "volta" | "comp", v: number) {
    const limite = campo === "volta" ? Number(r.x.env) + Number(r.x.comp) : Infinity;
    if (v > limite) { aviso(`Só levou ${fmtN(limite)}. Não dá para voltar mais que isso.`); recarregar(); return; }
    const { error } = await supabase.rpc("salvar_volta", { p_edicao: ed.id, p_item: r.x.item_id, p_volta: campo === "volta" ? v : null, p_comp: campo === "comp" ? v : null });
    if (error) aviso(msgErro(error));
    recarregar();
  }
  async function enviar() {
    setEnviando(true);
    const { data, error } = await supabase.rpc("enviar_balanco", { p_edicao: ed.id, p_setor: setor });
    setEnviando(false);
    if (error) aviso(msgErro(error)); else aviso(`Balanço enviado ao paiol (${data ?? 0} itens). Agora eles conferem.`);
    recarregar();
  }

  if (lista.length === 0) return <Vazio>Nada foi enviado para a sua equipe nesta edição. Quando o paiol enviar, o balanço aparece aqui.</Vazio>;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 px-1 text-sm text-suave">Para cada item, diga quanto <b>voltou</b>. O que não voltou conta como usado. Não dá para passar do que você levou.</p>
      {lista.map((r) => {
        const v = volta(r.x), levou = Number(r.x.env) + Number(r.x.comp), usou = levou - v;
        const conferido = r.x.aplicado != null, enviado = !!r.x.informado && !conferido, livre = !conferido && !enviado;
        return (
          <div key={r.x.item_id} className={cx("flex flex-col gap-2.5 rounded-3xl border-2 bg-white p-3.5", conferido ? "border-[#a9d3c2]" : "border-borda")}>
            <div className="flex items-center justify-between gap-2">
              <b className="text-base">{r.it.nome}</b>
              <span className="whitespace-nowrap text-[13px] text-suave">levou <b className="text-[15px] text-texto">{fmtN(levou)}</b> {r.it.un}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col"><span className="text-xs font-bold text-suave">Voltou</span>
                <span className="text-[13px] font-bold">{usou === 0 ? "nada usado" : `usou ${fmtN(usou)}`}</span></div>
              {livre ? <Passo grande valor={v} onMudar={(n) => salvar(r, "volta", n)} /> : <b className="text-[26px]">{fmtN(v)}</b>}
            </div>
            {livre && (
              <label className="flex items-center justify-end gap-1.5 text-xs text-suave">comprado/extra levado
                <input inputMode="decimal" defaultValue={String(r.x.comp).replace(".", ",")} onBlur={(e) => { const n = num(e.target.value || "0"); if (isFinite(n) && n >= 0 && n !== Number(r.x.comp)) salvar(r, "comp", n); }} className="h-9 w-14 rounded-lg border border-borda bg-white text-center text-texto" aria-label="Quantidade comprada" />
              </label>
            )}
            {enviado && <span className="text-xs font-bold text-suave">Enviado ao paiol, aguardando a conferência.</span>}
            {conferido && <span className="text-xs font-bold text-marca">Conferido pelo paiol ✓</span>}
          </div>
        );
      })}
      <div className="h-24" />
      {editaveis.length > 0 && (
        <div className="fixed inset-x-0 z-30 flex flex-col gap-2 border-t border-borda bg-white px-4 py-3 md:left-64" style={{ bottom: "calc(env(safe-area-inset-bottom) + 66px)" }}>
          <div className="text-[13px] text-suave">Quando tudo estiver certo, envie ao paiol. Depois de enviar, só o paiol altera.</div>
          <Botao onClick={enviar} disabled={enviando} bloco>{enviando ? "Enviando…" : `Enviar balanço ao paiol (${editaveis.length})`}</Botao>
        </div>
      )}
    </div>
  );
}

/* ---------------- Balanço do paiol (confere o que o setor informou) ---------------- */
function BalancoPaiol({ itens, envios, ed, recarregar }: { itens: Item[]; envios: Envio[]; ed: Edicao; recarregar: () => void }) {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const pode = ehPaiol(acesso);
  const [conta, setConta] = useState<Record<string, number>>({});
  const [lote, setLote] = useState(false);
  const lista = envios.filter((x) => x.edicao_id === ed.id).map((x) => ({ x, it: itens.find((i) => i.id === x.item_id)! })).filter((r) => r.it)
    .sort((a, b) => a.it.setor.localeCompare(b.it.setor) || a.it.nome.localeCompare(b.it.nome));
  const informada = (x: Envio) => (x.volta == null ? Number(x.env) + Number(x.comp) : Number(x.volta));
  const contada = (x: Envio) => conta[x.item_id] ?? informada(x);
  const aConferir = lista.filter((r) => r.x.informado && r.x.aplicado == null);
  const aguardando = lista.filter((r) => !r.x.informado && r.x.aplicado == null).length;

  async function conferir(r: { x: Envio; it: Item }) {
    const { error } = await supabase.rpc("conferir_balanco", { p_edicao: ed.id, p_item: r.x.item_id, p_volta: contada(r.x) });
    if (error) aviso(msgErro(error)); else aviso(`${r.it.nome}: conferido.`);
    recarregar();
  }
  async function devolver(r: { x: Envio }) {
    const { error } = await supabase.rpc("reabrir_balanco", { p_edicao: ed.id, p_item: r.x.item_id });
    if (error) aviso(msgErro(error)); else aviso("Devolvido ao setor para refazer.");
    recarregar();
  }
  async function confirmarTodos() {
    setLote(true);
    const { data, error } = await supabase.rpc("fechar_balanco", { p_edicao: ed.id });
    setLote(false);
    if (error) aviso(msgErro(error)); else aviso(`${data ?? 0} itens confirmados e somados ao estoque.`);
    recarregar();
  }

  if (lista.length === 0) return <Vazio>Nada foi enviado para esta edição ainda. Marque o que foi em “Enviado”.</Vazio>;

  let ultimo = "";
  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 px-1 text-sm text-suave">Cada equipe informa o que voltou. Aqui você confere a contagem no paiol e confirma: só então o estoque geral é atualizado.{aguardando ? ` ${aguardando} item(ns) ainda sem balanço do setor.` : ""}</p>
      {lista.map((r) => {
        const levou = Number(r.x.env) + Number(r.x.comp), v = contada(r.x), inf = r.x.informado, conf = r.x.aplicado != null;
        const dif = inf && !conf && v !== informada(r.x);
        const cab = r.it.setor !== ultimo ? (ultimo = r.it.setor) : "";
        return (
          <div key={r.x.item_id} className="flex flex-col gap-2.5">
            {cab && <div className="px-1 pt-3 text-[13px] font-extrabold uppercase tracking-wide text-suave">{cab}</div>}
            <div className={cx("flex flex-col gap-2.5 rounded-3xl border-2 bg-white p-3.5", conf ? "border-[#a9d3c2]" : dif ? "border-[#e7b8ab]" : "border-borda")}>
              <div className="flex items-center justify-between gap-2">
                <b className="text-base">{r.it.nome}</b>
                <span className="whitespace-nowrap text-[13px] text-suave">levou <b className="text-[15px] text-texto">{fmtN(levou)}</b></span>
              </div>
              <div className="text-xs font-bold text-suave">
                {conf ? <span className="text-marca">Conferido: voltou {fmtN(Number(r.x.aplicado))} · usou {fmtN(levou - Number(r.x.aplicado))}</span>
                  : inf ? <>O setor informou: voltou {fmtN(informada(r.x))} · usou {fmtN(levou - informada(r.x))}</>
                  : <>Aguardando o setor informar</>}
              </div>
              {(inf || conf) && pode && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col"><span className="text-xs font-bold text-suave">{conf ? "Contagem confirmada" : "Sua contagem"}</span>
                    <span className="text-[13px] font-bold">{levou - v === 0 ? "nada usado" : `usado ${fmtN(levou - v)}`}</span></div>
                  <Passo grande valor={v} onMudar={(n) => { if (n > levou) { aviso(`Só foram ${fmtN(levou)}.`); return; } setConta((c) => ({ ...c, [r.x.item_id]: n })); }} />
                </div>
              )}
              {dif && <div className="rounded-xl bg-alerta-clara px-3 py-2 text-[13px] font-bold text-[#8e2e18]">O setor informou {fmtN(informada(r.x))}, você contou {fmtN(v)}. Se confirmar, vale a sua contagem.</div>}
              {pode && inf && !conf && (
                <div className="flex gap-2">
                  <Botao v="sec" onClick={() => devolver(r)} className="!min-h-11 flex-1">Devolver ao setor</Botao>
                  <Botao onClick={() => conferir(r)} className="!min-h-11 flex-1">Confirmar</Botao>
                </div>
              )}
              {pode && conf && v !== Number(r.x.aplicado) && <Botao onClick={() => conferir(r)} className="!min-h-11">Corrigir contagem</Botao>}
            </div>
          </div>
        );
      })}
      <div className="h-24" />
      {pode && aConferir.length > 0 && (
        <div className="fixed inset-x-0 z-30 flex flex-col gap-2 border-t border-borda bg-white px-4 py-3 md:left-64" style={{ bottom: "calc(env(safe-area-inset-bottom) + 66px)" }}>
          <div className="text-[13px] text-suave">Confirma tudo como o setor informou. Quem você contou diferente, confirme item por item antes.</div>
          <Botao onClick={confirmarTodos} disabled={lote} bloco>{lote ? "Confirmando…" : `Confirmar todos como informado (${aConferir.length})`}</Botao>
        </div>
      )}
    </div>
  );
}

/* ---------------- Janela do item (ver, mudar quantidade, editar) ---------------- */
type Mov = { id: string; tipo: string; qtd: number; delta: number | null; obs: string | null; criado_em: string };
function ItemJanela({ item, setores, setorPadrao, onFechar, onMudou, aviso }: { item: Item | null; setores: string[]; setorPadrao?: string; onFechar: () => void; onMudou: () => void; aviso: (m: string) => void }) {
  const { acesso } = useAuth();
  const [editando, setEditando] = useState(!item);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [qtd, setQtd] = useState(item?.qtd ?? 0);
  const [obs, setObs] = useState("");
  const [f, setF] = useState({ nome: item?.nome ?? "", setor: item?.setor ?? setorPadrao ?? "", un: item?.un ?? "un", qtd: "0", min: String(item?.min ?? 0).replace(".", ","), preco: String(item?.preco ?? 0).replace(".", ","), cons: item?.cons ?? false });
  const [confirmaDel, setConfirmaDel] = useState(false);

  const pode = item ? podeEscrever(acesso, "estoque", item.setor) : true;
  const setoresPermitidos = podeEscrever(acesso, "estoque") ? setores : setoresDaEquipe(acesso);

  useEffect(() => {
    if (!item) return;
    supabase.from("movimentos").select("id,tipo,qtd,delta,obs,criado_em").eq("item_id", item.id).order("criado_em", { ascending: false }).limit(8).then(({ data }) => setMovs((data as Mov[]) ?? []));
  }, [item]);

  async function mudarQtd(v: number) {
    if (!item) return;
    const { error } = await supabase.rpc("definir_estoque", { p_item: item.id, p_qtd: v, p_obs: obs.trim() || null });
    if (error) { aviso(msgErro(error)); return; }
    setQtd(v); setObs(""); onMudou(); aviso("Quantidade atualizada.");
    const { data } = await supabase.from("movimentos").select("id,tipo,qtd,delta,obs,criado_em").eq("item_id", item.id).order("criado_em", { ascending: false }).limit(8);
    setMovs((data as Mov[]) ?? []);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const nome = f.nome.trim(), setor = f.setor.trim();
    if (!nome) { aviso("Dê um nome para o item."); return; }
    if (!setor) { aviso("Escolha o setor."); return; }
    const min = num(f.min || "0"), preco = num(f.preco || "0"), q = num(f.qtd || "0");
    if ([min, preco, q].some((n) => !isFinite(n) || n < 0)) { aviso("Confira os números: não podem ser negativos."); return; }
    const dados = { nome, setor, un: f.un, min, preco, cons: f.cons };
    const r = item ? await supabase.from("itens").update({ ...dados, atualizado_em: new Date().toISOString() }).eq("id", item.id) : await supabase.from("itens").insert({ ...dados, qtd: q });
    if (r.error) { aviso(msgErro(r.error)); return; }
    onMudou(); aviso(item ? "Item atualizado." : "Item cadastrado."); onFechar();
  }

  async function excluir() {
    if (!item) return;
    const { error } = await supabase.from("itens").delete().eq("id", item.id);
    if (error) { aviso(msgErro(error)); return; }
    onMudou(); aviso("Item excluído."); onFechar();
  }

  if (item && !editando) {
    return (
      <Janela titulo={item.nome} onFechar={onFechar}>
        <div className="flex flex-col gap-4">
          <div className="text-sm text-suave">{item.setor}{item.cons ? " · consumível" : ""}{item.min > 0 ? ` · mínimo ${fmtN(item.min)}` : ""}</div>
          <Cartao className="flex flex-col items-center gap-3 p-4">
            <span className="text-xs font-bold uppercase text-suave">No estoque ({item.un})</span>
            {pode ? <Passo grande valor={qtd} onMudar={mudarQtd} /> : <b className="text-4xl">{fmtN(qtd)}</b>}
            {pode && <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Motivo (opcional), ex.: achei mais 3 na caixa" className="min-h-11 w-full rounded-xl border border-borda bg-white px-3 text-[15px]" />}
          </Cartao>
          {movs.length > 0 && (
            <div>
              <div className="pb-1.5 text-[13px] font-extrabold uppercase tracking-wide text-suave">Últimos movimentos</div>
              <div className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-white">
                {movs.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{m.obs || (m.tipo === "entrada" ? "Entrada" : m.tipo === "saida" ? "Saída" : "Ajuste")}<span className="block text-xs text-suave">{new Date(m.criado_em).toLocaleDateString("pt-BR")}</span></span>
                    <b className={cx((m.delta ?? 0) < 0 ? "text-alerta" : "text-marca")}>{(m.delta ?? 0) > 0 ? "+" : ""}{fmtN(m.delta ?? m.qtd)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pode && <Botao v="sec" onClick={() => setEditando(true)}><Icone n="lapis" tam={18} />Editar dados do item</Botao>}
        </div>
      </Janela>
    );
  }

  return (
    <Janela titulo={item ? "Editar item" : "Novo item"} onFechar={onFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-3.5">
        <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus={!item} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-suave">Setor</span>
          <input list="setores-lista" value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })} placeholder="Escolha ou digite um setor novo" className="min-h-12 rounded-2xl border border-borda bg-white px-4 outline-none focus:border-marca" />
          <datalist id="setores-lista">{setoresPermitidos.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Seletor rotulo="Unidade" value={f.un} onChange={(e) => setF({ ...f, un: e.target.value })}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</Seletor>
          {!item && <Campo rotulo="Quantidade agora" inputMode="decimal" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} />}
          <Campo rotulo="Estoque mínimo" inputMode="decimal" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
          <Campo rotulo="Valor unitário (R$)" inputMode="decimal" value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value })} />
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-borda bg-white px-4">
          <input type="checkbox" checked={f.cons} onChange={(e) => setF({ ...f, cons: e.target.checked })} className="h-5 w-5 accent-[#1f6f5c]" />
          <span className="text-[15px] font-bold">Item consumível <span className="font-normal text-suave">(acaba com o uso)</span></span>
        </label>
        <Botao type="submit" bloco>Salvar</Botao>
        {item && !confirmaDel && <Botao v="sec" bloco onClick={() => setConfirmaDel(true)} className="!text-alerta"><Icone n="lixo" tam={18} />Excluir item</Botao>}
        {item && confirmaDel && <Botao v="perigo" bloco onClick={excluir}>Confirmar: excluir “{item.nome}”</Botao>}
      </form>
    </Janela>
  );
}


/* ---------------- Importar planilha de inventário ---------------- */
function ImportarItens({ existentes, onFechar, onFeito }: { existentes: Item[]; onFechar: () => void; onFeito: () => void }) {
  const aviso = useAviso();
  const [lido, setLido] = useState<{ itens: ItemInv[]; setores: string[]; ignorados: number } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [atualizar, setAtualizar] = useState(false);
  const [gravando, setGravando] = useState(false);
  const chave = (setor: string, nome: string) => norm(setor) + "|" + norm(nome);
  const mapa = useMemo(() => new Map(existentes.map((i) => [chave(i.setor, i.nome), i])), [existentes]);

  async function escolher(f: File) {
    setLendo(true);
    try {
      const r = await lerInventario(f);
      if (r.itens.length === 0) aviso("Não encontrei itens. Use o modelo com as colunas ITENS, MEDIDA, ESTOQUE ATUAL e NECESSIDADE.");
      else setLido(r);
    } catch (e) { aviso("Não consegui ler o arquivo: " + (e instanceof Error ? e.message : "erro")); }
    setLendo(false);
  }
  const novos = (lido?.itens ?? []).filter((i) => !mapa.has(chave(i.setor, i.nome)));
  const repetidos = (lido?.itens ?? []).filter((i) => mapa.has(chave(i.setor, i.nome)));

  async function gravar() {
    if (!lido) return;
    setGravando(true);
    let erro = "";
    for (let k = 0; k < novos.length; k += 100) {
      const lote = novos.slice(k, k + 100).map((i) => ({ nome: i.nome, setor: i.setor, un: i.un, qtd: i.qtd, min: i.min, cons: i.cons, obs: i.obs }));
      const { error } = await supabase.from("itens").insert(lote);
      if (error) { erro = msgErro(error); break; }
    }
    let atualizados = 0;
    if (!erro && atualizar) {
      for (const i of repetidos) {
        const ex = mapa.get(chave(i.setor, i.nome))!;
        if (Number(ex.qtd) !== i.qtd) { const { error } = await supabase.rpc("definir_estoque", { p_item: ex.id, p_qtd: i.qtd, p_obs: "Importação da planilha" }); if (error) { erro = msgErro(error); break; } }
        if (Number(ex.min) !== i.min) await supabase.from("itens").update({ min: i.min }).eq("id", ex.id);
        atualizados++;
      }
    }
    setGravando(false);
    onFeito();
    if (erro) { aviso("Parou com erro: " + erro); return; }
    aviso(`${novos.length} itens novos${atualizar ? ` e ${atualizados} atualizados` : ""}.`); onFechar();
  }

  return (
    <Janela titulo="Importar itens (Excel)" onFechar={onFechar}>
      <div className="flex flex-col gap-3.5">
        {!lido ? (
          <>
            <p className="m-0 text-sm text-suave">Envie o inventário no modelo atual (.xls ou .xlsx): setores em linhas soltas e colunas ITENS, MEDIDA, ESTOQUE ATUAL, NECESSIDADE e OBS. A coluna NECESSIDADE vira a quantidade mínima.</p>
            <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl bg-marca px-4 font-extrabold text-white">
              {lendo ? "Lendo…" : "Escolher arquivo"}
              <input type="file" accept=".xls,.xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) escolher(f); e.target.value = ""; }} />
            </label>
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-marca-clara p-3 text-sm">
              <b>{lido.itens.length} itens</b> em {lido.setores.length} setores · <b>{novos.length} novos</b> · {repetidos.length} já cadastrados{lido.ignorados > 0 ? ` · ${lido.ignorados} repetidos na planilha ignorados` : ""}
            </div>
            <div className="max-h-56 overflow-y-auto rounded-2xl border border-borda text-sm">
              {lido.setores.map((s) => (
                <div key={s} className="flex justify-between border-b border-borda px-3 py-2 last:border-0"><b>{s}</b><span className="text-suave">{lido.itens.filter((i) => i.setor === s).length} itens</span></div>
              ))}
            </div>
            {repetidos.length > 0 && (
              <label className="flex items-start gap-3 rounded-2xl border border-borda bg-white p-3 text-sm">
                <input type="checkbox" checked={atualizar} onChange={(e) => setAtualizar(e.target.checked)} className="mt-0.5 h-5 w-5" />
                <span><b>Atualizar também os {repetidos.length} já cadastrados</b><br /><span className="text-suave">Troca a quantidade pelo valor da planilha (fica no histórico) e o mínimo. Desmarcado, eles não são mexidos.</span></span>
              </label>
            )}
            <Botao onClick={gravar} disabled={gravando || (novos.length === 0 && !atualizar)} bloco>{gravando ? "Gravando…" : `Importar ${novos.length} novos${atualizar ? " e atualizar" : ""}`}</Botao>
            <Botao v="sec" bloco onClick={() => setLido(null)}>Escolher outro arquivo</Botao>
          </>
        )}
      </div>
    </Janela>
  );
}
