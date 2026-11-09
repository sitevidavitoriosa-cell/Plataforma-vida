"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { norm } from "@/lib/tipos";
import { CORES, NOMES_COR } from "@/lib/cores";
import { useAviso, useEdicao } from "@/components/provedores";
import { Estoque } from "@/components/estoque";
import { Botao, Campo, Carregando, Cartao, Chip, Janela, Selo, Vazio } from "@/components/ui";

type Nome = { id: string; cod: string; nome: string; categoria: string | null; sexo: string | null };
type Cfg = { x: number; y: number; tam: number; cor_texto: string; por_pagina: number };
type Quarto = { id: string; edicao_id: string; nome: string; sexo: "Feminino" | "Masculino"; capacidade: number };
type Ocup = { encontrista_id: string; quarto_id: string };

const slug = (t: string) => norm(t).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const baixar = (blob: Blob, nome: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

export function Secretaria() {
  const [sub, setSub] = useState<"crachas" | "quartos" | "material">("crachas");
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-3">
        <Chip ativo={sub === "crachas"} onClick={() => setSub("crachas")}>Crachás</Chip>
        <Chip ativo={sub === "quartos"} onClick={() => setSub("quartos")}>Quartos</Chip>
        <Chip ativo={sub === "material"} onClick={() => setSub("material")}>Material</Chip>
      </div>
      {sub === "crachas" && <Crachas />}
      {sub === "quartos" && <Quartos />}
      {sub === "material" && <Estoque setor="Secretaria 1" />}
    </div>
  );
}

/* ---------- Crachás ---------- */
function useNomes() {
  const { ed } = useEdicao();
  const aviso = useAviso();
  const [nomes, setNomes] = useState<Nome[] | null>(null);
  const carregar = useCallback(async () => {
    if (!ed) return;
    const { data, error } = await supabase.rpc("nomes_edicao", { p_edicao: ed.id });
    if (error) { aviso(msgErro(error)); setNomes([]); return; }
    setNomes((data as Nome[]) ?? []);
  }, [ed, aviso]);
  useEffect(() => { setNomes(null); carregar(); }, [carregar]);
  return { nomes, recarregar: carregar };
}

const CFG0: Cfg = { x: 50, y: 62, tam: 7, cor_texto: "#111111", por_pagina: 8 };

function Crachas() {
  const { ed } = useEdicao();
  const aviso = useAviso();
  const { nomes } = useNomes();
  const [modelos, setModelos] = useState<Record<string, string>>({});
  const [cfg, setCfg] = useState<Cfg>(CFG0);
  const [grupo, setGrupo] = useState("Encontrista");
  const [previa, setPrevia] = useState("");
  const [gerando, setGerando] = useState(false);
  const [subindo, setSubindo] = useState("");
  const [prop, setProp] = useState(1.4);
  const arq = useRef<HTMLInputElement>(null);
  const corAlvo = useRef("");

  const carregar = useCallback(async () => {
    const [m, c] = await Promise.all([supabase.from("crachas_modelos").select("cor,arquivo"), supabase.from("crachas_cfg").select("*").eq("id", 1).maybeSingle()]);
    setModelos(Object.fromEntries(((m.data as { cor: string; arquivo: string }[] | null) ?? []).map((x) => [x.cor, x.arquivo])));
    if (c.data) setCfg(c.data as Cfg);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { setCorSel(""); }, [ed?.id]);

  const [corSel, setCorSel] = useState("");
  const cor = corSel || ed?.cor || "Roxa";
  const temModelo = !!modelos[cor];

  const urlModelo = useCallback(async (c: string) => {
    const { data } = await supabase.storage.from("crachas").createSignedUrl(modelos[c], 600);
    return data?.signedUrl ?? "";
  }, [modelos]);
  useEffect(() => { setPrevia(""); if (temModelo) urlModelo(cor).then(setPrevia); }, [cor, temModelo, urlModelo]);

  async function subir(c: string, f: File) {
    if (f.type !== "image/png") { aviso("Envie um arquivo PNG."); return; }
    setSubindo(c);
    const caminho = `modelos/${c}.png`;
    const up = await supabase.storage.from("crachas").upload(caminho, f, { upsert: true, contentType: "image/png" });
    if (up.error) { setSubindo(""); aviso(msgErro(up.error)); return; }
    const r = await supabase.from("crachas_modelos").upsert({ cor: c, arquivo: caminho, atualizado_em: new Date().toISOString() });
    setSubindo("");
    if (r.error) { aviso(msgErro(r.error)); return; }
    aviso(`Modelo da rede ${c} salvo.`); carregar();
  }
  async function salvarCfg(n: Cfg) { setCfg(n); await supabase.from("crachas_cfg").update(n).eq("id", 1); }

  const grupos = useMemo(() => Array.from(new Set((nomes ?? []).map((n) => (n.categoria ?? "").trim()).filter(Boolean))).sort(), [nomes]);
  const lista = useMemo(() => (nomes ?? []).filter((n) => !grupo || (n.categoria ?? "").trim() === grupo), [nomes, grupo]);

  async function gerar() {
    if (!ed || !temModelo || lista.length === 0) return;
    setGerando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const url = await urlModelo(cor);
      const blob = await (await fetch(url)).blob();
      const dataUrl: string = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(blob); });
      const dim: { w: number; h: number } = await new Promise((ok) => { const im = new Image(); im.onload = () => ok({ w: im.width, h: im.height }); im.src = dataUrl; });
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const cols = cfg.por_pagina <= 2 ? 1 : cfg.por_pagina === 9 ? 3 : 2;
      const linhas = Math.ceil(cfg.por_pagina / cols);
      const m = 8, cw = (210 - 2 * m) / cols, ch = (297 - 2 * m) / linhas;
      const esc = Math.min(cw / dim.w, ch / dim.h), w = dim.w * esc, h = dim.h * esc;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(cfg.cor_texto.slice(i, i + 2), 16));
      lista.forEach((n, i) => {
        const pos = i % cfg.por_pagina;
        if (i > 0 && pos === 0) pdf.addPage();
        const x = m + (pos % cols) * cw + (cw - w) / 2, y = m + Math.floor(pos / cols) * ch + (ch - h) / 2;
        pdf.addImage(dataUrl, "PNG", x, y, w, h);
        let fs = (cfg.tam / 100) * h * 2.835; // mm -> pt
        pdf.setTextColor(r, g, b); pdf.setFont("helvetica", "bold");
        const nome = n.nome.toUpperCase();
        pdf.setFontSize(fs);
        while (pdf.getTextWidth(nome) > w * 0.9 && fs > 6) { fs -= 0.5; pdf.setFontSize(fs); }
        pdf.text(nome, x + (cfg.x / 100) * w, y + (cfg.y / 100) * h, { align: "center", baseline: "middle" });
      });
      baixar(pdf.output("blob"), `Crachas_${slug(ed.nome)}_${cor}_${slug(grupo || "todos")}.pdf`);
      aviso(`${lista.length} crachás gerados.`);
    } catch (e) { aviso("Não consegui gerar o PDF: " + (e instanceof Error ? e.message : "erro")); }
    setGerando(false);
  }

  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!nomes) return <Carregando />;

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between"><b>Modelos por rede</b><span className="text-xs text-suave">um PNG por cor</span></div>
        <input ref={arq} type="file" accept="image/png" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(corAlvo.current, f); e.target.value = ""; }} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NOMES_COR.map((c) => (
            <button key={c} type="button" onClick={() => { corAlvo.current = c; arq.current?.click(); }} className="flex min-h-14 items-center gap-2 rounded-2xl border border-borda bg-white px-3 text-left">
              <span className="h-4 w-4 shrink-0 rounded-full border border-borda" style={{ background: CORES[c].hex }} />
              <span className="flex-1 text-sm font-bold">{c}<span className="block text-xs font-normal text-suave">{subindo === c ? "enviando…" : modelos[c] ? "enviado · trocar" : "enviar PNG"}</span></span>
            </button>
          ))}
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between"><b>Modelo de crachá desta edição</b><Selo tom="ok">{cor}</Selo></div>
        <div className="flex gap-2 overflow-x-auto">{NOMES_COR.map((c) => <Chip key={c} ativo={cor === c} onClick={() => setCorSel(c)}>{c}</Chip>)}</div>
        {!temModelo && <p className="m-0 text-sm text-alerta">Falta enviar o modelo da rede {cor}.</p>}
        {previa && (
          <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-borda" style={{ containerType: "inline-size" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previa} alt="Modelo do crachá" className="block w-full" onLoad={(e) => setProp(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)} />
            <span className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-extrabold" style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, fontSize: `${cfg.tam * prop * 0.7}cqw`, color: cfg.cor_texto }}>NOME DO ENCONTRISTA</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Campo rotulo="Posição → (%)" inputMode="numeric" value={String(cfg.x)} onChange={(e) => setCfg({ ...cfg, x: Number(e.target.value) || 0 })} onBlur={() => salvarCfg(cfg)} />
          <Campo rotulo="Posição ↓ (%)" inputMode="numeric" value={String(cfg.y)} onChange={(e) => setCfg({ ...cfg, y: Number(e.target.value) || 0 })} onBlur={() => salvarCfg(cfg)} />
          <Campo rotulo="Tamanho" inputMode="numeric" value={String(cfg.tam)} onChange={(e) => setCfg({ ...cfg, tam: Number(e.target.value) || 1 })} onBlur={() => salvarCfg(cfg)} />
        </div>
        <div className="flex flex-wrap gap-2"><span className="self-center text-sm font-bold">Por página:</span>
          {[1, 2, 4, 6, 8, 9].map((n) => <Chip key={n} ativo={cfg.por_pagina === n} onClick={() => salvarCfg({ ...cfg, por_pagina: n })}>{n}</Chip>)}
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-3 p-4">
        <b>Quem vai receber</b>
        <div className="flex gap-2 overflow-x-auto">
          {grupos.map((g) => <Chip key={g} ativo={grupo === g} onClick={() => setGrupo(g)}>{g}</Chip>)}
          <Chip ativo={grupo === ""} onClick={() => setGrupo("")}>Todos</Chip>
        </div>
        <Botao onClick={gerar} disabled={!temModelo || gerando || lista.length === 0} bloco>{gerando ? "Gerando…" : `Gerar PDF (${lista.length} crachás)`}</Botao>
      </Cartao>
    </div>
  );
}

/* ---------- Quartos ---------- */
function Quartos() {
  const { ed } = useEdicao();
  const aviso = useAviso();
  const { nomes } = useNomes();
  const [quartos, setQuartos] = useState<Quarto[] | null>(null);
  const [ocup, setOcup] = useState<Ocup[]>([]);
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<Quarto | null>(null);

  const carregar = useCallback(async () => {
    if (!ed) return;
    const q = await supabase.from("quartos").select("*").eq("edicao_id", ed.id).order("nome");
    setQuartos((q.data as Quarto[]) ?? []);
    const ids = ((q.data as Quarto[]) ?? []).map((x) => x.id);
    if (ids.length) { const o = await supabase.from("quarto_ocupantes").select("*").in("quarto_id", ids); setOcup((o.data as Ocup[]) ?? []); } else setOcup([]);
  }, [ed]);
  useEffect(() => { setQuartos(null); carregar(); }, [carregar]);

  const enc = useMemo(() => (nomes ?? []).filter((n) => (n.categoria ?? "").trim() === "Encontrista" || !n.categoria), [nomes]);
  const mapa = useMemo(() => new Map(enc.map((n) => [n.id, n])), [enc]);
  const alocados = new Set(ocup.map((o) => o.encontrista_id));
  const semQuarto = enc.filter((n) => !alocados.has(n.id));
  const doQuarto = (id: string) => ocup.filter((o) => o.quarto_id === id).map((o) => mapa.get(o.encontrista_id)).filter(Boolean) as Nome[];

  async function distribuir() {
    if (!quartos) return;
    const livre = new Map(quartos.map((q) => [q.id, q.capacidade - ocup.filter((o) => o.quarto_id === q.id).length]));
    const novos: Ocup[] = [];
    for (const n of semQuarto) {
      const q = quartos.find((x) => (n.sexo ?? "").toLowerCase().startsWith(x.sexo[0].toLowerCase()) && (livre.get(x.id) ?? 0) > 0);
      if (!q) continue;
      livre.set(q.id, (livre.get(q.id) ?? 0) - 1);
      novos.push({ encontrista_id: n.id, quarto_id: q.id });
    }
    if (novos.length === 0) { aviso("Ninguém para distribuir (sem vagas ou sem sexo informado)."); return; }
    const { error } = await supabase.from("quarto_ocupantes").insert(novos);
    if (error) { aviso(msgErro(error)); return; }
    aviso(`${novos.length} pessoas distribuídas.`); carregar();
  }
  async function limpar() {
    if (!quartos?.length) return;
    const { error } = await supabase.from("quarto_ocupantes").delete().in("quarto_id", quartos.map((q) => q.id));
    if (error) { aviso(msgErro(error)); return; }
    aviso("Distribuição limpa."); carregar();
  }
  async function pdf() {
    if (!ed || !quartos) return;
    const { jsPDF } = await import("jspdf");
    const d = new jsPDF({ unit: "mm", format: "a4" });
    quartos.forEach((q, i) => {
      if (i > 0) d.addPage();
      d.setFont("helvetica", "bold"); d.setFontSize(20); d.text(`${ed.nome} – ${q.nome}`, 15, 22);
      d.setFont("helvetica", "normal"); d.setFontSize(11); d.text(`${q.sexo} · ${doQuarto(q.id).length}/${q.capacidade} vagas`, 15, 30);
      doQuarto(q.id).forEach((n, j) => { d.setFontSize(14); d.text(`${j + 1}. ${n.nome}`, 15, 44 + j * 9); });
    });
    if (quartos.length === 0) return;
    baixar(d.output("blob"), `Quartos_${slug(ed.nome)}.pdf`);
  }

  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!quartos || !nomes) return <Carregando />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Botao onClick={() => setNovo(true)} className="!min-h-11">Novo quarto</Botao>
        <Botao v="suave" onClick={distribuir} className="!min-h-11" disabled={!quartos.length || !semQuarto.length}>Distribuir automático</Botao>
        <Botao v="sec" onClick={pdf} className="!min-h-11" disabled={!quartos.length}>Gerar lista (PDF)</Botao>
        {ocup.length > 0 && <Botao v="sec" onClick={limpar} className="!min-h-11 !text-alerta">Limpar</Botao>}
      </div>
      <p className="m-0 text-sm text-suave">{semQuarto.length} encontristas sem quarto · {quartos.reduce((s, q) => s + q.capacidade, 0)} vagas no total</p>
      {quartos.length === 0 && <Vazio>Cadastre os quartos (nome, sexo e vagas).</Vazio>}
      {quartos.map((q) => {
        const o = doQuarto(q.id);
        return (
          <button key={q.id} type="button" onClick={() => setAberto(q)} className="text-left">
            <Cartao className="flex items-center justify-between gap-3 p-4">
              <div><b>{q.nome}</b><div className="text-sm text-suave">{q.sexo}</div></div>
              <Selo tom={o.length >= q.capacidade ? "ok" : "neutro"}>{o.length}/{q.capacidade}</Selo>
            </Cartao>
          </button>
        );
      })}
      {novo && <FormQuarto edicaoId={ed.id} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />}
      {aberto && <QuartoJanela q={aberto} ocupantes={doQuarto(aberto.id)} candidatos={semQuarto.filter((n) => (n.sexo ?? "").toLowerCase().startsWith(aberto.sexo[0].toLowerCase()))}
        lotado={doQuarto(aberto.id).length >= aberto.capacidade} onFechar={() => setAberto(null)} onMudou={carregar} />}
    </div>
  );
}

function FormQuarto({ edicaoId, onFechar, onSalvo }: { edicaoId: string; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const [f, setF] = useState({ nome: "", sexo: "Feminino", cap: "6" });
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const cap = Number(f.cap);
    if (!f.nome.trim() || !(cap >= 1 && cap <= 60)) { aviso("Informe o nome e as vagas (1 a 60)."); return; }
    const { error } = await supabase.from("quartos").insert({ edicao_id: edicaoId, nome: f.nome.trim(), sexo: f.sexo, capacidade: cap });
    if (error) { aviso(msgErro(error)); return; }
    onSalvo();
  }
  return (
    <Janela titulo="Novo quarto" onFechar={onFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-3.5">
        <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Quarto 1" />
        <div className="grid grid-cols-2 gap-2">{["Feminino", "Masculino"].map((s) => <Chip key={s} ativo={f.sexo === s} onClick={() => setF({ ...f, sexo: s })}>{s}</Chip>)}</div>
        <Campo rotulo="Vagas" inputMode="numeric" value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value })} />
        <Botao type="submit" bloco>Salvar</Botao>
      </form>
    </Janela>
  );
}

function QuartoJanela({ q, ocupantes, candidatos, lotado, onFechar, onMudou }: { q: Quarto; ocupantes: Nome[]; candidatos: Nome[]; lotado: boolean; onFechar: () => void; onMudou: () => void }) {
  const aviso = useAviso();
  const [busca, setBusca] = useState("");
  const [del, setDel] = useState(false);
  async function add(n: Nome) { const { error } = await supabase.from("quarto_ocupantes").insert({ encontrista_id: n.id, quarto_id: q.id }); if (error) aviso(msgErro(error)); onMudou(); }
  async function tirar(n: Nome) { const { error } = await supabase.from("quarto_ocupantes").delete().eq("encontrista_id", n.id); if (error) aviso(msgErro(error)); onMudou(); }
  async function excluir() { const { error } = await supabase.from("quartos").delete().eq("id", q.id); if (error) { aviso(msgErro(error)); return; } onMudou(); onFechar(); }
  const cand = candidatos.filter((n) => !busca || norm(n.nome).includes(norm(busca))).slice(0, 30);
  return (
    <Janela titulo={`${q.nome} · ${ocupantes.length}/${q.capacidade}`} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        {ocupantes.length === 0 && <Vazio>Ninguém neste quarto.</Vazio>}
        {ocupantes.map((n) => (
          <div key={n.id} className="flex items-center justify-between rounded-2xl border border-borda px-3 py-2"><span>{n.nome}</span><button type="button" onClick={() => tirar(n)} className="min-h-10 px-2 text-sm font-bold text-alerta">Tirar</button></div>
        ))}
        {!lotado && (
          <>
            <b className="text-sm">Adicionar ({q.sexo.toLowerCase()})</b>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome" className="min-h-11 rounded-2xl border border-borda px-3 outline-none" />
            {cand.map((n) => <button key={n.id} type="button" onClick={() => add(n)} className="min-h-11 rounded-2xl border border-borda bg-white px-3 text-left">{n.nome}</button>)}
          </>
        )}
        {!del ? <Botao v="sec" bloco className="!text-alerta" onClick={() => setDel(true)}>Excluir quarto</Botao> : <Botao v="perigo" bloco onClick={excluir}>Confirmar exclusão</Botao>}
      </div>
    </Janela>
  );
}
