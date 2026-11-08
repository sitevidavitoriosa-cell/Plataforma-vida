"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { fmtN, norm, num, type Edicao, type Envio, type Equipe, type Item } from "@/lib/tipos";
import { podeEscrever, setoresDaEquipe } from "@/lib/perm";
import { useAuth, useAviso } from "@/components/provedores";
import { Botao, Campo, Carregando, Chip, Cartao, Icone, Janela, Passo, Selo, Seletor, Titulo, Vazio, cx } from "@/components/ui";

type Aba = "geral" | "enviado" | "balanco";
const UNIDADES = ["un", "pacotes", "caixas", "rolos", "pares", "kg", "litros", "metros", "garrafas", "cilindros"];
const emFalta = (i: Item) => i.min > 0 && i.qtd < i.min;

export default function Estoque() {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const itens = useLista<Item>("itens", "*", "nome");
  const edicoes = useLista<Edicao>("edicoes", "*", "data_ini");
  const envios = useLista<Envio>("envios");
  const equipes = useLista<Equipe>("equipes", "*", "nome");
  const [aba, setAba] = useState<Aba>("geral");
  const [edId, setEdId] = useState<string>("");
  const [aberto, setAberto] = useState<Item | "novo" | null>(null);

  useEffect(() => { try { const a = localStorage.getItem("vv-aba-estoque") as Aba | null; if (a) setAba(a); } catch {} }, []);
  const trocaAba = (a: Aba) => { setAba(a); try { localStorage.setItem("vv-aba-estoque", a); } catch {} };

  const listaEd = useMemo(() => {
    const o: Record<string, number> = { aberta: 0, planejada: 1, fechada: 2 };
    return (edicoes.dados ?? []).slice().sort((a, b) => o[a.status] - o[b.status] || (b.data_ini ?? "").localeCompare(a.data_ini ?? ""));
  }, [edicoes.dados]);
  useEffect(() => { if (!edId && listaEd.length) setEdId(listaEd[0].id); }, [edId, listaEd]);
  const ed = listaEd.find((e) => e.id === edId) ?? null;

  const setores = useMemo(() => {
    const s = new Set<string>();
    (itens.dados ?? []).forEach((i) => s.add(i.setor));
    (equipes.dados ?? []).forEach((e) => e.setores.forEach((x) => s.add(x)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [itens.dados, equipes.dados]);

  const podeAlgum = podeEscrever(acesso, "estoque") || setoresDaEquipe(acesso).length > 0;

  if (!itens.dados || !edicoes.dados || !envios.dados) return <Carregando />;

  return (
    <div>
      <Titulo direita={ed && aba !== "geral" ? <Selo tom={ed.status === "aberta" ? "ok" : "neutro"}>{ed.nome}</Selo> : undefined}>Estoque</Titulo>
      <div className="flex gap-2 overflow-x-auto pb-3">
        <Chip ativo={aba === "geral"} onClick={() => trocaAba("geral")}>Geral</Chip>
        <Chip ativo={aba === "enviado"} onClick={() => trocaAba("enviado")}>Enviado</Chip>
        <Chip ativo={aba === "balanco"} onClick={() => trocaAba("balanco")}>Balanço</Chip>
      </div>

      {aba !== "geral" && (
        <div className="pb-3">
          {listaEd.length === 0 ? <Vazio>Crie uma edição em “Edições” para usar o enviado e o balanço.</Vazio> : (
            <Seletor rotulo="Edição" value={edId} onChange={(e) => setEdId(e.target.value)}>
              {listaEd.map((e) => <option key={e.id} value={e.id}>{e.nome} {e.status === "aberta" ? "· aberta" : e.status === "fechada" ? "· fechada" : "· planejada"}</option>)}
            </Seletor>
          )}
        </div>
      )}

      {aba === "geral" && <Geral itens={itens.dados} onAbrir={setAberto} />}
      {aba === "enviado" && ed && <Enviado itens={itens.dados} envios={envios.dados} edicoes={listaEd} ed={ed} recarregar={() => { itens.recarregar(); envios.recarregar(); }} setItens={itens.setDados} setEnvios={envios.setDados} />}
      {aba === "balanco" && ed && <Balanco itens={itens.dados} envios={envios.dados} ed={ed} recarregar={() => { itens.recarregar(); envios.recarregar(); }} setEnvios={envios.setDados} />}

      {aba === "geral" && podeAlgum && (
        <button type="button" onClick={() => setAberto("novo")} className="fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-marca px-5 text-base font-extrabold text-white shadow-lg md:bottom-8 md:right-8" style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}>
          <Icone n="mais1" tam={20} />Novo item
        </button>
      )}

      {aberto && (
        <ItemJanela item={aberto === "novo" ? null : aberto} setores={setores} onFechar={() => setAberto(null)}
          onMudou={() => { itens.recarregar(); }} aviso={aviso} />
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
        const aberto = forcarAberto || abertos[setor];
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
function Enviado({ itens, envios, edicoes, ed, recarregar, setItens, setEnvios }: {
  itens: Item[]; envios: Envio[]; edicoes: Edicao[]; ed: Edicao; recarregar: () => void;
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
  const resto = lista.filter((i) => !doEd(i.id)).sort(ord);
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
    const x = doEd(i.id), v = x ? Number(x.env) : 0, fechado = !!x && x.aplicado != null;
    const pode = podeEscrever(acesso, "estoque", i.setor);
    return (
      <div key={i.id} className={cx("flex min-h-16 items-center gap-2.5 rounded-2xl border px-3 py-2", v > 0 ? "border-[#a9d3c2] bg-marca-clara" : "border-borda bg-white")}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="text-[15px]">{i.nome}</b>
          <span className="text-xs text-suave">{i.setor} · no depósito {v > 0 && !fechado ? `${fmtN(i.qtd + v)} → ${fmtN(i.qtd)}` : fmtN(i.qtd)}</span>
        </div>
        {pode && !fechado ? <Passo valor={v} onMudar={(n) => definir(i, n)} /> : <div className="text-right"><b>{fmtN(v)} {i.un}</b>{fechado && <div className="text-xs text-suave">balanço fechado</div>}</div>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-borda bg-white px-3">
          <Icone n="busca" tam={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item pelo nome" aria-label="Buscar item" className="min-h-12 min-w-0 flex-1 bg-transparent outline-none" />
        </div>
        {anterior && <Botao v="suave" onClick={copiar} className="!px-3 !text-sm">Copiar da última</Botao>}
      </div>
      {enviados.length > 0 && <div className="px-1 pt-1 text-[13px] font-extrabold uppercase tracking-wide text-marca">Enviados · {enviados.length}</div>}
      {enviados.map(linha)}
      {resto.length > 0 && <div className="px-1 pt-3 text-[13px] font-extrabold uppercase tracking-wide text-suave">{enviados.length ? "Todo o estoque" : "Itens do estoque"}</div>}
      {resto.map(linha)}
      {lista.length === 0 && <Vazio>Nenhum item com esse nome.</Vazio>}

      <div className="fixed inset-x-0 z-30 flex items-center justify-between gap-3 border-t border-borda bg-white px-4 py-3 md:left-64" style={{ bottom: "calc(env(safe-area-inset-bottom) + 66px)" }}>
        <div className="leading-tight"><b>{totalItens} itens · {fmtN(totalUn)} un.</b><div className="text-xs text-suave">O estoque geral já desconta</div></div>
        <Selo tom="ok">Segue para o Balanço</Selo>
      </div>
      <div className="h-16" />
    </div>
  );
}

/* ---------------- Balanço ---------------- */
function Balanco({ itens, envios, ed, recarregar, setEnvios }: { itens: Item[]; envios: Envio[]; ed: Edicao; recarregar: () => void; setEnvios: React.Dispatch<React.SetStateAction<Envio[] | null>> }) {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const [fechando, setFechando] = useState(false);
  const lista = envios.filter((x) => x.edicao_id === ed.id).map((x) => ({ x, it: itens.find((i) => i.id === x.item_id)! })).filter((r) => r.it)
    .sort((a, b) => a.it.setor.localeCompare(b.it.setor) || a.it.nome.localeCompare(b.it.nome));
  const volta = (x: Envio) => (x.volta == null ? Number(x.env) + Number(x.comp) : Number(x.volta));
  const faltas = lista.filter((r) => !r.it.cons && Number(r.x.env) + Number(r.x.comp) - volta(r.x) > 0).length;
  const pendentes = lista.filter((r) => r.x.aplicado == null || volta(r.x) !== Number(r.x.aplicado)).length;
  const podeFechar = lista.some((r) => podeEscrever(acesso, "estoque", r.it.setor));

  async function salvar(r: { x: Envio; it: Item }, campo: "volta" | "comp", v: number) {
    setEnvios((p) => (p ?? []).map((e) => (e.edicao_id === r.x.edicao_id && e.item_id === r.x.item_id ? { ...e, [campo]: v } : e)));
    const { error } = await supabase.from("envios").update({ [campo]: v }).match({ edicao_id: r.x.edicao_id, item_id: r.x.item_id });
    if (error) aviso(msgErro(error));
    recarregar();
  }

  async function fechar() {
    setFechando(true);
    const { data, error } = await supabase.rpc("fechar_balanco", { p_edicao: ed.id });
    setFechando(false);
    if (error) aviso(msgErro(error)); else aviso(`Balanço fechado. ${data ?? 0} itens atualizados no estoque geral.`);
    recarregar();
  }

  if (lista.length === 0) return <Vazio>Nada foi enviado para esta edição ainda. Marque o que foi em “Enviado”.</Vazio>;

  let ultimo = "";
  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 px-1 text-sm text-suave">Começa igual ao enviado. Toque em − para o que não voltou e em + para o que sobrou a mais.</p>
      {lista.map((r) => {
        const v = volta(r.x), cons = Number(r.x.env) + Number(r.x.comp) - v, falta = !r.it.cons && cons > 0;
        const pode = podeEscrever(acesso, "estoque", r.it.setor);
        const cab = r.it.setor !== ultimo ? (ultimo = r.it.setor) : "";
        const depois = r.it.qtd + (v - Number(r.x.aplicado ?? 0));
        return (
          <div key={r.x.item_id} className="flex flex-col gap-2.5">
            {cab && <div className="px-1 pt-3 text-[13px] font-extrabold uppercase tracking-wide text-suave">{cab}</div>}
            <div className={cx("flex flex-col gap-2.5 rounded-3xl border-2 bg-white p-3.5", falta ? "border-[#e7b8ab]" : "border-borda")}>
              <div className="flex items-center justify-between gap-2">
                <b className="text-base">{r.it.nome}</b>
                <span className="whitespace-nowrap text-[13px] text-suave">enviado <b className="text-[15px] text-texto">{fmtN(r.x.env)}</b></span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col"><span className="text-xs font-bold text-suave">Voltou</span>
                  <span className={cx("text-[13px] font-bold", falta && "text-alerta")}>{cons < 0 ? `sobrou ${fmtN(-cons)} a mais` : cons === 0 ? "nada consumido" : `consumiu ${fmtN(cons)}`}</span>
                </div>
                {pode ? <Passo grande valor={v} onMudar={(n) => salvar(r, "volta", n)} /> : <b className="text-[26px]">{fmtN(v)}</b>}
              </div>
              <div className="flex items-center justify-between text-xs text-suave">
                <span>No estoque geral depois: <b className="text-texto">{fmtN(depois)}</b>{r.it.min > 0 && depois < r.it.min ? <span className="text-alerta"> · abaixo do mínimo ({fmtN(r.it.min)})</span> : null}</span>
                {pode && <label className="flex items-center gap-1.5">comprado
                  <input inputMode="decimal" defaultValue={String(r.x.comp).replace(".", ",")} onBlur={(e) => { const n = num(e.target.value || "0"); if (isFinite(n) && n >= 0 && n !== Number(r.x.comp)) salvar(r, "comp", n); }} className="h-9 w-14 rounded-lg border border-borda bg-white text-center text-texto" aria-label="Quantidade comprada" />
                </label>}
              </div>
              {falta && <div className="rounded-xl bg-alerta-clara px-3 py-2 text-[13px] font-bold text-[#8e2e18]">Faltou voltar {fmtN(cons)}. Este item não é consumível: confira antes de fechar.</div>}
              {r.x.aplicado != null && <span className="text-xs font-bold text-marca">Balanço já aplicado ao estoque</span>}
            </div>
          </div>
        );
      })}
      <div className="h-24" />
      <div className="fixed inset-x-0 z-30 flex flex-col gap-2 border-t border-borda bg-white px-4 py-3 md:left-64" style={{ bottom: "calc(env(safe-area-inset-bottom) + 66px)" }}>
        <div className="text-[13px] text-suave">O que voltou entra no estoque geral. O consumo fica no relatório da edição.{faltas ? ` ${faltas} item(ns) não consumível(is) não voltou inteiro.` : ""}</div>
        {podeFechar && <Botao onClick={fechar} disabled={fechando || pendentes === 0} bloco>{pendentes === 0 ? "Balanço fechado" : fechando ? "Fechando…" : `Fechar balanço (${pendentes})`}</Botao>}
      </div>
    </div>
  );
}

/* ---------------- Janela do item (ver, mudar quantidade, editar) ---------------- */
type Mov = { id: string; tipo: string; qtd: number; delta: number | null; obs: string | null; criado_em: string };
function ItemJanela({ item, setores, onFechar, onMudou, aviso }: { item: Item | null; setores: string[]; onFechar: () => void; onMudou: () => void; aviso: (m: string) => void }) {
  const { acesso } = useAuth();
  const [editando, setEditando] = useState(!item);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [qtd, setQtd] = useState(item?.qtd ?? 0);
  const [obs, setObs] = useState("");
  const [f, setF] = useState({ nome: item?.nome ?? "", setor: item?.setor ?? "", un: item?.un ?? "un", qtd: "0", min: String(item?.min ?? 0).replace(".", ","), preco: String(item?.preco ?? 0).replace(".", ","), cons: item?.cons ?? false });
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
