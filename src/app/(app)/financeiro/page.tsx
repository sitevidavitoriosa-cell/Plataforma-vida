"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { brl, dmy, norm, num, type Item } from "@/lib/tipos";
import { podeEscrever } from "@/lib/perm";
import { useAuth, useAviso, useEdicao } from "@/components/provedores";
import { Botao, Campo, Carregando, Cartao, Chip, Icone, Janela, Seletor, Titulo, Vazio, cx } from "@/components/ui";

type Lanc = { id: string; edicao_id: string | null; tipo: "entrada" | "saida"; descricao: string; categoria: string | null; valor: number; data: string; setor: string | null; comp_path: string | null; comp_nome: string | null };
const CATEGORIAS = ["Alimentação", "Material", "Transporte", "Local / hospedagem", "Impressão", "Inscrições", "Doações", "Outros"];

export default function Financeiro() {
  const { acesso } = useAuth();
  const { ed } = useEdicao();
  const aviso = useAviso();
  const lanc = useLista<Lanc>("lancamentos", "*", "data");
  const itens = useLista<Item>("itens", "setor");
  const [tipo, setTipo] = useState<"todos" | "entrada" | "saida">("todos");
  const [setor, setSetor] = useState("");
  const [form, setForm] = useState<Lanc | "novo" | null>(null);
  const [lim, setLim] = useState(50);
  const pode = podeEscrever(acesso, "financeiro");

  const todos = useMemo(() => (lanc.dados ?? []).filter((l) => l.edicao_id === ed?.id), [lanc.dados, ed]);
  const setores = useMemo(() => Array.from(new Set([...(itens.dados ?? []).map((i) => i.setor), ...todos.map((l) => l.setor ?? "")].filter(Boolean))).sort((a, b) => a.localeCompare(b)), [itens.dados, todos]);
  const cats = useMemo(() => Array.from(new Set([...CATEGORIAS, ...(lanc.dados ?? []).map((l) => l.categoria ?? "")].filter(Boolean))), [lanc.dados]);

  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!lanc.dados) return <Carregando />;

  const soma = (t: "entrada" | "saida") => todos.filter((l) => l.tipo === t).reduce((s, l) => s + Number(l.valor), 0);
  const ent = soma("entrada"), sai = soma("saida");
  const vis = todos.filter((l) => (tipo === "todos" || l.tipo === tipo) && (!setor || l.setor === setor)).sort((a, b) => b.data.localeCompare(a.data) || 0);
  const porSetor = new Map<string, number>(); todos.filter((l) => l.tipo === "saida").forEach((l) => { const k = l.setor || "Sem setor"; porSetor.set(k, (porSetor.get(k) ?? 0) + Number(l.valor)); });

  async function anexo(l: Lanc) {
    if (!l.comp_path) return;
    const { data, error } = await supabase.storage.from("comprovantes").createSignedUrl(l.comp_path, 300);
    if (error || !data) { aviso("Não consegui abrir o anexo."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }
  async function excel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Data", "Tipo", "Descrição", "Categoria", "Setor", "Valor", "Anexo"], ...todos.slice().sort((a, b) => a.data.localeCompare(b.data)).map((l) => [dmy(l.data), l.tipo === "entrada" ? "Entrada" : "Saída", l.descricao, l.categoria ?? "", l.setor ?? "", l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor), l.comp_nome ?? ""]), [], ["", "", "", "", "Entradas", ent], ["", "", "", "", "Saídas", -sai], ["", "", "", "", "Resultado", ent - sai]]), "Lançamentos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Setor", "Gasto"], ...Array.from(porSetor.entries()).sort((a, b) => b[1] - a[1])]), "Gastos por setor");
    XLSX.writeFile(wb, `Financeiro_${ed!.nome.replace(/[^a-zA-Z0-9]+/g, "_")}.xlsx`);
  }

  return (
    <div className="pb-28">
      <Titulo direita={<Botao v="sec" className="!min-h-11" onClick={excel} disabled={todos.length === 0}>Exportar</Botao>}>Financeiro</Titulo>
      <p className="m-0 pb-3 text-sm text-suave">{ed.nome}</p>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-3xl border border-borda bg-white p-3"><div className="text-xs text-suave">Entrou</div><b className="text-lg text-[#1e7a50]">{brl(ent)}</b></div>
        <div className="rounded-3xl border border-borda bg-white p-3"><div className="text-xs text-suave">Saiu</div><b className="text-lg text-alerta">{brl(sai)}</b></div>
        <div className="rounded-3xl border border-borda bg-white p-3"><div className="text-xs text-suave">Sobrou</div><b className={cx("text-lg", ent - sai < 0 && "text-alerta")}>{brl(ent - sai)}</b></div>
      </div>

      {porSetor.size > 0 && (
        <Cartao className="mt-4 flex flex-col gap-2 p-4">
          <b>Gastos por setor</b>
          {Array.from(porSetor.entries()).sort((a, b) => b[1] - a[1]).map(([s, v]) => (
            <div key={s} className="flex items-center gap-3 text-sm"><span className="w-28 shrink-0 truncate font-bold">{s}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fundo"><div className="h-full rounded-full bg-marca" style={{ width: `${(v / Math.max(...porSetor.values())) * 100}%` }} /></div><span className="w-24 text-right">{brl(v)}</span></div>
          ))}
        </Cartao>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
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
                <span className="text-xs text-suave">{dmy(l.data)} · {l.setor || (neg ? "Sem setor" : "Receita")}{l.categoria ? ` · ${l.categoria}` : ""}</span>
                <div className="text-xs">{l.comp_path ? <button type="button" onClick={() => anexo(l)} className="font-bold text-marca">Ver anexo</button> : neg ? <span className="text-suave">Sem anexo</span> : null}</div>
              </div>
              <b className={cx("shrink-0", neg ? "text-alerta" : "text-[#1e7a50]")}>{neg ? "− " : "+ "}{brl(Number(l.valor))}</b>
              {pode && <button type="button" aria-label={`Editar ${l.descricao}`} onClick={() => setForm(l)} className="grid h-10 w-10 shrink-0 place-items-center text-suave"><Icone n="lapis" tam={18} /></button>}
            </div>
          );
        })}
      </Cartao>
      {vis.length > lim && <div className="pt-3 text-center"><Botao v="sec" className="!min-h-11" onClick={() => setLim(lim + 50)}>Ver mais ({vis.length - lim})</Botao></div>}

      {pode && (
        <button type="button" onClick={() => setForm("novo")} className="fixed right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-marca px-5 text-base font-extrabold text-white shadow-lg md:bottom-8 md:right-8" style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}>
          <Icone n="mais1" tam={20} />Lançar valor
        </button>
      )}
      {form && <FormLanc l={form === "novo" ? null : form} edicaoId={ed.id} setores={setores} cats={cats} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); lanc.recarregar(); }} />}
    </div>
  );
}

function FormLanc({ l, edicaoId, setores, cats, onFechar, onSalvo }: { l: Lanc | null; edicaoId: string; setores: string[]; cats: string[]; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const { acesso } = useAuth();
  const [f, setF] = useState({ tipo: (l?.tipo ?? "saida") as "entrada" | "saida", descricao: l?.descricao ?? "", valor: l ? String(l.valor).replace(".", ",") : "", data: l?.data ?? new Date().toISOString().slice(0, 10), categoria: l?.categoria ?? "", setor: l?.setor ?? "" });
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
    setSalvando(true);
    let comp_path = l?.comp_path ?? null, comp_nome = l?.comp_nome ?? null;
    if ((tiraAnexo || arq) && l?.comp_path) { await supabase.storage.from("comprovantes").remove([l.comp_path]); comp_path = null; comp_nome = null; }
    if (arq) {
      const caminho = `${edicaoId}/${Date.now()}-${arq.name.normalize("NFD").replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
      const up = await supabase.storage.from("comprovantes").upload(caminho, arq, { contentType: arq.type || undefined });
      if (up.error) { setSalvando(false); aviso(msgErro(up.error)); return; }
      comp_path = caminho; comp_nome = arq.name;
    }
    const d = { edicao_id: edicaoId, tipo: f.tipo, descricao: f.descricao.trim(), valor: v, data: f.data, categoria: f.categoria.trim() || null, setor: f.tipo === "saida" ? f.setor || null : null, comp_path, comp_nome };
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
