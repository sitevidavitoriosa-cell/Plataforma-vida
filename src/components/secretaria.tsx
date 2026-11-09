"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { norm } from "@/lib/tipos";
import { TIPOS } from "@/lib/cores";
import { useAviso, useEdicao } from "@/components/provedores";
import { Estoque } from "@/components/estoque";
import { acharPessoa, baixarModeloQuarto, lerNomesQuarto } from "@/lib/quartosPlanilha";
import { Botao, Campo, Carregando, Cartao, Chip, Janela, Selo, Seletor, Vazio } from "@/components/ui";

type Nome = { id: string; cod: string; nome: string; categoria: string | null; sexo: string | null };
type Quarto = { id: string; edicao_id: string; nome: string; sexo: "Feminino" | "Masculino"; capacidade: number };
type AnjoLig = { quarto_id: string; encontrista_id: string };
type Ocup = { encontrista_id: string; quarto_id: string };

const slug = (t: string) => norm(t).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const baixar = (blob: Blob, nome: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

export function Secretaria() {
  const [sub, setSub] = useState<"crachas" | "quartos" | "encontristas" | "material">("crachas");
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-3">
        <Chip ativo={sub === "crachas"} onClick={() => setSub("crachas")}>Crachás</Chip>
        <Chip ativo={sub === "quartos"} onClick={() => setSub("quartos")}>Quartos</Chip>
        <Chip ativo={sub === "encontristas"} onClick={() => setSub("encontristas")}>Encontristas</Chip>
        <Chip ativo={sub === "material"} onClick={() => setSub("material")}>Material</Chip>
      </div>
      {sub === "crachas" && <Crachas />}
      {sub === "quartos" && <Quartos />}
      {sub === "encontristas" && <EncontristasSec />}
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

type Cfg = { x: number; y: number; tam: number; cor_texto: string; por_pagina: number; fx: number; fy: number; fw: number; fh: number; redonda: boolean };
const CFG0: Cfg = { x: 50, y: 62, tam: 7, cor_texto: "#111111", por_pagina: 8, fx: 50, fy: 35, fw: 40, fh: 30, redonda: true };

const lerArquivo = (f: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(f); });
const carregarImg = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("imagem inválida")); im.src = src; });
/** Recorta a imagem para preencher a caixa (centralizado). Redonda = PNG com fundo transparente. */
function recortar(im: HTMLImageElement, larg: number, alt: number, redonda: boolean) {
  const c = document.createElement("canvas"); c.width = larg; c.height = alt;
  const g = c.getContext("2d")!;
  if (redonda) { g.beginPath(); g.ellipse(larg / 2, alt / 2, larg / 2, alt / 2, 0, 0, Math.PI * 2); g.clip(); }
  const e = Math.max(larg / im.width, alt / im.height), w = im.width * e, h = im.height * e;
  g.drawImage(im, (larg - w) / 2, (alt - h) / 2, w, h);
  return c.toDataURL(redonda ? "image/png" : "image/jpeg", 0.9);
}
/** Reduz a foto enviada (lado maior 800px) antes de guardar. */
async function reduzir(f: File): Promise<Blob> {
  const im = await carregarImg(await lerArquivo(f));
  const e = Math.min(1, 800 / Math.max(im.width, im.height));
  const c = document.createElement("canvas"); c.width = Math.round(im.width * e); c.height = Math.round(im.height * e);
  c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
  return await new Promise((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.85));
}

function Crachas() {
  const { ed } = useEdicao();
  const aviso = useAviso();
  const { nomes } = useNomes();
  const [modelos, setModelos] = useState<Record<string, string>>({}); // "chave|tipo" -> arquivo
  const [cfgs, setCfgs] = useState<Record<string, Cfg>>({ encontrista: CFG0, servo: CFG0 });
  const [fotos, setFotos] = useState<Record<string, string>>({}); // encontrista_id -> arquivo
  const [tipo, setTipo] = useState<"encontrista" | "servo">("encontrista");
  const [redeSel, setRedeSel] = useState("");
  const [previa, setPrevia] = useState("");
  const [gerando, setGerando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const [prop, setProp] = useState(1.4);
  const arq = useRef<HTMLInputElement>(null);
  const arqFoto = useRef<HTMLInputElement>(null);
  const arqLote = useRef<HTMLInputElement>(null);
  const fotoAlvo = useRef("");

  const carregar = useCallback(async () => {
    const [m, c, f] = await Promise.all([
      supabase.from("crachas_modelos").select("cor,tipo,arquivo"),
      supabase.from("crachas_cfg").select("*"),
      supabase.from("crachas_fotos").select("encontrista_id,arquivo"),
    ]);
    setModelos(Object.fromEntries(((m.data as { cor: string; tipo: string; arquivo: string }[] | null) ?? []).map((x) => [x.cor + "|" + x.tipo, x.arquivo])));
    const cs = (c.data as (Cfg & { id: number })[] | null) ?? [];
    setCfgs({ encontrista: cs.find((x) => x.id === 1) ?? CFG0, servo: cs.find((x) => x.id === 2) ?? CFG0 });
    setFotos(Object.fromEntries(((f.data as { encontrista_id: string; arquivo: string }[] | null) ?? []).map((x) => [x.encontrista_id, x.arquivo])));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { setRedeSel(""); }, [ed?.id]);

  // A rede vem da própria edição; só pergunta se a edição é de duas redes.
  const chaves = useMemo(() => {
    if (!ed) return [] as string[];
    if (ed.tipo && ed.tipo !== "rede") return [TIPOS[ed.tipo] ?? ed.tipo];
    return [ed.cor ?? "Roxa", ed.rede2].filter(Boolean) as string[];
  }, [ed]);
  const chave = redeSel && chaves.includes(redeSel) ? redeSel : chaves[0] ?? "Roxa";
  const cfg = cfgs[tipo];
  const arquivoModelo = modelos[chave + "|" + tipo];
  const temModelo = !!arquivoModelo;
  const rotuloTipo = tipo === "servo" ? "servos" : "encontristas";

  useEffect(() => {
    setPrevia("");
    if (arquivoModelo) supabase.storage.from("crachas").createSignedUrl(arquivoModelo, 600).then(({ data }) => setPrevia(data?.signedUrl ?? ""));
  }, [arquivoModelo]);

  async function subirModelo(f: File) {
    if (f.type !== "image/png") { aviso("Envie um arquivo PNG."); return; }
    setSubindo(true);
    const caminho = `modelos/${chave}_${tipo}.png`;
    const up = await supabase.storage.from("crachas").upload(caminho, f, { upsert: true, contentType: "image/png" });
    if (up.error) { setSubindo(false); aviso(msgErro(up.error)); return; }
    const r = await supabase.from("crachas_modelos").upsert({ cor: chave, tipo, arquivo: caminho, atualizado_em: new Date().toISOString() });
    setSubindo(false);
    if (r.error) { aviso(msgErro(r.error)); return; }
    aviso(`Modelo de ${rotuloTipo} salvo.`); carregar();
  }
  async function salvarCfg(n: Cfg) { setCfgs((s) => ({ ...s, [tipo]: n })); await supabase.from("crachas_cfg").update(n).eq("id", tipo === "servo" ? 2 : 1); }
  const mudar = (p: Partial<Cfg>) => setCfgs((s) => ({ ...s, [tipo]: { ...s[tipo], ...p } }));

  const lista = useMemo(() => (nomes ?? []).filter((n) => {
    const encontrista = (n.categoria ?? "").trim() === "Encontrista" || !n.categoria;
    return tipo === "servo" ? !encontrista : encontrista;
  }), [nomes, tipo]);
  const comFoto = lista.filter((n) => fotos[n.id]).length;

  async function subirFoto(n: { id: string }, f: File) {
    try {
      const blob = await reduzir(f);
      const caminho = `fotos/${n.id}.jpg`;
      const up = await supabase.storage.from("crachas").upload(caminho, blob, { upsert: true, contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const r = await supabase.from("crachas_fotos").upsert({ encontrista_id: n.id, arquivo: caminho, atualizado_em: new Date().toISOString() });
      if (r.error) throw r.error;
      return true;
    } catch (e) { aviso(msgErro(e as Error)); return false; }
  }
  async function fotoUma(f: File) { setSubindo(true); if (await subirFoto({ id: fotoAlvo.current }, f)) { aviso("Foto salva."); await carregar(); } setSubindo(false); }
  /** Várias fotos de uma vez: o nome do arquivo deve ser o nome da pessoa (ex.: maria_silva.jpg). */
  async function fotoLote(fs: File[]) {
    setSubindo(true);
    let ok = 0; const sem: string[] = [];
    for (const f of fs) {
      const base = norm(f.name.replace(/\.[^.]+$/, "")).replace(/[^a-z0-9]+/g, " ").trim();
      const alvo = lista.find((n) => norm(n.nome).replace(/[^a-z0-9]+/g, " ").trim() === base) ?? lista.find((n) => base.length > 3 && norm(n.nome).replace(/[^a-z0-9]+/g, " ").includes(base));
      if (!alvo) { sem.push(f.name); continue; }
      if (await subirFoto(alvo, f)) ok++;
    }
    await carregar(); setSubindo(false);
    aviso(`${ok} foto(s) salva(s).${sem.length ? ` Sem correspondência: ${sem.slice(0, 3).join(", ")}${sem.length > 3 ? "…" : ""}` : ""}`);
  }

  async function gerar() {
    if (!ed || !temModelo || lista.length === 0) return;
    setGerando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { data: su } = await supabase.storage.from("crachas").createSignedUrl(arquivoModelo, 600);
      const dataUrl = await lerArquivo(await (await fetch(su!.signedUrl)).blob());
      const dim = await carregarImg(dataUrl);
      // fotos dos servos
      const imgs = new Map<string, HTMLImageElement>();
      if (tipo === "servo") {
        const com = lista.filter((n) => fotos[n.id]);
        const { data: urls } = await supabase.storage.from("crachas").createSignedUrls(com.map((n) => fotos[n.id]), 600);
        await Promise.all((urls ?? []).map(async (u, i) => { if (!u.signedUrl) return; try { imgs.set(com[i].id, await carregarImg(await lerArquivo(await (await fetch(u.signedUrl)).blob()))); } catch {} }));
      }
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const cols = cfg.por_pagina <= 2 ? 1 : cfg.por_pagina === 9 ? 3 : 2;
      const linhas = Math.ceil(cfg.por_pagina / cols);
      const m = 8, cw = (210 - 2 * m) / cols, ch = (297 - 2 * m) / linhas;
      const esc = Math.min(cw / dim.width, ch / dim.height), w = dim.width * esc, h = dim.height * esc;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(cfg.cor_texto.slice(i, i + 2), 16));
      lista.forEach((n, i) => {
        const pos = i % cfg.por_pagina;
        if (i > 0 && pos === 0) pdf.addPage();
        const x = m + (pos % cols) * cw + (cw - w) / 2, y = m + Math.floor(pos / cols) * ch + (ch - h) / 2;
        pdf.addImage(dataUrl, "PNG", x, y, w, h);
        const im = imgs.get(n.id);
        if (im) {
          const bw = (cfg.fw / 100) * w, bh = (cfg.fh / 100) * h;
          const px = Math.round(bw * 12), py = Math.round(bh * 12); // ~300 dpi
          pdf.addImage(recortar(im, px, py, cfg.redonda), cfg.redonda ? "PNG" : "JPEG", x + (cfg.fx / 100) * w - bw / 2, y + (cfg.fy / 100) * h - bh / 2, bw, bh);
        }
        let fs = (cfg.tam / 100) * h * 2.835;
        pdf.setTextColor(r, g, b); pdf.setFont("helvetica", "bold");
        const nome = n.nome.toUpperCase();
        pdf.setFontSize(fs);
        while (pdf.getTextWidth(nome) > w * 0.9 && fs > 6) { fs -= 0.5; pdf.setFontSize(fs); }
        pdf.text(nome, x + (cfg.x / 100) * w, y + (cfg.y / 100) * h, { align: "center", baseline: "middle" });
      });
      baixar(pdf.output("blob"), `Crachas_${slug(ed.nome)}_${rotuloTipo}.pdf`);
      aviso(`${lista.length} crachás gerados.`);
    } catch (e) { aviso("Não consegui gerar o PDF: " + (e instanceof Error ? e.message : "erro")); }
    setGerando(false);
  }

  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!nomes) return <Carregando />;

  return (
    <Cartao className="flex flex-col gap-3 p-4">
      <input ref={arq} type="file" accept="image/png" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) subirModelo(f); e.target.value = ""; }} />
      <input ref={arqFoto} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) fotoUma(f); e.target.value = ""; }} />
      <input ref={arqLote} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) fotoLote(fs); e.target.value = ""; }} />

      <div className="grid grid-cols-2 gap-2">
        <Seletor rotulo="Crachá de" value={tipo} onChange={(e) => setTipo(e.target.value as "encontrista" | "servo")}>
          <option value="encontrista">Encontristas</option>
          <option value="servo">Servos (com foto)</option>
        </Seletor>
        {chaves.length > 1 ? (
          <Seletor rotulo="Rede" value={chave} onChange={(e) => setRedeSel(e.target.value)}>{chaves.map((c) => <option key={c}>{c}</option>)}</Seletor>
        ) : <div className="flex flex-col justify-end pb-3 text-sm text-suave">Modelo: <b className="text-texto">{ed.nome}</b></div>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{temModelo ? <Selo tom="ok">Modelo enviado</Selo> : <span className="text-alerta">Falta o modelo (PNG) de {rotuloTipo}.</span>}</span>
        <Botao v="sec" className="!min-h-10" onClick={() => arq.current?.click()} disabled={subindo}>{subindo ? "Enviando…" : temModelo ? "Trocar PNG" : "Enviar PNG"}</Botao>
      </div>

      {previa && (
        <div className="relative mx-auto w-full max-w-[220px] overflow-hidden rounded-2xl border border-borda" style={{ containerType: "inline-size" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previa} alt="Modelo do crachá" className="block w-full" onLoad={(e) => setProp(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)} />
          {tipo === "servo" && (
            <span className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-dashed border-marca bg-white/60 text-[10px] font-bold text-marca"
              style={{ left: `${cfg.fx}%`, top: `${cfg.fy}%`, width: `${cfg.fw}%`, height: `${cfg.fh * prop}cqw`, borderRadius: cfg.redonda ? "50%" : 6 }}>FOTO</span>
          )}
          <span className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-extrabold" style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, fontSize: `${cfg.tam * prop * 0.7}cqw`, color: cfg.cor_texto }}>NOME</span>
        </div>
      )}

      <details className="rounded-2xl border border-borda px-3 py-2">
        <summary className="min-h-9 cursor-pointer text-sm font-bold">Ajustar posições</summary>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <Campo rotulo="Nome →" inputMode="numeric" value={String(cfg.x)} onChange={(e) => mudar({ x: Number(e.target.value) || 0 })} onBlur={() => salvarCfg(cfg)} />
          <Campo rotulo="Nome ↓" inputMode="numeric" value={String(cfg.y)} onChange={(e) => mudar({ y: Number(e.target.value) || 0 })} onBlur={() => salvarCfg(cfg)} />
          <Campo rotulo="Letra" inputMode="numeric" value={String(cfg.tam)} onChange={(e) => mudar({ tam: Number(e.target.value) || 1 })} onBlur={() => salvarCfg(cfg)} />
          {tipo === "servo" && (
            <>
              <Campo rotulo="Foto →" inputMode="numeric" value={String(cfg.fx)} onChange={(e) => mudar({ fx: Number(e.target.value) || 0 })} onBlur={() => salvarCfg(cfg)} />
              <Campo rotulo="Foto ↓" inputMode="numeric" value={String(cfg.fy)} onChange={(e) => mudar({ fy: Number(e.target.value) || 0 })} onBlur={() => salvarCfg(cfg)} />
              <Campo rotulo="Largura" inputMode="numeric" value={String(cfg.fw)} onChange={(e) => mudar({ fw: Number(e.target.value) || 1 })} onBlur={() => salvarCfg(cfg)} />
              <Campo rotulo="Altura" inputMode="numeric" value={String(cfg.fh)} onChange={(e) => mudar({ fh: Number(e.target.value) || 1 })} onBlur={() => salvarCfg(cfg)} />
              <Seletor rotulo="Formato" value={cfg.redonda ? "r" : "q"} onChange={(e) => salvarCfg({ ...cfg, redonda: e.target.value === "r" })}><option value="r">Redonda</option><option value="q">Retangular</option></Seletor>
            </>
          )}
          <Seletor rotulo="Por página" value={String(cfg.por_pagina)} onChange={(e) => salvarCfg({ ...cfg, por_pagina: Number(e.target.value) })}>{[1, 2, 4, 6, 8, 9].map((n) => <option key={n}>{n}</option>)}</Seletor>
        </div>
      </details>

      {tipo === "servo" && (
        <details className="rounded-2xl border border-borda px-3 py-2">
          <summary className="min-h-9 cursor-pointer text-sm font-bold">Fotos dos servos ({comFoto}/{lista.length})</summary>
          <div className="mt-2 flex flex-col gap-2">
            <Botao v="suave" className="!min-h-10" onClick={() => arqLote.current?.click()} disabled={subindo}>Enviar várias fotos de uma vez</Botao>
            <p className="m-0 text-xs text-suave">Nomeie cada arquivo com o nome da pessoa (ex.: maria_silva.jpg) e o sistema encaixa sozinho. Ou toque no nome abaixo para enviar uma foto (no celular, pode tirar na hora).</p>
            {lista.length === 0 && <Vazio>Nenhum servo na planilha desta edição.</Vazio>}
            {lista.map((n) => (
              <button key={n.id} type="button" onClick={() => { fotoAlvo.current = n.id; arqFoto.current?.click(); }} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-borda bg-white px-3 text-left text-sm">
                <span className="truncate">{n.nome}</span>
                <span className={"shrink-0 text-xs font-bold " + (fotos[n.id] ? "text-marca" : "text-alerta")}>{fotos[n.id] ? "com foto · trocar" : "sem foto · enviar"}</span>
              </button>
            ))}
          </div>
        </details>
      )}

      <Botao onClick={gerar} disabled={!temModelo || gerando || lista.length === 0} bloco>{gerando ? "Gerando…" : `Gerar PDF (${lista.length} crachás de ${rotuloTipo})`}</Botao>
      {tipo === "servo" && comFoto < lista.length && lista.length > 0 && <p className="m-0 text-xs text-suave">{lista.length - comFoto} servo(s) sem foto sairão só com o nome.</p>}
    </Cartao>
  );
}

/* ---------- Encontristas (dados de cadastro, sem telefone/CPF/pagamento/saúde) ---------- */
type EncSec = { id: string; cod: string; nome: string; categoria: string | null; sexo: string | null; idade: number | null; estado_civil: string | null; bairro: string | null; municipio: string | null; batizado: boolean | null; igreja: string | null; rede: string | null };
function EncontristasSec() {
  const { ed } = useEdicao();
  const aviso = useAviso();
  const [dados, setDados] = useState<EncSec[] | null>(null);
  const [quartoDe, setQuartoDe] = useState<Map<string, string>>(new Map());
  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState("Encontrista");
  useEffect(() => {
    if (!ed) return;
    setDados(null);
    supabase.rpc("secretaria_encontristas", { p_edicao: ed.id }).then(({ data, error }) => { if (error) { aviso(msgErro(error)); setDados([]); } else setDados((data as EncSec[]) ?? []); });
    supabase.from("quartos").select("id,nome").eq("edicao_id", ed.id).then(async ({ data: qs }) => {
      const nomes = new Map(((qs as { id: string; nome: string }[]) ?? []).map((x) => [x.id, x.nome]));
      if (!nomes.size) { setQuartoDe(new Map()); return; }
      const { data: oc } = await supabase.from("quarto_ocupantes").select("encontrista_id,quarto_id").in("quarto_id", Array.from(nomes.keys()));
      setQuartoDe(new Map(((oc as { encontrista_id: string; quarto_id: string }[]) ?? []).map((o) => [o.encontrista_id, nomes.get(o.quarto_id) ?? ""])));
    });
  }, [ed, aviso]);
  const grupos = useMemo(() => Array.from(new Set((dados ?? []).map((n) => (n.categoria ?? "").trim()).filter(Boolean))).sort(), [dados]);
  const lista = useMemo(() => (dados ?? []).filter((n) => (!grupo || (n.categoria ?? "").trim() === grupo) && (!q || norm(n.nome + " " + (n.cod ?? "")).includes(norm(q)))), [dados, grupo, q]);
  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!dados) return <Carregando />;
  return (
    <div className="flex flex-col gap-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome ou inscrição" aria-label="Buscar" className="min-h-12 rounded-2xl border border-borda bg-white px-4 outline-none" />
      <div className="flex gap-2 overflow-x-auto">
        {grupos.map((g) => <Chip key={g} ativo={grupo === g} onClick={() => setGrupo(g)}>{g}</Chip>)}
        <Chip ativo={grupo === ""} onClick={() => setGrupo("")}>Todos</Chip>
      </div>
      <p className="m-0 text-sm text-suave">{lista.length} pessoa(s). Telefone, pagamento e saúde não aparecem aqui.</p>
      {lista.length === 0 && <Vazio>Ninguém encontrado.</Vazio>}
      {lista.map((n) => (
        <Cartao key={n.id} className="flex flex-col gap-1 p-3.5">
          <div className="flex items-center justify-between gap-2"><b>{n.nome}</b>{quartoDe.get(n.id) ? <Selo tom="ok">{quartoDe.get(n.id)}</Selo> : (n.categoria ?? "").trim() === "Encontrista" ? <Selo tom="aviso">sem quarto</Selo> : null}</div>
          <span className="text-xs text-suave">{[n.categoria?.trim(), n.sexo, n.idade ? n.idade + " anos" : "", n.estado_civil, n.bairro || n.municipio].filter(Boolean).join(" · ")}</span>
          <span className="text-xs text-suave">{[n.batizado === null ? "" : n.batizado ? "Batizado" : "Não batizado", n.igreja, n.rede && "Rede " + n.rede].filter(Boolean).join(" · ")}</span>
        </Cartao>
      ))}
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
  const [comLink, setComLink] = useState<Set<string>>(new Set());
  const [anjosLig, setAnjosLig] = useState<AnjoLig[]>([]);
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<Quarto | null>(null);

  const carregar = useCallback(async () => {
    if (!ed) return;
    const q = await supabase.from("quartos").select("*").eq("edicao_id", ed.id).order("nome");
    setQuartos((q.data as Quarto[]) ?? []);
    const ids = ((q.data as Quarto[]) ?? []).map((x) => x.id);
    if (ids.length) {
      const [o, l, an] = await Promise.all([supabase.from("quarto_ocupantes").select("*").in("quarto_id", ids), supabase.from("quarto_links").select("quarto_id").eq("ativo", true).in("quarto_id", ids), supabase.from("quarto_anjos").select("quarto_id,encontrista_id").in("quarto_id", ids)]);
      setAnjosLig((an.data as AnjoLig[]) ?? []);
      setOcup((o.data as Ocup[]) ?? []); setComLink(new Set(((l.data as { quarto_id: string }[]) ?? []).map((x) => x.quarto_id)));
    } else { setOcup([]); setComLink(new Set()); setAnjosLig([]); }
  }, [ed]);
  useEffect(() => { setQuartos(null); carregar(); }, [carregar]);

  const enc = useMemo(() => (nomes ?? []).filter((n) => (n.categoria ?? "").trim() === "Encontrista" || !n.categoria), [nomes]);
  const mapa = useMemo(() => new Map(enc.map((n) => [n.id, n])), [enc]);
  const servos = useMemo(() => (nomes ?? []).filter((n) => !((n.categoria ?? "").trim() === "Encontrista" || !n.categoria)), [nomes]);
  const anjosUsados = useMemo(() => new Set(anjosLig.map((a) => a.encontrista_id)), [anjosLig]);
  const nomeServo = (id: string | null) => servos.find((x) => x.id === id)?.nome ?? "";
  const anjosDe = (qid: string) => anjosLig.filter((a) => a.quarto_id === qid).map((a) => nomeServo(a.encontrista_id)).filter(Boolean);
  const alocados = new Set(ocup.map((o) => o.encontrista_id));
  const semQuarto = enc.filter((n) => !alocados.has(n.id));
  const doQuarto = (id: string) => ocup.filter((o) => o.quarto_id === id).map((o) => mapa.get(o.encontrista_id)).filter(Boolean) as Nome[];

  /** Gera o link de cada quarto que ainda não tem e baixa uma planilha Quarto | Link para enviar aos anjos. */
  async function linksTodos() {
    if (!ed || !quartos?.length) return;
    const faltam = quartos.filter((q) => !comLink.has(q.id));
    if (faltam.length) {
      const { error } = await supabase.from("quarto_links").insert(faltam.map((q) => ({ quarto_id: q.id })));
      if (error) { aviso(msgErro(error)); return; }
    }
    const { data, error } = await supabase.from("quarto_links").select("quarto_id,token").eq("ativo", true).in("quarto_id", quartos.map((q) => q.id));
    if (error) { aviso(msgErro(error)); return; }
    const tok = new Map((data as { quarto_id: string; token: string }[]).map((x) => [x.quarto_id, x.token]));
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([["Quarto", "Encontristas", "Anjo", "Link"], ...quartos.map((q) => [q.nome, doQuarto(q.id).length, "", `${window.location.origin}/q/${tok.get(q.id) ?? ""}`])]);
    ws["!cols"] = [{ wch: 14 }, { wch: 13 }, { wch: 24 }, { wch: 70 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Links");
    XLSX.writeFile(wb, `Links_quartos_${slug(ed.nome)}.xlsx`);
    aviso(`${faltam.length} link(s) novo(s). Planilha baixada.`); carregar();
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
        <Botao v="sec" onClick={linksTodos} className="!min-h-11" disabled={!quartos.length}>Links de todos</Botao>
        <Botao v="sec" onClick={pdf} className="!min-h-11" disabled={!quartos.length}>Gerar lista (PDF)</Botao>
      </div>
      <p className="m-0 text-sm text-suave">{semQuarto.length} encontristas sem quarto · {quartos.reduce((s, q) => s + q.capacidade, 0)} vagas. Crie o quarto, marque o anjo e os encontristas. Ao salvar, o link do anjo já fica ativo.</p>
      {quartos.length === 0 && <Vazio>Toque em “Novo quarto” para começar.</Vazio>}
      {quartos.map((q) => {
        const o = doQuarto(q.id);
        return (
          <button key={q.id} type="button" onClick={() => setAberto(q)} className="text-left">
            <Cartao className="flex items-center justify-between gap-3 p-4">
              <div><b>{q.nome}</b><div className="text-sm text-suave">{q.sexo}{anjosDe(q.id).length ? ` · ${anjosDe(q.id).length > 1 ? "Anjos" : "Anjo"}: ${anjosDe(q.id).join(", ")}` : ""}</div></div>
              <span className="flex items-center gap-2">{comLink.has(q.id) && <Selo tom="ok">link ativo</Selo>}<Selo tom={o.length >= q.capacidade ? "ok" : "neutro"}>{o.length}/{q.capacidade}</Selo></span>
            </Cartao>
          </button>
        );
      })}
      {novo && <FormQuarto edicaoId={ed.id} servos={servos} anjosUsados={anjosUsados} enc={enc} candidatos={semQuarto} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />}
      {aberto && <QuartoJanela q={aberto} servos={servos} anjosUsados={anjosUsados} anjosAtuais={anjosLig.filter((a) => a.quarto_id === aberto.id).map((a) => a.encontrista_id)} ocupantes={doQuarto(aberto.id)} candidatos={[...semQuarto].sort((a, b) => Number((b.sexo ?? "").toLowerCase().startsWith(aberto.sexo[0].toLowerCase())) - Number((a.sexo ?? "").toLowerCase().startsWith(aberto.sexo[0].toLowerCase())))}
        lotado={doQuarto(aberto.id).length >= aberto.capacidade} onFechar={() => setAberto(null)} onMudou={carregar} />}
    </div>
  );
}

/** Anjo do quarto (servo) em lista: depois de escolher um, a caixa "Existe outro servo nesse quarto?" abre mais uma escolha. */
function AnjosCampo({ valores, onChange, servos, usadosFora }: { valores: string[]; onChange: (v: string[]) => void; servos: Nome[]; usadosFora: Set<string> }) {
  const mudar = (i: number, id: string) => onChange(valores.map((x, k) => (k === i ? id : x)));
  return (
    <div className="flex flex-col gap-2.5">
      {valores.map((v, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Seletor rotulo={i === 0 ? "Anjo do quarto (servos)" : `Outro servo do quarto (${i + 1})`} value={v} onChange={(e) => mudar(i, e.target.value)}>
            <option value="">{i === 0 ? "Escolher depois" : "Escolher"}</option>
            {servos.map((x) => {
              const ocupado = (usadosFora.has(x.id) || valores.some((o, k) => k !== i && o === x.id));
              return <option key={x.id} value={x.id} disabled={ocupado}>{x.nome}{usadosFora.has(x.id) ? " (já é anjo de outro quarto)" : ocupado ? " (já escolhido)" : ""}</option>;
            })}
          </Seletor>
          {v && valores.length < 4 && (
            <label className="flex min-h-10 items-center gap-2.5 text-sm font-bold">
              <input type="checkbox" className="h-5 w-5 accent-[#1f6f5c]" checked={valores.length > i + 1}
                onChange={(e) => onChange(e.target.checked ? [...valores.slice(0, i + 1), ""] : valores.slice(0, i + 1))} />
              Existe outro servo nesse quarto?
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

function FormQuarto({ edicaoId, servos, anjosUsados, enc, candidatos, onFechar, onSalvo }: { edicaoId: string; servos: Nome[]; anjosUsados: Set<string>; enc: Nome[]; candidatos: Nome[]; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const [f, setF] = useState({ nome: "", sexo: "Feminino", cap: "6" });
  const [anjos, setAnjos] = useState<string[]>([""]);
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Nome[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [relatorio, setRelatorio] = useState<string[]>([]);
  const arq = useRef<HTMLInputElement>(null);
  const cap = Number(f.cap);
  /** Nomes da planilha -> marcados no quarto. Não repete nome, não pega quem já tem quarto e respeita as vagas. */
  async function planilha(file: File) {
    try {
      const nomes = await lerNomesQuarto(file);
      if (!nomes.length) { aviso("Não encontrei nomes. Use a coluna “Encontrista” do modelo."); return; }
      const novos = [...marcados]; const rel: string[] = []; let add = 0;
      for (const nome of nomes) {
        const p = acharPessoa(nome, candidatos);
        if (!p) {
          const outro = acharPessoa(nome, enc);
          rel.push(outro ? `${nome}: já está em outro quarto` : `${nome}: não encontrado (ou há mais de uma pessoa com esse nome)`);
          continue;
        }
        if (novos.some((m) => m.id === p.id)) { rel.push(`${nome}: repetido na planilha`); continue; }
        if (novos.length >= cap) { rel.push(`${nome}: sem vaga (limite de ${cap})`); continue; }
        novos.push(p); add++;
      }
      setMarcados(novos); setRelatorio(rel);
      aviso(`${add} encontrista(s) marcado(s).${rel.length ? ` ${rel.length} ficaram de fora.` : ""}`);
    } catch (er) { aviso("Não consegui ler o arquivo: " + (er instanceof Error ? er.message : "erro")); }
  }
  const doSexo = (n: Nome) => (n.sexo ?? "").toLowerCase().startsWith(f.sexo[0].toLowerCase());
  const achados = useMemo(() => {
    const t = norm(busca);
    if (t.length < 2) return [];
    return candidatos.filter((n) => !marcados.some((m) => m.id === n.id) && norm(n.nome).includes(t)).sort((a, b) => Number(doSexo(b)) - Number(doSexo(a))).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, candidatos, marcados, f.sexo]);
  function marcar(n: Nome) {
    if (marcados.length >= cap) { aviso(`O quarto tem ${cap} vagas. Aumente as vagas para colocar mais gente.`); return; }
    setMarcados([...marcados, n]); setBusca("");
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim() || !(cap >= 1 && cap <= 60)) { aviso("Informe o número/nome do quarto e as vagas (1 a 60)."); return; }
    if (marcados.length > cap) { aviso("Há mais pessoas marcadas do que vagas."); return; }
    setSalvando(true);
    try {
      const { data, error } = await supabase.from("quartos").insert({ edicao_id: edicaoId, nome: f.nome.trim(), sexo: f.sexo, capacidade: cap }).select("id").single();
      if (error) throw error;
      if (marcados.length) { const r = await supabase.from("quarto_ocupantes").insert(marcados.map((n) => ({ encontrista_id: n.id, quarto_id: data.id }))); if (r.error) throw r.error; }
      const ids = Array.from(new Set(anjos.filter(Boolean)));
      if (ids.length) { const a = await supabase.from("quarto_anjos").insert(ids.map((id) => ({ encontrista_id: id, quarto_id: data.id }))); if (a.error) throw a.error; }
      const l = await supabase.from("quarto_links").insert({ quarto_id: data.id }); if (l.error) throw l.error;
      aviso("Quarto salvo. O link do anjo já está ativo.");
      onSalvo();
    } catch (er) { aviso(msgErro(er as Error)); }
    setSalvando(false);
  }
  return (
    <Janela titulo="Novo quarto" onFechar={onFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-3.5">
        <Campo rotulo="Número ou nome do quarto" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Quarto 1" />
        <div className="grid grid-cols-2 gap-2">{["Feminino", "Masculino"].map((s) => <Chip key={s} ativo={f.sexo === s} onClick={() => setF({ ...f, sexo: s })}>{s}</Chip>)}</div>
        <Campo rotulo="Vagas" inputMode="numeric" value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value })} />
        <AnjosCampo valores={anjos} onChange={setAnjos} servos={servos} usadosFora={anjosUsados} />
        <div className="flex flex-col gap-2">
          <b className="text-sm">Encontristas do quarto ({marcados.length}/{Number.isFinite(cap) ? cap : 0})</b>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite o nome do encontrista" className="min-h-12 rounded-2xl border border-borda bg-white px-4 outline-none focus:border-marca" />
          {achados.map((n) => (
            <button key={n.id} type="button" onClick={() => marcar(n)} className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-borda bg-white px-3 text-left">
              <span className="truncate">{n.nome}</span><span className="shrink-0 text-xs font-bold text-marca">{n.sexo ?? ""} · marcar</span>
            </button>
          ))}
          {busca.trim().length >= 2 && achados.length === 0 && <p className="m-0 text-sm text-suave">Ninguém sem quarto com esse nome.</p>}
          {marcados.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {marcados.map((n) => <button key={n.id} type="button" onClick={() => setMarcados(marcados.filter((m) => m.id !== n.id))} className="min-h-9 rounded-full bg-marca-clara px-3 text-sm font-bold text-marca-esc">{n.nome} ✕</button>)}
            </div>
          )}
        </div>
        <Botao type="submit" bloco disabled={salvando}>{salvando ? "Salvando…" : "Salvar quarto"}</Botao>
        <div className="flex flex-col gap-2 rounded-2xl border border-borda p-3">
          <b className="text-sm">Ou preencha por planilha</b>
          <p className="m-0 text-xs text-suave">A planilha só leva o nome dos encontristas (o anjo, o sexo e as vagas são os de cima). O mesmo nome não pode repetir, e quem já está em outro quarto fica de fora.</p>
          <input ref={arq} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) planilha(x); e.target.value = ""; }} />
          <div className="flex gap-2">
            <Botao v="sec" onClick={() => baixarModeloQuarto(Number.isFinite(cap) ? cap : 6, f.nome)} className="!min-h-11 flex-1">Baixar modelo</Botao>
            <Botao v="sec" onClick={() => arq.current?.click()} className="!min-h-11 flex-1">Enviar planilha</Botao>
          </div>
          {relatorio.length > 0 && <ul className="m-0 list-disc pl-5 text-xs text-alerta">{relatorio.slice(0, 8).map((r, i) => <li key={i}>{r}</li>)}{relatorio.length > 8 && <li>e mais {relatorio.length - 8}…</li>}</ul>}
        </div>
      </form>
    </Janela>
  );
}

function QuartoJanela({ q, servos, anjosUsados, anjosAtuais, ocupantes, candidatos, lotado, onFechar, onMudou }: { q: Quarto; servos: Nome[]; anjosUsados: Set<string>; anjosAtuais: string[]; ocupantes: Nome[]; candidatos: Nome[]; lotado: boolean; onFechar: () => void; onMudou: () => void }) {
  const aviso = useAviso();
  const [busca, setBusca] = useState("");
  const [del, setDel] = useState(false);
  const [anjosSel, setAnjosSel] = useState<string[]>(anjosAtuais.length ? anjosAtuais : [""]);
  async function trocarAnjos(v: string[]) {
    setAnjosSel(v);
    const ids = Array.from(new Set(v.filter(Boolean)));
    const del = await supabase.from("quarto_anjos").delete().eq("quarto_id", q.id);
    if (del.error) { aviso(msgErro(del.error)); return; }
    if (ids.length) { const r = await supabase.from("quarto_anjos").insert(ids.map((id) => ({ encontrista_id: id, quarto_id: q.id }))); if (r.error) { aviso(msgErro(r.error)); return; } }
    onMudou();
  }
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { supabase.from("quarto_links").select("token").eq("quarto_id", q.id).eq("ativo", true).order("criado_em", { ascending: false }).limit(1).then(({ data }) => setToken(data?.[0]?.token ?? null)); }, [q.id]);
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/q/${token}` : "";
  async function gerarLink() {
    await supabase.from("quarto_links").update({ ativo: false }).eq("quarto_id", q.id);
    const { data, error } = await supabase.from("quarto_links").insert({ quarto_id: q.id }).select("token").single();
    if (error) { aviso(msgErro(error)); return; }
    setToken(data.token); onMudou();
  }
  async function desligarLink() { await supabase.from("quarto_links").update({ ativo: false }).eq("quarto_id", q.id); setToken(null); aviso("Link desligado."); onMudou(); }
  async function copiar() { try { await navigator.clipboard.writeText(url); aviso("Link copiado."); } catch { aviso("Copie o link na tela."); } }
  async function add(n: Nome) { const { error } = await supabase.from("quarto_ocupantes").insert({ encontrista_id: n.id, quarto_id: q.id }); if (error) aviso(msgErro(error)); onMudou(); }
  async function tirar(n: Nome) { const { error } = await supabase.from("quarto_ocupantes").delete().eq("encontrista_id", n.id); if (error) aviso(msgErro(error)); onMudou(); }
  async function excluir() { const { error } = await supabase.from("quartos").delete().eq("id", q.id); if (error) { aviso(msgErro(error)); return; } onMudou(); onFechar(); }
  const cand = candidatos.filter((n) => !busca || norm(n.nome).includes(norm(busca))).slice(0, 40);
  return (
    <Janela titulo={`${q.nome} · ${ocupantes.length}/${q.capacidade}`} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-2xl border border-borda p-3">
          <b className="text-sm">Link do anjo (perfil dos encontristas do quarto)</b>
          {token === undefined ? null : token ? (
            <>
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-h-11 rounded-xl border border-borda px-3 text-sm" />
              <div className="flex flex-wrap gap-2">
                <Botao v="sec" onClick={copiar} className="!min-h-11">Copiar</Botao>
                <a className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-marca px-5 text-[15px] font-extrabold text-white" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${q.nome}: perfil dos encontristas do seu quarto (reservado, não repasse): ${url}`)}`}>WhatsApp</a>
                <Botao v="sec" onClick={gerarLink} className="!min-h-11">Gerar novo</Botao>
                <Botao v="sec" onClick={desligarLink} className="!min-h-11 !text-alerta">Desligar</Botao>
              </div>
            </>
          ) : <Botao v="suave" onClick={gerarLink} className="!min-h-11">Gerar link do quarto</Botao>}
        </div>
        <AnjosCampo valores={anjosSel} onChange={trocarAnjos} servos={servos} usadosFora={new Set(Array.from(anjosUsados).filter((id) => !anjosAtuais.includes(id)))} />
        {ocupantes.length === 0 && <Vazio>Ninguém neste quarto.</Vazio>}
        {ocupantes.map((n) => (
          <div key={n.id} className="flex items-center justify-between rounded-2xl border border-borda px-3 py-2"><span>{n.nome}</span><button type="button" onClick={() => tirar(n)} className="min-h-10 px-2 text-sm font-bold text-alerta">Tirar</button></div>
        ))}
        {!lotado && (
          <>
            <b className="text-sm">Adicionar quem está sem quarto</b>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome" className="min-h-11 rounded-2xl border border-borda px-3 outline-none" />
            {cand.map((n) => <button key={n.id} type="button" onClick={() => add(n)} className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-borda bg-white px-3 text-left"><span className="truncate">{n.nome}</span><span className="shrink-0 text-xs text-suave">{n.sexo ?? ""}</span></button>)}
          </>
        )}
        {!del ? <Botao v="sec" bloco className="!text-alerta" onClick={() => setDel(true)}>Excluir quarto</Botao> : <Botao v="perigo" bloco onClick={excluir}>Confirmar exclusão</Botao>}
      </div>
    </Janela>
  );
}
