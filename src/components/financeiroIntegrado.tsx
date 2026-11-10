"use client";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { brl, fmtN, norm, num, type Item } from "@/lib/tipos";
import { useAviso } from "@/components/provedores";
import { Botao, Campo, Cartao, Icone, Janela, Selo, Seletor, Vazio, cx } from "@/components/ui";

export type Rep = { item_id: string; nome: string; setor: string; un: string; qtd: number; minimo: number; preco: number; cons: boolean; falta: number; previsto: number };
export type Alug = { id: string; edicao_id: string; item_id: string; qtd: number; valor: number; fornecedor: string | null; obs: string | null; lancamento_id: string | null };
const dec = (n: number) => String(n).replace(".", ",");
const hoje = () => new Date().toISOString().slice(0, 10);

/* ---------------- barras: pago x previsto ---------------- */
export function Barras({ titulo, linhas }: { titulo: string; linhas: { nome: string; pago: number; previsto: number }[] }) {
  const max = Math.max(1, ...linhas.map((l) => l.pago + l.previsto));
  return (
    <Cartao className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between gap-2"><b>{titulo}</b>
        <span className="flex items-center gap-3 text-xs text-suave"><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-marca" />Pago</span><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full" style={{ background: "#e8a400" }} />A pagar</span></span></div>
      {linhas.length === 0 && <span className="text-sm text-suave">Nada por aqui ainda.</span>}
      {linhas.map((l) => (
        <div key={l.nome} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate font-bold md:w-36" title={l.nome}>{l.nome}</span>
          <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-fundo">
            <div className="h-full bg-marca" style={{ width: `${(l.pago / max) * 100}%` }} />
            <div className="h-full" style={{ width: `${(l.previsto / max) * 100}%`, background: "#e8a400" }} />
          </div>
          <span className="w-24 shrink-0 text-right text-[13px]">{brl(l.pago + l.previsto)}</span>
        </div>
      ))}
    </Cartao>
  );
}

/* ---------------- A comprar (reposição do estoque) ---------------- */
export function ComprarTab({ rep, pode, edicaoId, onMudou }: { rep: Rep[]; pode: boolean; edicaoId: string; onMudou: () => void }) {
  const aviso = useAviso();
  const [q, setQ] = useState("");
  const [compra, setCompra] = useState<Rep | null>(null);
  const [preco, setPreco] = useState<Rep | null>(null);
  const nq = norm(q);
  const vis = rep.filter((r) => !nq || norm(r.nome + " " + r.setor).includes(nq));
  const porSetor = useMemo(() => { const m = new Map<string, Rep[]>(); vis.forEach((r) => m.set(r.setor, [...(m.get(r.setor) ?? []), r])); return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])); }, [vis]);
  const total = rep.reduce((s, r) => s + Number(r.previsto), 0);
  const semPreco = rep.filter((r) => !(Number(r.preco) > 0)).length;

  async function copiar() {
    const linhas = rep.map((r) => `• ${r.nome} (${r.setor}): comprar ${fmtN(r.falta)} ${r.un}${Number(r.preco) > 0 ? ` — ${brl(Number(r.previsto))}` : ""}`);
    try { await navigator.clipboard.writeText(`Lista de compras (abaixo do mínimo)\n${linhas.join("\n")}\nTotal previsto: ${brl(total)}`); aviso(`Lista copiada (${rep.length} itens).`); } catch { aviso("Não consegui copiar."); }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-3xl border border-borda bg-white p-3"><div className="text-xs text-suave">Itens a repor</div><b className="text-lg">{rep.length}</b></div>
        <div className="rounded-3xl border border-borda bg-white p-3"><div className="text-xs text-suave">Custo previsto</div><b className="text-lg">{brl(total)}</b></div>
        <div className="rounded-3xl border border-borda bg-white p-3"><div className="text-xs text-suave">Sem preço</div><b className={cx("text-lg", semPreco > 0 && "text-alerta")}>{semPreco}</b></div>
      </div>
      <p className="m-0 text-sm text-suave">Todo item que fica abaixo do mínimo no estoque entra aqui sozinho (itens alugados não entram). Quando você compra, toque em <b>Comprei</b>: o gasto vai para a edição escolhida no topo e a quantidade entra no estoque.{semPreco > 0 ? " Itens sem preço aparecem com custo zero: toque em Preço para informar o valor unitário." : ""}</p>
      <div className="flex flex-wrap gap-2">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-borda bg-white px-3"><Icone n="busca" tam={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item ou setor" aria-label="Buscar item" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
        <Botao v="sec" onClick={copiar} disabled={rep.length === 0} className="!min-h-12">Copiar lista</Botao>
      </div>
      {rep.length === 0 && <Vazio>Nada abaixo do mínimo agora. Quando algum item ficar em falta, ele aparece aqui.</Vazio>}
      {porSetor.map(([setor, l]) => (
        <Cartao key={setor} className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 bg-fundo px-4 py-2.5"><b>{setor}</b><span className="text-sm font-bold text-suave">{brl(l.reduce((s, r) => s + Number(r.previsto), 0))}</span></div>
          {l.map((r) => (
            <div key={r.item_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-borda px-4 py-3">
              <div className="min-w-[180px] flex-1">
                <b className="block text-[15px]">{r.nome}</b>
                <span className="text-xs text-suave">Tem {fmtN(r.qtd)} · mínimo {fmtN(r.minimo)} · comprar <b className="text-texto">{fmtN(r.falta)} {r.un}</b></span>
              </div>
              <div className="text-right leading-tight">
                {Number(r.preco) > 0 ? <><b>{brl(Number(r.previsto))}</b><div className="text-xs text-suave">{brl(Number(r.preco))} / {r.un}</div></> : <Selo tom="alerta">sem preço</Selo>}
              </div>
              {pode && <div className="flex gap-2"><Botao v="sec" onClick={() => setPreco(r)} className="!min-h-10 !px-3 !text-sm">Preço</Botao><Botao onClick={() => setCompra(r)} className="!min-h-10 !px-4 !text-sm">Comprei</Botao></div>}
            </div>
          ))}
        </Cartao>
      ))}
      {compra && <ModalCompra r={compra} edicaoId={edicaoId} onFechar={() => setCompra(null)} onFeito={() => { setCompra(null); onMudou(); }} />}
      {preco && <ModalPreco r={preco} onFechar={() => setPreco(null)} onFeito={() => { setPreco(null); onMudou(); }} />}
    </div>
  );
}

function ModalCompra({ r, edicaoId, onFechar, onFeito }: { r: Rep; edicaoId: string; onFechar: () => void; onFeito: () => void }) {
  const aviso = useAviso();
  const [f, setF] = useState({ qtd: dec(Number(r.falta)), valor: Number(r.preco) > 0 ? dec(Math.round(Number(r.falta) * Number(r.preco) * 100) / 100) : "", data: hoje(), obs: "", guardar: true });
  const [salvando, setSalvando] = useState(false);
  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    const q = num(f.qtd), v = num(f.valor);
    if (!isFinite(q) || q <= 0) { aviso("Informe a quantidade comprada."); return; }
    if (!isFinite(v) || v < 0) { aviso("Informe o valor total pago."); return; }
    setSalvando(true);
    const { error } = await supabase.rpc("confirmar_compra", { p_edicao: edicaoId, p_item: r.item_id, p_qtd: q, p_valor: v, p_data: f.data, p_obs: f.obs.trim() || null });
    if (error) { setSalvando(false); aviso(msgErro(error)); return; }
    if (f.guardar && v > 0) await supabase.rpc("definir_preco", { p_item: r.item_id, p_preco: Math.round((v / q) * 100) / 100 });
    setSalvando(false); aviso("Compra lançada no financeiro e somada ao estoque."); onFeito();
  }
  return (
    <Janela titulo={`Comprei: ${r.nome}`} onFechar={onFechar}>
      <form onSubmit={confirmar} className="flex flex-col gap-3.5 overflow-y-auto pb-2">
        <p className="m-0 text-sm text-suave">Faltavam {fmtN(r.falta)} {r.un}. Informe o que foi realmente comprado e pago.</p>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={`Quantidade (${r.un})`} inputMode="decimal" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} />
          <Campo rotulo="Valor total pago (R$)" inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder="0,00" autoFocus />
        </div>
        <Campo rotulo="Data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        <Campo rotulo="Onde comprou (opcional)" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} placeholder="Ex.: Atacadão" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.guardar} onChange={(e) => setF({ ...f, guardar: e.target.checked })} className="h-5 w-5 accent-[#16294d]" />Guardar o preço unitário no item para as próximas previsões</label>
        <Botao type="submit" bloco disabled={salvando}>{salvando ? "Lançando…" : "Confirmar compra"}</Botao>
      </form>
    </Janela>
  );
}

function ModalPreco({ r, onFechar, onFeito }: { r: Rep; onFechar: () => void; onFeito: () => void }) {
  const aviso = useAviso();
  const [v, setV] = useState(Number(r.preco) > 0 ? dec(Number(r.preco)) : "");
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const n = num(v);
    if (!isFinite(n) || n < 0) { aviso("Informe um valor válido."); return; }
    const { error } = await supabase.rpc("definir_preco", { p_item: r.item_id, p_preco: n });
    if (error) { aviso(msgErro(error)); return; }
    aviso("Preço atualizado."); onFeito();
  }
  return (
    <Janela titulo={`Preço: ${r.nome}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-3.5"><Campo rotulo={`Valor unitário por ${r.un} (R$)`} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="0,00" autoFocus /><Botao type="submit" bloco>Salvar preço</Botao></form>
    </Janela>
  );
}

/* ---------------- Alugados (terceirizados) ---------------- */
export function AlugadosTab({ alug, itens, pode, edicaoId, onMudou }: { alug: Alug[]; itens: Item[]; pode: boolean; edicaoId: string; onMudou: () => void }) {
  const aviso = useAviso();
  const [form, setForm] = useState<Alug | "novo" | null>(null);
  const [pagando, setPagando] = useState<string | null>(null);
  const mapa = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const lista = alug.filter((a) => a.edicao_id === edicaoId).sort((a, b) => (mapa.get(a.item_id)?.nome ?? "").localeCompare(mapa.get(b.item_id)?.nome ?? ""));
  const previsto = lista.filter((a) => !a.lancamento_id).reduce((s, a) => s + Number(a.valor), 0);
  const pago = lista.filter((a) => a.lancamento_id).reduce((s, a) => s + Number(a.valor), 0);
  const alugaveis = itens.filter((i) => i.alugado);

  async function pagar(a: Alug) {
    if (pagando !== a.id) { setPagando(a.id); return; }
    const { error } = await supabase.rpc("pagar_aluguel", { p_aluguel: a.id, p_data: hoje() });
    setPagando(null);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Aluguel pago e lançado como despesa da edição."); onMudou();
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-3xl border border-borda bg-white p-3"><div className="text-xs text-suave">Itens alugados</div><b className="text-lg">{lista.length}</b></div>
        <div className="rounded-3xl border border-borda bg-white p-3"><div className="text-xs text-suave">A pagar</div><b className="text-lg">{brl(previsto)}</b></div>
        <div className="rounded-3xl border border-borda bg-white p-3"><div className="text-xs text-suave">Já pago</div><b className="text-lg text-alerta">{brl(pago)}</b></div>
      </div>
      <p className="m-0 text-sm text-suave">Itens terceirizados (gás hélio, cadeira, fantasminha…) não têm saldo no paiol, mas custam dinheiro. Registre aqui o que foi alugado nesta edição e o valor; ao pagar, vira despesa do financeiro. Para um item aparecer na lista, marque-o como “Alugado” no Estoque.</p>
      {pode && <div><Botao onClick={() => setForm("novo")} className="!min-h-11"><Icone n="mais1" tam={18} />Registrar aluguel</Botao></div>}
      {lista.length === 0 && <Vazio>Nenhum aluguel registrado nesta edição.{alugaveis.length === 0 ? " Marque itens como “Alugado” no Estoque para poder registrá-los aqui." : ""}</Vazio>}
      <Cartao className="overflow-hidden">
        {lista.map((a, n) => {
          const it = mapa.get(a.item_id), paga = !!a.lancamento_id;
          return (
            <div key={a.id} className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3", n > 0 && "border-t border-borda")}>
              <div className="min-w-[180px] flex-1"><b className="block text-[15px]">{it?.nome ?? "Item"}</b><span className="text-xs text-suave">{it?.setor} · {fmtN(Number(a.qtd))} {it?.un}{a.fornecedor ? ` · ${a.fornecedor}` : ""}</span></div>
              <b>{brl(Number(a.valor))}</b>
              <Selo tom={paga ? "ok" : "aviso"}>{paga ? "Pago" : "A pagar"}</Selo>
              {pode && !paga && <div className="flex gap-2"><Botao v="sec" onClick={() => setForm(a)} className="!min-h-10 !px-3 !text-sm">Editar</Botao><Botao onClick={() => pagar(a)} className="!min-h-10 !px-3 !text-sm">{pagando === a.id ? "Confirmar pagamento" : "Marcar pago"}</Botao></div>}
            </div>
          );
        })}
      </Cartao>
      {form && <FormAluguel a={form === "novo" ? null : form} alugaveis={alugaveis} edicaoId={edicaoId} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); onMudou(); }} />}
    </div>
  );
}

function FormAluguel({ a, alugaveis, edicaoId, onFechar, onSalvo }: { a: Alug | null; alugaveis: Item[]; edicaoId: string; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const [f, setF] = useState({ item: a?.item_id ?? alugaveis[0]?.id ?? "", qtd: a ? dec(Number(a.qtd)) : "1", valor: a ? dec(Number(a.valor)) : "", fornecedor: a?.fornecedor ?? "", obs: a?.obs ?? "" });
  const [del, setDel] = useState(false);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const q = num(f.qtd), v = num(f.valor || "0");
    if (!f.item) { aviso("Escolha o item alugado."); return; }
    if (!isFinite(q) || q <= 0) { aviso("Informe a quantidade."); return; }
    if (!isFinite(v) || v < 0) { aviso("Informe o valor total."); return; }
    const d = { edicao_id: edicaoId, item_id: f.item, qtd: q, valor: v, fornecedor: f.fornecedor.trim() || null, obs: f.obs.trim() || null, atualizado_em: new Date().toISOString() };
    const r = a ? await supabase.from("alugueis").update(d).eq("id", a.id) : await supabase.from("alugueis").insert(d);
    if (r.error) { aviso(msgErro(r.error)); return; }
    aviso("Aluguel salvo."); onSalvo();
  }
  async function excluir() {
    if (!a) return;
    const { error } = await supabase.from("alugueis").delete().eq("id", a.id);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Aluguel removido."); onSalvo();
  }
  return (
    <Janela titulo={a ? "Editar aluguel" : "Registrar aluguel"} onFechar={onFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-3.5 overflow-y-auto pb-2">
        <Seletor rotulo="Item alugado" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })}>
          {alugaveis.length === 0 && <option value="">Nenhum item marcado como alugado</option>}
          {alugaveis.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.setor})</option>)}
        </Seletor>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quantidade" inputMode="decimal" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} />
          <Campo rotulo="Valor total (R$)" inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder="0,00" />
        </div>
        <Campo rotulo="Fornecedor (opcional)" value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} placeholder="Ex.: Locadora Festa Certa" />
        <Campo rotulo="Observação (opcional)" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
        <Botao type="submit" bloco>Salvar</Botao>
        {a && !del && <Botao v="sec" bloco className="!text-alerta" onClick={() => setDel(true)}><Icone n="lixo" tam={18} />Remover aluguel</Botao>}
        {a && del && <Botao v="perigo" bloco onClick={excluir}>Confirmar: remover</Botao>}
      </form>
    </Janela>
  );
}
