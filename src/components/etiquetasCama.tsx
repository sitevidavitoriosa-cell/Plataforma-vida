"use client";
import { useEffect, useMemo, useState } from "react";
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
  const [ajustando, setAjustando] = useState(false);
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

  const num = (k: keyof Cfg, rotulo: string, passo = 0.1, dica?: string) => (
    <Campo rotulo={rotulo} dica={dica} type="number" step={passo} inputMode="decimal" value={Number(cfg[k])} onChange={(e) => muda({ ...cfg, [k]: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0 })} />
  );
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

      <Cartao className="flex flex-col gap-3 p-4">
        <b>Folha de etiquetas</b>
        <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-suave">Modelo</span>
          <select value={modelo} onChange={(e) => { const m = MODELOS.find((x) => x.id === e.target.value); if (m) muda({ ...cfg, ...m.c, papel: m.papel }, m.id); else setModelo("personalizado"); }} className="min-h-12 rounded-2xl border border-borda bg-white px-3 outline-none focus:border-marca">
            {MODELOS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            <option value="personalizado">Personalizado (medidas ajustadas à mão)</option>
          </select>
        </label>
        <button type="button" onClick={() => setAjustando((a) => !a)} className="self-start text-sm font-extrabold text-marca">{ajustando ? "Esconder medidas" : "Ajustar medidas (altura das linhas, distância das colunas…)"}</button>
        {ajustando && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2"><Chip ativo={cfg.papel === "a4"} onClick={() => muda({ ...cfg, papel: "a4" })}>Folha A4</Chip><Chip ativo={cfg.papel === "carta"} onClick={() => muda({ ...cfg, papel: "carta" })}>Folha Carta</Chip></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {num("colunas", "Colunas", 1)}{num("linhas", "Linhas", 1)}
              {num("larg", "Largura da etiqueta (mm)")}{num("alt", "Altura da etiqueta (mm)")}
              {num("espCol", "Distância entre colunas (mm)")}{num("espLin", "Distância entre linhas (mm)")}
              {num("topo", "Margem de cima (mm)")}{num("esq", "Margem da esquerda (mm)")}
              {num("ajusteX", "Ajuste fino → direita (mm)", 0.1, "Negativo = esquerda")}{num("ajusteY", "Ajuste fino ↓ para baixo (mm)", 0.1, "Negativo = para cima")}
              {num("fonte", "Tamanho dos textos (%)", 5)}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#16294d]" checked={cfg.borda} onChange={(e) => muda({ ...cfg, borda: e.target.checked }, modelo)} />Imprimir o contorno de cada etiqueta (para folha comum que será recortada)</label>
            <Botao v="sec" className="!min-h-11 self-start" onClick={() => muda({ ...CFG_PADRAO, papel: "a4" }, "l7160")}>Voltar às medidas do modelo padrão</Botao>
          </div>
        )}
        {erro && <p className="m-0 rounded-xl bg-alerta-clara px-3 py-2 text-sm font-bold text-[#8e2e18]">{erro}</p>}
        <div className="grid grid-cols-2 gap-3 md:max-w-sm">
          <Campo rotulo="Começar na etiqueta nº" dica="Para aproveitar folha já usada" type="number" min={1} max={n} value={ini} onChange={(e) => { setInicio(e.target.valueAsNumber || 1); setPg(0); }} />
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b>Prévia · folha {pagina + 1} de {paginas}</b>
          <div className="flex gap-2"><Chip onClick={() => setPg(Math.max(0, pagina - 1))} disabled={pagina === 0}>‹</Chip><Chip onClick={() => setPg(Math.min(paginas - 1, pagina + 1))} disabled={pagina >= paginas - 1}>›</Chip></div>
        </div>
        <svg viewBox={`0 0 ${pp.w} ${pp.h}`} role="img" aria-label="Prévia da folha de etiquetas" className="mx-auto w-full max-w-[460px] rounded-lg border border-borda bg-white shadow-sm">
          {slots.map((r, i) => {
            const e = daPagina(i);
            const usada = i < vazias;
            return (
              <g key={i}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={usada ? "#eeeeee" : "none"} stroke="#c9c9c9" strokeWidth={0.25} strokeDasharray={cfg.borda ? undefined : "1.2 1"} />
                {e && desenhar(r, e, cfg, cor, medir).map((f, k) => f.t === "ret" ? <rect key={k} x={f.x} y={f.y} width={f.w} height={f.h} fill={f.cor} />
                  : f.t === "linha" ? <line key={k} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.cor} strokeWidth={0.25} />
                  : <text key={k} x={f.x} y={f.y} fontSize={ptParaMm(f.pt)} fontWeight={f.negrito ? 700 : 400} fill={f.cor} textAnchor={f.centro ? "middle" : "start"} fontFamily="Helvetica, Arial, sans-serif">{f.texto}</text>)}
              </g>
            );
          })}
        </svg>
        <p className="m-0 text-center text-xs text-suave">{n} etiquetas por folha · {cfg.larg} × {cfg.alt} mm · tracejado = limite da etiqueta (não sai impresso)</p>
      </Cartao>

      <div className={cx("flex flex-wrap gap-2")}>
        <Botao onClick={() => gerar(false)} disabled={gerando || !!erro} className="!min-h-12">{gerando ? "Gerando…" : "Gerar PDF das etiquetas"}</Botao>
        <Botao v="sec" onClick={() => gerar(true)} disabled={gerando || !!erro} className="!min-h-12">Imprimir teste de alinhamento</Botao>
      </div>
      <p className="m-0 text-xs text-suave">Dica: imprima o teste em papel comum, ponha sobre a folha de etiquetas contra a luz e, se estiver torto, corrija com o “Ajuste fino”. No diálogo de impressão use tamanho real (100%), sem “ajustar à página”.</p>
    </div>
  );
}
