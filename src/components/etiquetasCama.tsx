"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { temaDe } from "@/lib/cores";
import { baixarBlob, nomeArq } from "@/lib/estoquePdf";
import { CFG_PADRAO, MODELOS, PAPEL, conferir, desenhar, medirTela, montar, pdfEtiquetas, porPagina, posicoes, ptParaMm, type Cfg } from "@/lib/etiquetas";
import { useAviso, useEdicao } from "@/components/provedores";
import { Botao, Campo, Carregando, Cartao, Chip, Vazio, cx } from "@/components/ui";

type Quarto = { id: string; nome: string; sexo: string; capacidade: number };
type Nome = { id: string; nome: string; categoria: string | null };
const SEM = "__sem";
const CHAVE = "vv-etiquetas-cfg";

/** Etiquetas de cama: uma por encontrista, só com o nome, em folha adesiva com medidas ajustáveis. */
export function EtiquetasCama() {
  const { ed } = useEdicao();
  const aviso = useAviso();
  const [quartos, setQuartos] = useState<Quarto[] | null>(null);
  const [donos, setDonos] = useState<Map<string, string[]>>(new Map()); // quarto -> nomes de quem dorme
  const [semQuarto, setSemQuarto] = useState<string[]>([]);
  const [escolhidos, setEscolhidos] = useState<Set<string> | null>(null); // null = todos
  const [cfg, setCfg] = useState<Cfg>(CFG_PADRAO);
  const [modelo, setModelo] = useState("l7160");
  const [inicio, setInicio] = useState(1);
  const [pg, setPg] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [ativo, setAtivo] = useState<keyof Cfg | null>(null);
  const [arrastando, setArrastando] = useState<keyof Cfg | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => { try { const s = localStorage.getItem(CHAVE); if (s) { const o = JSON.parse(s) as { cfg?: Cfg; modelo?: string }; if (o.cfg) setCfg({ ...CFG_PADRAO, ...o.cfg }); if (o.modelo) setModelo(o.modelo); } } catch {} }, []);
  const muda = (c: Cfg, m = "personalizado") => { setCfg(c); setModelo(m); setPg(0); try { localStorage.setItem(CHAVE, JSON.stringify({ cfg: c, modelo: m })); } catch {} };

  useEffect(() => {
    if (!ed) return;
    let vivo = true;
    (async () => {
      const q = await supabase.from("quartos").select("id,nome,sexo,capacidade").eq("edicao_id", ed.id).order("nome");
      if (q.error) { aviso(msgErro(q.error)); if (vivo) setQuartos([]); return; }
      const lista = (q.data as Quarto[]) ?? [];
      const ids = lista.map((x) => x.id);
      const m = new Map<string, string[]>();
      if (ids.length) {
        const [oc, nm] = await Promise.all([supabase.from("quarto_ocupantes").select("encontrista_id,quarto_id").in("quarto_id", ids), supabase.rpc("nomes_edicao", { p_edicao: ed.id })]);
        const todos = ((nm.data as Nome[]) ?? []).filter((n) => (n.categoria ?? "").trim() === "Encontrista" || !n.categoria);
        const nomes = new Map(todos.map((n) => [n.id, n.nome]));
        const alocados = new Set(((oc.data as { encontrista_id: string }[]) ?? []).map((o) => o.encontrista_id));
        if (vivo) setSemQuarto(todos.filter((n) => !alocados.has(n.id)).map((n) => n.nome));
        ((oc.data as { encontrista_id: string; quarto_id: string }[]) ?? []).forEach((o) => { const n = nomes.get(o.encontrista_id); if (n) m.set(o.quarto_id, [...(m.get(o.quarto_id) ?? []), n]); });
        m.forEach((v, k) => m.set(k, v.sort((a, b) => a.localeCompare(b, "pt-BR"))));
      }
      if (vivo) { setDonos(m); setQuartos(lista); setEscolhidos(null); }
    })();
    return () => { vivo = false; };
  }, [ed, aviso]);

  const cor = temaDe(ed).marca;
  const sel = useMemo(() => (quartos ?? []).filter((q) => !escolhidos || escolhidos.has(q.id)), [quartos, escolhidos]);
  const incluiSem = !!escolhidos?.has(SEM) || escolhidos === null;
  const etqs = useMemo(() => montar([...sel.flatMap((q) => donos.get(q.id) ?? []), ...(incluiSem ? semQuarto : [])]), [sel, donos, incluiSem, semQuarto]);
  const n = porPagina(cfg);
  const ini = Math.max(1, Math.min(n, Math.floor(inicio) || 1));
  const paginas = Math.max(1, Math.ceil((etqs.length + ini - 1) / n));
  const erro = conferir(cfg);
  const medir = useMemo(() => medirTela(), []);
  const pp = PAPEL[cfg.papel];
  const pagina = Math.min(pg, paginas - 1);
  const slots = posicoes(cfg);

  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!quartos) return <Carregando />;
  if (quartos.length === 0 && semQuarto.length === 0) return <Vazio>Importe os encontristas e crie os quartos primeiro. Cada encontrista vira uma etiqueta com o nome.</Vazio>;

  const ajusta = (k: keyof Cfg, v: number) => muda({ ...cfg, [k]: Math.round(v * 100) / 100 });
  const rAlca = 9 / ((440 * zoom) / pp.w); // alça com ~9 px na tela, qualquer que seja o zoom
  const x0 = cfg.esq + cfg.ajusteX, y0 = cfg.topo + cfg.ajusteY;
  const c2 = Math.floor(cfg.colunas) >= 2, l2 = Math.floor(cfg.linhas) >= 2;
  const alcas: { k: keyof Cfg; eixo: "x" | "y"; x: number; y: number; cor: string }[] = [
    { k: "esq", eixo: "x", x: x0, y: y0 + cfg.alt / 2, cor: "#c78f00" },
    { k: "topo", eixo: "y", x: x0 + cfg.larg / 2, y: y0, cor: "#1f6feb" },
    { k: "larg", eixo: "x", x: x0 + cfg.larg, y: y0 + cfg.alt * 0.25, cor: "#e8590c" },
    { k: "alt", eixo: "y", x: x0 + cfg.larg * 0.25, y: y0 + cfg.alt, cor: "#d62828" },
    ...(c2 ? [{ k: "espCol" as const, eixo: "x" as const, x: x0 + cfg.larg + cfg.espCol, y: y0 + cfg.alt * 0.75, cor: "#2f9e44" }] : []),
    ...(l2 ? [{ k: "espLin" as const, eixo: "y" as const, x: x0 + cfg.larg * 0.75, y: y0 + cfg.alt + cfg.espLin, cor: "#7c4dcc" }] : []),
  ];
  function comecar(e: React.PointerEvent, k: keyof Cfg) { e.preventDefault(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setArrastando(k); setAtivo(k); }
  function mover(e: React.PointerEvent) {
    if (!arrastando || !svgRef.current) return;
    const m = svgRef.current.getScreenCTM(); if (!m) return;
    const pt = svgRef.current.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(m.inverse());
    const v: Partial<Record<keyof Cfg, number>> = { esq: q.x - cfg.ajusteX, topo: q.y - cfg.ajusteY, larg: q.x - x0, alt: q.y - y0, espCol: q.x - x0 - cfg.larg, espLin: q.y - y0 - cfg.alt };
    const novo = v[arrastando];
    if (novo === undefined) return;
    const min = arrastando === "larg" ? 10 : arrastando === "alt" ? 5 : 0;
    ajusta(arrastando, Math.max(min, Math.round(novo * 10) / 10));
  }
  function soltar() { setArrastando(null); setAtivo(null); }
  const alternar = (id: string) => { const s = new Set(escolhidos ?? [...quartos.map((q) => q.id), SEM]); if (s.has(id)) s.delete(id); else s.add(id); setEscolhidos(s.size === quartos.length + 1 ? null : s); setPg(0); };

  async function gerar(teste: boolean) {
    if (erro) { aviso(erro); return; }
    if (!teste && etqs.length === 0) { aviso("Escolha ao menos um quarto."); return; }
    setGerando(true);
    try { baixarBlob(await pdfEtiquetas(cfg, etqs, cor, ini, teste), `${teste ? "Teste_alinhamento_etiquetas" : "Etiquetas_cama_" + nomeArq(ed!.nome)}.pdf`); aviso(teste ? "PDF de teste gerado. Imprima em papel comum e coloque sobre a folha de etiquetas contra a luz." : "PDF das etiquetas gerado."); }
    catch { aviso("Não consegui gerar o PDF agora."); }
    setGerando(false);
  }

  const vazias = pagina === 0 ? ini - 1 : 0;
  const daPagina = (i: number) => { const k = pagina * n + i - (ini - 1); return k >= 0 ? etqs[k] : undefined; };

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-suave">Uma etiqueta para cada encontrista, só com o nome abreviado (primeiro nome, iniciais no meio e o último sobrenome inteiro, tudo em uma linha). Escolha os quartos que quer imprimir, o modelo da sua folha adesiva ou ajuste as medidas à mão — cada marca usa uma medida diferente, então confira na embalagem.</p>

      <Cartao className="flex flex-col gap-3 p-4">
        <b>{etqs.length} {etqs.length === 1 ? "etiqueta" : "etiquetas"}</b>
        <div className="flex flex-wrap gap-2">
          {quartos.map((q) => <Chip key={q.id} ativo={!escolhidos || escolhidos.has(q.id)} onClick={() => alternar(q.id)}>{q.nome} · {(donos.get(q.id) ?? []).length}</Chip>)}
          {semQuarto.length > 0 && <Chip ativo={incluiSem} onClick={() => alternar(SEM)}>Sem quarto · {semQuarto.length}</Chip>}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#16294d]" checked={cfg.faixa} onChange={(e) => muda({ ...cfg, faixa: e.target.checked }, modelo)} />Faixa na lateral, na cor da edição</label>
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-4 p-4">
        <b>Folha de etiquetas</b>
        <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-suave">Modelo da folha</span>
          <select value={modelo} onChange={(e) => { const m = MODELOS.find((x) => x.id === e.target.value); if (m) muda({ ...cfg, ...m.c, papel: m.papel }, m.id); else setModelo("personalizado"); }} className="min-h-12 rounded-2xl border border-borda bg-white px-3 outline-none focus:border-marca">
            {MODELOS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            <option value="personalizado">Personalizado (medidas ajustadas à mão)</option>
          </select>
        </label>
        {erro && <p className="m-0 rounded-xl bg-alerta-clara px-3 py-2 text-sm font-bold text-[#8e2e18]">{erro}</p>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
            <p className="m-0 text-sm text-suave">Mexa nos controles ou <b>arraste as bolinhas coloridas direto na folha</b>. A parte que você está ajustando fica destacada em azul.</p>
            <div className="flex gap-2"><Chip ativo={cfg.papel === "a4"} onClick={() => muda({ ...cfg, papel: "a4" })}>Folha A4</Chip><Chip ativo={cfg.papel === "carta"} onClick={() => muda({ ...cfg, papel: "carta" })}>Folha Carta</Chip></div>
            <div className="grid grid-cols-2 gap-3">
              <Medida k="colunas" rotulo="Colunas" min={1} max={10} passo={1} un="" v={cfg.colunas} onV={ajusta} onAtivo={setAtivo} />
              <Medida k="linhas" rotulo="Linhas" min={1} max={30} passo={1} un="" v={cfg.linhas} onV={ajusta} onAtivo={setAtivo} />
            </div>
            <Medida k="larg" rotulo="Largura da etiqueta" min={10} max={PAPEL[cfg.papel].w} v={cfg.larg} onV={ajusta} onAtivo={setAtivo} cor="#e8590c" />
            <Medida k="alt" rotulo="Altura da etiqueta (altura das linhas)" min={5} max={150} v={cfg.alt} onV={ajusta} onAtivo={setAtivo} cor="#d62828" />
            <Medida k="espCol" rotulo="Distância entre colunas" min={0} max={25} v={cfg.espCol} onV={ajusta} onAtivo={setAtivo} cor="#2f9e44" />
            <Medida k="espLin" rotulo="Distância entre linhas" min={0} max={25} v={cfg.espLin} onV={ajusta} onAtivo={setAtivo} cor="#7c4dcc" />
            <Medida k="topo" rotulo="Margem de cima" min={0} max={80} v={cfg.topo} onV={ajusta} onAtivo={setAtivo} cor="#1f6feb" />
            <Medida k="esq" rotulo="Margem da esquerda" min={0} max={80} v={cfg.esq} onV={ajusta} onAtivo={setAtivo} cor="#c78f00" />
            <details className="rounded-2xl border border-borda px-3 py-2">
              <summary className="cursor-pointer text-sm font-extrabold">Ajuste fino da impressora e textos</summary>
              <div className="mt-3 flex flex-col gap-3">
                <Medida k="ajusteX" rotulo="Deslocar tudo → direita (− esquerda)" min={-8} max={8} v={cfg.ajusteX} onV={ajusta} onAtivo={setAtivo} />
                <Medida k="ajusteY" rotulo="Deslocar tudo ↓ para baixo (− para cima)" min={-8} max={8} v={cfg.ajusteY} onV={ajusta} onAtivo={setAtivo} />
                <Medida k="fonte" rotulo="Tamanho dos textos" min={40} max={200} passo={5} un="%" v={cfg.fonte} onV={ajusta} onAtivo={setAtivo} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#16294d]" checked={cfg.borda} onChange={(e) => muda({ ...cfg, borda: e.target.checked }, modelo)} />Imprimir o contorno de cada etiqueta (folha comum, para recortar)</label>
              </div>
            </details>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-44"><Campo rotulo="Começar na etiqueta nº" type="number" min={1} max={n} value={ini} onChange={(e) => { setInicio(e.target.valueAsNumber || 1); setPg(0); }} /></div>
              <Botao v="sec" className="!min-h-12" onClick={() => muda({ ...CFG_PADRAO, papel: "a4" }, "l7160")}>Voltar ao modelo padrão</Botao>
            </div>
          </div>

          <div className="order-1 flex min-w-0 flex-col gap-2 lg:order-2 lg:sticky lg:top-3 lg:self-start">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>Prévia · folha {pagina + 1} de {paginas}</b>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3].map((z) => <Chip key={z} ativo={zoom === z} onClick={() => setZoom(z)}>{z}×</Chip>)}
                <Chip onClick={() => setPg(Math.max(0, pagina - 1))} disabled={pagina === 0}>‹</Chip><Chip onClick={() => setPg(Math.min(paginas - 1, pagina + 1))} disabled={pagina >= paginas - 1}>›</Chip>
              </div>
            </div>
            <div className="max-h-[78dvh] overflow-auto rounded-lg border border-borda bg-[#f1f1ef] p-1">
              <svg ref={svgRef} viewBox={`0 0 ${pp.w} ${pp.h}`} role="img" aria-label="Prévia da folha de etiquetas" style={{ width: `${zoom * 100}%`, touchAction: arrastando ? "none" : "auto" }} className="block bg-white shadow-sm"
                onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
                {/* realce da parte em ajuste */}
                {ativo === "topo" && <rect x={0} y={0} width={pp.w} height={slots[0].y} fill="#1f6feb" opacity={0.18} />}
                {ativo === "esq" && <rect x={0} y={0} width={slots[0].x} height={pp.h} fill="#c78f00" opacity={0.2} />}
                {(ativo === "ajusteX" || ativo === "ajusteY") && <rect x={slots[0].x} y={slots[0].y} width={slots[slots.length - 1].x + cfg.larg - slots[0].x} height={slots[slots.length - 1].y + cfg.alt - slots[0].y} fill="#1f6feb" opacity={0.1} />}
                {ativo === "espCol" && slots.filter((_, i) => i % Math.floor(cfg.colunas) < Math.floor(cfg.colunas) - 1).map((r, i) => <rect key={"c" + i} x={r.x + r.w} y={r.y} width={cfg.espCol} height={r.h} fill="#2f9e44" opacity={0.55} />)}
                {ativo === "espLin" && slots.slice(0, slots.length - Math.floor(cfg.colunas)).map((r, i) => <rect key={"l" + i} x={r.x} y={r.y + r.h} width={r.w} height={cfg.espLin} fill="#7c4dcc" opacity={0.55} />)}
                {(ativo === "larg" || ativo === "alt") && slots.map((r, i) => <rect key={"t" + i} x={r.x} y={r.y} width={r.w} height={r.h} fill={ativo === "larg" ? "#e8590c" : "#d62828"} opacity={0.1} />)}
                {slots.map((r, i) => {
                  const e = daPagina(i);
                  const usada = i < vazias;
                  return (
                    <g key={i}>
                      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={usada ? "#eeeeee" : "none"} stroke="#9aa0a6" strokeWidth={0.25} strokeDasharray={cfg.borda ? undefined : "1.2 1"} />
                      {e && desenhar(r, e, cfg, cor, medir).map((f, k) => f.t === "ret" ? <rect key={k} x={f.x} y={f.y} width={f.w} height={f.h} fill={f.cor} />
                        : f.t === "linha" ? <line key={k} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.cor} strokeWidth={0.25} />
                        : <text key={k} x={f.x} y={f.y} fontSize={ptParaMm(f.pt)} fontWeight={f.negrito ? 700 : 400} fill={f.cor} textAnchor={f.centro ? "middle" : "start"} fontFamily="Helvetica, Arial, sans-serif">{f.texto}</text>)}
                    </g>
                  );
                })}
                {/* alças arrastáveis */}
                {alcas.map((a) => (
                  <g key={a.k} style={{ cursor: a.eixo === "x" ? "ew-resize" : "ns-resize", touchAction: "none" }} onPointerDown={(e) => comecar(e, a.k)}>
                    <circle cx={a.x} cy={a.y} r={rAlca * 2} fill="transparent" />
                    <circle cx={a.x} cy={a.y} r={rAlca} fill={a.cor} stroke="#fff" strokeWidth={rAlca * 0.25} opacity={ativo === a.k ? 1 : 0.85} />
                    {ativo === a.k && <text x={a.x + (a.eixo === "x" ? 0 : rAlca * 2)} y={a.y + (a.eixo === "x" ? -rAlca * 1.8 : rAlca * 0.4)} fontSize={rAlca * 2.2} fontWeight={700} fill={a.cor} textAnchor={a.eixo === "x" ? "middle" : "start"} stroke="#fff" strokeWidth={rAlca * 0.5} paintOrder="stroke">{Number(cfg[a.k]).toFixed(1)} mm</text>}
                  </g>
                ))}
              </svg>
            </div>
            <p className="m-0 text-center text-xs text-suave">{n} etiquetas por folha · {cfg.larg} × {cfg.alt} mm · tracejado = limite da etiqueta (não sai impresso)</p>
          </div>
        </div>
      </Cartao>

      <div className={cx("flex flex-wrap gap-2")}>
        <Botao onClick={() => gerar(false)} disabled={gerando || !!erro} className="!min-h-12">{gerando ? "Gerando…" : "Gerar PDF das etiquetas"}</Botao>
        <Botao v="sec" onClick={() => gerar(true)} disabled={gerando || !!erro} className="!min-h-12">Imprimir teste de alinhamento</Botao>
      </div>
      <p className="m-0 text-xs text-suave">Dica: imprima o teste em papel comum, ponha sobre a folha de etiquetas contra a luz e, se estiver torto, corrija com o “Ajuste fino”. No diálogo de impressão use tamanho real (100%), sem “ajustar à página”.</p>
    </div>
  );
}

/** Uma medida: rótulo, botões − e +, campo numérico e controle deslizante. */
function Medida({ k, rotulo, v, min, max, passo = 0.1, un = "mm", cor, onV, onAtivo }: { k: keyof Cfg; rotulo: string; v: number; min: number; max: number; passo?: number; un?: string; cor?: string; onV: (k: keyof Cfg, v: number) => void; onAtivo: (k: keyof Cfg | null) => void }) {
  const val = (n: number) => onV(k, Math.min(max, Math.max(min, Math.round(n * 100) / 100)));
  const botao = "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-borda bg-white text-xl font-extrabold active:bg-fundo";
  return (
    <div className="flex flex-col gap-1.5" onFocus={() => onAtivo(k)} onBlur={() => onAtivo(null)} onPointerDown={() => onAtivo(k)} onPointerUp={() => onAtivo(null)}>
      <span className="flex items-center gap-2 text-[13px] font-bold text-suave">{cor && <i className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />}{rotulo}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Diminuir ${rotulo}`} className={botao} onClick={() => val(v - passo)}>−</button>
        <label className="relative flex-1"><input type="number" step={passo} inputMode="decimal" value={Number.isFinite(v) ? v : 0} onChange={(e) => val(Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0)} className="min-h-11 w-full rounded-xl border border-borda bg-white px-3 pr-10 text-center font-bold outline-none focus:border-marca" />{un && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-suave">{un}</span>}</label>
        <button type="button" aria-label={`Aumentar ${rotulo}`} className={botao} onClick={() => val(v + passo)}>+</button>
      </div>
      <input type="range" aria-label={rotulo} min={min} max={max} step={passo} value={v} onChange={(e) => val(e.target.valueAsNumber)} className="w-full accent-[#16294d]" style={{ touchAction: "pan-y" }} />
    </div>
  );
}
