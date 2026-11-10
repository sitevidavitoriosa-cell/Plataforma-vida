"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { norm } from "@/lib/tipos";
import { podeEscrever } from "@/lib/perm";
import { useAuth, useAviso } from "@/components/provedores";
import { baixarArquivo, baixarZip, BUCKET, COR_TIPO, dataBr, extDe, LIMITE, podeImprimir, seguro, tam, tipoDe, type Arq, type NoZip, type Pasta } from "@/lib/drive";
import { Compartilhar, urlLink, validade, type LinkOrg } from "@/components/compartilharDrive";
import { Previa } from "@/components/previa";
import { Botao, Campo, Carregando, Chip, Icone, Janela, Titulo, Vazio } from "@/components/ui";

type Vista = "drive" | "recentes" | "favoritos" | "compartilhados" | "lixeira";
type Item = { k: "p" | "a"; id: string; nome: string; data: string; tam: number; sub: string; pasta?: Pasta; arq?: Arq };
type Fav = { tipo: "pasta" | "arquivo"; item_id: string };
const chave = (i: { k: string; id: string }) => `${i.k}:${i.id}`;
const tipoFav = (k: "p" | "a") => (k === "p" ? "pasta" : "arquivo");
const MIME = "text/vv-org";

/** Organizacional = o drive do Vida Vitoriosa: pastas e subpastas, arquivos com pré-visualização, baixar, imprimir, compartilhar por link, lixeira e favoritos. */
export default function Organizacional() {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const pastasQ = useLista<Pasta>("org_areas", "*", "nome");
  const arqsQ = useLista<Arq>("org_arquivos", "*", "criado_em");
  const favsQ = useLista<Fav>("org_favoritos", "*");
  const linksQ = useLista<LinkOrg>("org_links", "*", "criado_em");
  const pode = podeEscrever(acesso, "organizacional");

  const [vista, setVista] = useState<Vista>("drive");
  const [cur, setCur] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<Item | null>(null);
  const [prev, setPrev] = useState<Arq | null>(null);
  const [partilha, setPartilha] = useState<{ tipo: "pasta" | "arquivo"; id: string; nome: string } | null>(null);
  const [mover, setMover] = useState<Item[] | null>(null);
  const [destino, setDestino] = useState<string | null | undefined>(undefined);
  const [novaPasta, setNovaPasta] = useState(false);
  const [renomear, setRenomear] = useState<Item | null>(null);
  const [nome, setNome] = useState("");
  const [confirma, setConfirma] = useState<{ itens: Item[]; todos?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [modo, setModo] = useState<"lista" | "grade">("lista");
  const [ordem, setOrdem] = useState<"nome" | "data" | "tam">("nome");
  const [toque, setToque] = useState(false);
  const arquivosRef = useRef<HTMLInputElement>(null);
  const pastaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const v = localStorage.getItem("vv-org-modo"); if (v === "grade" || v === "lista") setModo(v); } catch {}
    setToque(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  const trocarModo = (m: "lista" | "grade") => { setModo(m); try { localStorage.setItem("vv-org-modo", m); } catch {} };

  const pastas = pastasQ.dados, arqs = arqsQ.dados;
  const mapa = useMemo(() => new Map((pastas ?? []).map((p) => [p.id, p])), [pastas]);
  const ativaMemo = useMemo(() => {
    const m = new Map<string, boolean>();
    const f = (id: string | null): boolean => {
      if (!id) return true;
      if (m.has(id)) return m.get(id)!;
      const p = mapa.get(id);
      const r = !!p && !p.apagado_em && f(p.pai_id);
      m.set(id, r); return r;
    };
    return f;
  }, [mapa]);
  const pastasAtivas = useMemo(() => (pastas ?? []).filter((p) => ativaMemo(p.id)), [pastas, ativaMemo]);
  const arqsAtivos = useMemo(() => (arqs ?? []).filter((a) => !a.apagado_em && ativaMemo(a.area_id)), [arqs, ativaMemo]);
  const arqMap = useMemo(() => new Map((arqs ?? []).map((a) => [a.id, a])), [arqs]);
  const favSet = useMemo(() => new Set((favsQ.dados ?? []).map((f) => `${f.tipo}:${f.item_id}`)), [favsQ.dados]);
  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    pastasAtivas.forEach((p) => p.pai_id && m.set(p.pai_id, (m.get(p.pai_id) ?? 0) + 1));
    arqsAtivos.forEach((a) => m.set(a.area_id, (m.get(a.area_id) ?? 0) + 1));
    return m;
  }, [pastasAtivas, arqsAtivos]);

  const trilha = useCallback((id: string | null): Pasta[] => {
    const r: Pasta[] = []; let p = id ? mapa.get(id) : undefined;
    while (p) { r.unshift(p); p = p.pai_id ? mapa.get(p.pai_id) : undefined; }
    return r;
  }, [mapa]);
  const caminhoTxt = useCallback((id: string | null) => trilha(id).map((p) => p.nome).join(" › "), [trilha]);
  const descendentes = useCallback((id: string) => {
    const r = new Set<string>([id]); let mudou = true;
    while (mudou) { mudou = false; (pastas ?? []).forEach((p) => { if (p.pai_id && r.has(p.pai_id) && !r.has(p.id)) { r.add(p.id); mudou = true; } }); }
    return r;
  }, [pastas]);

  const itemPasta = useCallback((p: Pasta): Item => { const n = contagem.get(p.id) ?? 0; return { k: "p", id: p.id, nome: p.nome, data: p.criado_em, tam: 0, sub: `${n} ${n === 1 ? "item" : "itens"}`, pasta: p }; }, [contagem]);
  const itemArq = (a: Arq): Item => ({ k: "a", id: a.id, nome: a.nome, data: a.criado_em, tam: a.tamanho, sub: `${tam(a.tamanho)} · ${dataBr(a.criado_em)}`, arq: a });
  const ordenar = useCallback((l: Item[]) => l.slice().sort((x, y) => {
    if (x.k !== y.k) return x.k === "p" ? -1 : 1;
    if (ordem === "data") return y.data.localeCompare(x.data);
    if (ordem === "tam" && x.k === "a") return y.tam - x.tam;
    return x.nome.localeCompare(y.nome, "pt-BR", { numeric: true });
  }), [ordem]);

  const nq = norm(q);
  const itens: Item[] = useMemo(() => {
    if (!pastas || !arqs) return [];
    if (vista === "drive") {
      if (nq) return ordenar([...pastasAtivas.filter((p) => norm(p.nome).includes(nq)).map(itemPasta), ...arqsAtivos.filter((a) => norm(a.nome).includes(nq)).map(itemArq)]);
      return ordenar([...pastasAtivas.filter((p) => p.pai_id === cur).map(itemPasta), ...arqsAtivos.filter((a) => a.area_id === cur).map(itemArq)]);
    }
    let l: Item[] = [];
    if (vista === "recentes") l = arqsAtivos.slice().sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, 40).map(itemArq);
    if (vista === "favoritos") l = [...pastasAtivas.filter((p) => favSet.has("pasta:" + p.id)).map(itemPasta), ...arqsAtivos.filter((a) => favSet.has("arquivo:" + a.id)).map(itemArq)];
    if (vista === "lixeira") l = [...pastas.filter((p) => p.apagado_em && ativaMemo(p.pai_id)).map(itemPasta), ...arqs.filter((a) => a.apagado_em && ativaMemo(a.area_id)).map(itemArq)];
    if (nq) l = l.filter((i) => norm(i.nome).includes(nq));
    return vista === "recentes" ? l : ordenar(l);
  }, [pastas, arqs, vista, cur, nq, pastasAtivas, arqsAtivos, favSet, ativaMemo, ordenar, itemPasta]);
  const porChave = useMemo(() => new Map(itens.map((i) => [chave(i), i])), [itens]);
  const listaPrev = useMemo(() => itens.filter((i) => i.arq).map((i) => i.arq!), [itens]);

  if (!pastas || !arqs) return <Carregando />;

  const recarregar = () => { pastasQ.recarregar(); arqsQ.recarregar(); favsQ.recarregar(); linksQ.recarregar(); };
  const limparSel = () => setSel(new Set());
  const irPara = (v: Vista, pasta: string | null = null) => { setVista(v); setCur(pasta); setQ(""); limparSel(); };
  const abrir = (i: Item) => { if (vista === "lixeira") { setMenu(null); return; } if (i.pasta) { setVista("drive"); setCur(i.id); setQ(""); limparSel(); } else if (i.arq) setPrev(i.arq); };
  const alternarSel = (i: Item) => setSel((s) => { const n = new Set(s); const c = chave(i); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const selecionados = () => Array.from(sel).map((c) => porChave.get(c)).filter(Boolean) as Item[];

  const erroNome = (e: { code?: string; message: string }) => (e.code === "23505" ? "Já existe uma pasta com esse nome aqui." : e.message.includes("pasta_em_si_mesma") ? "Não dá para colocar uma pasta dentro dela mesma." : msgErro(e));

  async function criarPasta() {
    const n = nome.trim();
    if (!n) { aviso("Digite o nome da pasta."); return; }
    const { error } = await supabase.from("org_areas").insert({ nome: n, pai_id: cur });
    if (error) { aviso(erroNome(error)); return; }
    setNovaPasta(false); setNome(""); recarregar(); aviso("Pasta criada.");
  }
  async function salvarNome() {
    const n = nome.trim();
    if (!renomear || !n) return;
    const r = renomear.pasta ? await supabase.from("org_areas").update({ nome: n }).eq("id", renomear.id) : await supabase.from("org_arquivos").update({ nome: n, atualizado_em: new Date().toISOString() }).eq("id", renomear.id);
    if (r.error) { aviso(erroNome(r.error)); return; }
    setRenomear(null); recarregar(); aviso("Nome alterado.");
  }
  async function paraLixeira(its: Item[]) {
    if (!its.length) return;
    const agora = new Date().toISOString();
    const ps = its.filter((i) => i.pasta).map((i) => i.id), as = its.filter((i) => i.arq).map((i) => i.id);
    if (ps.length) { const { error } = await supabase.from("org_areas").update({ apagado_em: agora }).in("id", ps); if (error) { aviso(msgErro(error)); return; } }
    if (as.length) { const { error } = await supabase.from("org_arquivos").update({ apagado_em: agora }).in("id", as); if (error) { aviso(msgErro(error)); return; } }
    setMenu(null); limparSel(); recarregar(); aviso(its.length === 1 ? "Enviado para a lixeira." : `${its.length} itens enviados para a lixeira.`);
  }
  async function restaurar(its: Item[]) {
    for (const i of its) {
      const r = i.pasta ? await supabase.from("org_areas").update({ apagado_em: null }).eq("id", i.id) : await supabase.from("org_arquivos").update({ apagado_em: null }).eq("id", i.id);
      if (r.error) { aviso(r.error.code === "23505" ? `Já existe uma pasta chamada “${i.nome}” no mesmo lugar. Renomeie uma delas.` : msgErro(r.error)); recarregar(); return; }
    }
    limparSel(); recarregar(); aviso("Restaurado.");
  }
  async function apagarDeVez(its: Item[]) {
    setOcupado("Apagando…");
    const topo = new Set<string>(), pastaIds = new Set<string>(), arqIds = new Set<string>();
    its.forEach((i) => { if (i.pasta) { topo.add(i.id); descendentes(i.id).forEach((d) => pastaIds.add(d)); } else arqIds.add(i.id); });
    const caminhos = (arqs ?? []).filter((a) => arqIds.has(a.id) || pastaIds.has(a.area_id)).map((a) => a.caminho);
    for (let n = 0; n < caminhos.length; n += 100) await supabase.storage.from(BUCKET).remove(caminhos.slice(n, n + 100));
    if (arqIds.size) await supabase.from("org_arquivos").delete().in("id", Array.from(arqIds));
    if (topo.size) { const { error } = await supabase.from("org_areas").delete().in("id", Array.from(topo)); if (error) aviso(msgErro(error)); }
    setOcupado(""); setConfirma(null); limparSel(); recarregar(); aviso("Apagado de vez.");
  }
  async function moverPara(its: Item[], dest: string | null) {
    const ps = its.filter((i) => i.pasta).map((i) => i.id), as = its.filter((i) => i.arq).map((i) => i.id);
    if (dest === null && as.length) { aviso("Arquivos precisam ficar dentro de uma pasta."); return; }
    if (ps.length) { const { error } = await supabase.from("org_areas").update({ pai_id: dest }).in("id", ps); if (error) { aviso(erroNome(error)); return; } }
    if (as.length && dest) { const { error } = await supabase.from("org_arquivos").update({ area_id: dest }).in("id", as); if (error) { aviso(msgErro(error)); return; } }
    setMover(null); setDestino(undefined); setMenu(null); limparSel(); recarregar(); aviso("Movido.");
  }
  async function favoritar(i: Item) {
    const t = tipoFav(i.k), tem = favSet.has(`${t}:${i.id}`);
    const { error } = tem ? await supabase.from("org_favoritos").delete().eq("tipo", t).eq("item_id", i.id) : await supabase.from("org_favoritos").insert({ tipo: t, item_id: i.id });
    if (error) { aviso(msgErro(error)); return; }
    setMenu(null); favsQ.recarregar(); aviso(tem ? "Tirado dos favoritos." : "Marcado como favorito.");
  }

  async function subir(entradas: { f: File; rel: string }[]) {
    if (!cur) { aviso("Abra uma pasta para enviar arquivos."); return; }
    if (!entradas.length) return;
    let ok = 0, feito = 0;
    const cache = new Map<string, string>();
    const acharPasta = async (pai: string, n: string): Promise<string | null> => {
      const k = pai + "/" + n.toLowerCase();
      if (cache.has(k)) return cache.get(k)!;
      const ex = pastasAtivas.find((p) => p.pai_id === pai && p.nome.toLowerCase() === n.toLowerCase());
      if (ex) { cache.set(k, ex.id); return ex.id; }
      const { data, error } = await supabase.from("org_areas").insert({ nome: n, pai_id: pai }).select("id").single();
      if (error || !data) return null;
      cache.set(k, data.id); return data.id;
    };
    for (const { f, rel } of entradas) {
      setOcupado(`Enviando ${++feito} de ${entradas.length}…`);
      if (f.size > LIMITE) { aviso(`“${f.name}” passa de 50 MB e não foi enviado.`); continue; }
      let dest: string | null = cur;
      for (const parte of rel.split("/").slice(0, -1)) { dest = dest ? await acharPasta(dest, parte) : null; }
      if (!dest) { aviso(`Não consegui criar a pasta de “${f.name}”.`); continue; }
      const caminho = `${dest}/${crypto.randomUUID()}-${seguro(f.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(caminho, f, { contentType: f.type || undefined });
      if (up.error) { aviso(`Não consegui enviar “${f.name}”.`); continue; }
      const { error } = await supabase.from("org_arquivos").insert({ area_id: dest, nome: f.name, caminho, tamanho: f.size, tipo: f.type || null, criado_por: acesso?.id ?? null });
      if (error) { await supabase.storage.from(BUCKET).remove([caminho]); aviso(msgErro(error)); continue; }
      ok++;
    }
    setOcupado(""); recarregar();
    if (ok) aviso(ok === 1 ? "Arquivo enviado." : `${ok} arquivos enviados.`);
  }

  function noZip(i: Item): NoZip {
    if (i.arq) return { nome: i.nome, caminho: i.arq.caminho };
    const filhos: NoZip[] = [
      ...pastasAtivas.filter((p) => p.pai_id === i.id).map((p) => noZip(itemPasta(p))),
      ...arqsAtivos.filter((a) => a.area_id === i.id).map((a) => ({ nome: a.nome, caminho: a.caminho })),
    ];
    return { nome: i.nome, filhos };
  }
  async function baixar(its: Item[]) {
    setMenu(null);
    if (its.length === 1 && its[0].arq) { if (!(await baixarArquivo(its[0].arq))) aviso("Não consegui baixar agora."); return; }
    setOcupado("Preparando o .zip…");
    const ok = await baixarZip(its.length === 1 ? its[0].nome : "Organizacional", its.map(noZip), (f, t) => setOcupado(`Compactando ${f} de ${t}…`));
    setOcupado("");
    aviso(ok ? "Download pronto." : "Nada para baixar ou houve falha na conexão.");
  }

  /* ----- arrastar e soltar ----- */
  const aoSoltarArquivos = (e: React.DragEvent) => {
    e.preventDefault(); setArrastando(false);
    if (!pode || vista !== "drive" || !cur) return;
    const fs = Array.from(e.dataTransfer.files ?? []);
    if (fs.length) subir(fs.map((f) => ({ f, rel: f.name })));
  };
  const alvoPasta = (destId: string | null) => pode && vista === "drive" ? {
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(MIME)) { e.preventDefault(); e.stopPropagation(); } },
    onDrop: (e: React.DragEvent) => {
      const dados = e.dataTransfer.getData(MIME); if (!dados) return;
      e.preventDefault(); e.stopPropagation();
      const its = (JSON.parse(dados) as string[]).map((c) => porChave.get(c)).filter(Boolean) as Item[];
      moverPara(its.filter((i) => i.id !== destId), destId);
    },
  } : {};

  const nSel = sel.size;
  const fav = (i: Item) => favSet.has(`${tipoFav(i.k)}:${i.id}`);
  const trilhaAtual = trilha(cur);
  const usado = arqsAtivos.reduce((s, a) => s + a.tamanho, 0);
  const emLixeira = vista === "lixeira";

  /* ----- peça: uma linha/cartão de item ----- */
  const renderPeca = (i: Item) => {
    const c = chave(i), marcado = sel.has(c), t = i.arq ? tipoDe(i.arq) : null;
    const ico = i.pasta
      ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marca-clara text-marca"><Icone n="pasta" tam={24} /></span>
      : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white" style={{ background: COR_TIPO[t!] }}>{(extDe(i.nome) || "arq").toUpperCase().slice(0, 4)}</span>;
    const caminho = vista !== "drive" || nq ? (i.pasta ? caminhoTxt(i.pasta.pai_id) : caminhoTxt(i.arq!.area_id)) : "";
    const arrastavel = pode && vista === "drive";
    return (
      <div
        key={c} role="button" tabIndex={0} aria-label={i.nome} aria-pressed={marcado}
        draggable={arrastavel}
        onDragStart={(e) => { const ks = marcado ? Array.from(sel) : [c]; e.dataTransfer.setData(MIME, JSON.stringify(ks)); e.dataTransfer.effectAllowed = "move"; }}
        {...(i.pasta ? alvoPasta(i.id) : {})}
        onClick={(e) => { if (emLixeira) return; if (toque) abrir(i); else if (e.ctrlKey || e.metaKey || e.shiftKey) alternarSel(i); else setSel(new Set([c])); }}
        onDoubleClick={() => abrir(i)}
        onContextMenu={(e) => { e.preventDefault(); setMenu(i); }}
        onKeyDown={(e) => { if (e.key === "Enter") abrir(i); if (e.key === " ") { e.preventDefault(); alternarSel(i); } }}
        className={`group flex cursor-pointer select-none rounded-2xl border outline-none focus-visible:border-marca ${marcado ? "border-marca bg-marca-clara" : "border-borda bg-white hover:bg-fundo"} ${modo === "grade" ? "flex-col gap-2 p-3" : "items-center gap-3 px-3 py-2"}`}
      >
        <div className={`flex items-center gap-3 ${modo === "grade" ? "w-full justify-between" : "min-w-0 flex-1"}`}>
          {!emLixeira && <input type="checkbox" checked={marcado} onChange={() => alternarSel(i)} onClick={(e) => e.stopPropagation()} aria-label={`Selecionar ${i.nome}`} className="h-5 w-5 shrink-0 accent-[#16294d]" />}
          {modo === "lista" && ico}
          {modo === "lista" && (
            <div className="min-w-0 flex-1 leading-tight">
              <b className="block truncate text-[15px]">{fav(i) && <span className="mr-1 text-amber-500">★</span>}{i.nome}</b>
              <span className="block truncate text-xs text-suave">{i.sub}{caminho ? ` · ${caminho || "Meu drive"}` : ""}</span>
            </div>
          )}
          {modo === "grade" && <span className="ml-auto">{fav(i) && <span className="text-amber-500">★</span>}</span>}
          {modo === "grade" && <button type="button" onClick={(e) => { e.stopPropagation(); setMenu(i); }} aria-label={`Ações de ${i.nome}`} className="grid h-9 w-9 place-items-center text-suave"><Icone n="mais" tam={20} /></button>}
        </div>
        {modo === "grade" && <div className="flex flex-col items-center gap-2 py-1">{ico}<div className="w-full text-center leading-tight"><b className="block truncate text-sm">{i.nome}</b><span className="block truncate text-xs text-suave">{i.sub}</span></div></div>}
        {modo === "lista" && emLixeira && (
          <div className="flex shrink-0 gap-1.5">
            <Botao v="sec" onClick={() => restaurar([i])} className="!min-h-10 !px-3 !text-sm">Restaurar</Botao>
            <Botao v="sec" onClick={() => setConfirma({ itens: [i] })} className="!min-h-10 !px-3 !text-sm !text-alerta">Apagar de vez</Botao>
          </div>
        )}
        {modo === "lista" && !emLixeira && <button type="button" onClick={(e) => { e.stopPropagation(); setMenu(i); }} aria-label={`Ações de ${i.nome}`} className="grid h-10 w-10 shrink-0 place-items-center text-suave"><Icone n="mais" tam={20} /></button>}
        {modo === "grade" && emLixeira && (
          <div className="flex w-full gap-1.5"><Botao v="sec" onClick={() => restaurar([i])} className="!min-h-10 flex-1 !px-2 !text-sm">Restaurar</Botao><Botao v="sec" onClick={() => setConfirma({ itens: [i] })} className="!min-h-10 flex-1 !px-2 !text-sm !text-alerta">Apagar</Botao></div>
        )}
      </div>
    );
  };

  const Acao = ({ rotulo, icone, onClick, perigo }: { rotulo: string; icone: string; onClick: () => void; perigo?: boolean }) => (
    <button type="button" onClick={onClick} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border border-borda bg-white px-4 text-left font-bold ${perigo ? "text-alerta" : ""}`}><Icone n={icone} tam={20} />{rotulo}</button>
  );

  /* ----- pastas para o "mover" ----- */
  const arvoreMover = (() => {
    if (!mover) return [] as { p: Pasta; nivel: number }[];
    const proibidas = new Set<string>(); mover.filter((i) => i.pasta).forEach((i) => descendentes(i.id).forEach((d) => proibidas.add(d)));
    const r: { p: Pasta; nivel: number }[] = [];
    const andar = (pai: string | null, nivel: number) => pastasAtivas.filter((p) => p.pai_id === pai && !proibidas.has(p.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })).forEach((p) => { r.push({ p, nivel }); andar(p.id, nivel + 1); });
    andar(null, 0); return r;
  })();
  const soPastas = !!mover && mover.every((i) => i.pasta);

  const titulos: Record<Vista, string> = { drive: "Meu drive", recentes: "Recentes", favoritos: "Favoritos", compartilhados: "Compartilhados", lixeira: "Lixeira" };
  const linksAtivos = (linksQ.dados ?? []).filter((l) => l.ativo && ((l.pasta_id && ativaMemo(l.pasta_id)) || (l.arquivo_id && arqMap.get(l.arquivo_id) && !arqMap.get(l.arquivo_id)!.apagado_em)));

  return (
    <div
      onDragEnter={(e) => { if (pode && vista === "drive" && cur && e.dataTransfer.types.includes("Files")) setArrastando(true); }}
      onDragOver={(e) => { if (pode && vista === "drive" && cur && e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastando(false); }}
      onDrop={aoSoltarArquivos}
    >
      <input ref={arquivosRef} type="file" multiple hidden onChange={(e) => { subir(Array.from(e.target.files ?? []).map((f) => ({ f, rel: f.name }))); e.target.value = ""; }} />
      <input ref={pastaRef} type="file" hidden {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} multiple onChange={(e) => { subir(Array.from(e.target.files ?? []).map((f) => ({ f, rel: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name }))); e.target.value = ""; }} />

      <Titulo>Organizacional</Titulo>
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex gap-2 overflow-x-auto">
          {(["drive", "recentes", "favoritos", ...(pode ? ["compartilhados", "lixeira"] : [])] as Vista[]).map((v) => <Chip key={v} ativo={vista === v} onClick={() => irPara(v)}>{titulos[v]}</Chip>)}
        </div>

        <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-borda bg-white px-3">
          <Icone n="busca" tam={20} />
          <input value={q} onChange={(e) => { setQ(e.target.value); limparSel(); }} placeholder={vista === "drive" ? "Buscar pasta ou arquivo em todo o drive" : "Buscar nesta lista"} aria-label="Buscar" className="min-w-0 flex-1 bg-transparent outline-none" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Limpar busca" className="h-9 w-9 text-xl font-bold text-suave">×</button>}
        </label>

        {vista === "drive" && !nq && (
          <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1 text-sm">
            <button type="button" onClick={() => irPara("drive", null)} {...alvoPasta(null)} className={`min-h-9 rounded-lg px-2 font-bold ${cur === null ? "text-texto" : "text-marca"}`}>Meu drive</button>
            {trilhaAtual.map((p, n) => (
              <span key={p.id} className="flex items-center gap-1"><span className="text-suave">›</span>
                <button type="button" onClick={() => irPara("drive", p.id)} {...alvoPasta(p.id)} className={`min-h-9 rounded-lg px-2 font-bold ${n === trilhaAtual.length - 1 ? "text-texto" : "text-marca"}`}>{p.nome}</button></span>
            ))}
          </nav>
        )}

        {pode && vista === "drive" && !nq && (
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => { setNome(""); setNovaPasta(true); }} className="!min-h-11"><Icone n="pasta" tam={18} />Nova pasta</Botao>
            {cur && <Botao v="sec" onClick={() => arquivosRef.current?.click()} disabled={!!ocupado} className="!min-h-11">Enviar arquivos</Botao>}
            {cur && <Botao v="sec" onClick={() => pastaRef.current?.click()} disabled={!!ocupado} className="!min-h-11">Enviar pasta</Botao>}
          </div>
        )}
        {pode && vista === "drive" && !nq && cur === null && <p className="m-0 text-sm text-suave">Crie uma pasta (ou abra uma existente) para enviar arquivos. Você também pode arrastar arquivos do computador para dentro de uma pasta aberta.</p>}
        {vista === "lixeira" && itens.length > 0 && <div className="flex flex-wrap items-center gap-2"><p className="m-0 flex-1 text-sm text-suave">O que você apaga fica aqui até ser apagado de vez. Dá para restaurar.</p><Botao v="sec" onClick={() => setConfirma({ itens, todos: true })} className="!min-h-11 !text-alerta">Esvaziar lixeira</Botao></div>}
        {ocupado && <div role="status" className="rounded-2xl bg-marca-clara px-4 py-2 text-sm font-bold text-marca-esc">{ocupado}</div>}

        {vista !== "compartilhados" && (
          <div className="flex flex-wrap items-center gap-2">
            {nSel > 0 ? (
              <>
                <b className="text-sm">{nSel} selecionado{nSel > 1 ? "s" : ""}</b>
                {!emLixeira && <Botao v="sec" onClick={() => baixar(selecionados())} className="!min-h-10 !px-3 !text-sm"><Icone n="baixar" tam={16} />{nSel > 1 || selecionados().some((i) => i.pasta) ? "Baixar (.zip)" : "Baixar"}</Botao>}
                {pode && !emLixeira && vista === "drive" && <Botao v="sec" onClick={() => { setMover(selecionados()); setDestino(undefined); }} className="!min-h-10 !px-3 !text-sm"><Icone n="mover" tam={16} />Mover</Botao>}
                {pode && !emLixeira && <Botao v="sec" onClick={() => paraLixeira(selecionados())} className="!min-h-10 !px-3 !text-sm !text-alerta"><Icone n="lixo" tam={16} />Apagar</Botao>}
                <button type="button" onClick={limparSel} className="min-h-10 px-2 text-sm font-bold text-marca">Limpar</button>
              </>
            ) : (
              <>
                <span className="text-sm text-suave">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
                {itens.length > 0 && !emLixeira && <button type="button" onClick={() => setSel(new Set(itens.map(chave)))} className="min-h-10 px-2 text-sm font-bold text-marca">Selecionar tudo</button>}
                <span className="flex-1" />
                {vista === "drive" && <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} aria-label="Ordenar" className="min-h-10 rounded-xl border border-borda bg-white px-2 text-sm"><option value="nome">Nome</option><option value="data">Mais novos</option><option value="tam">Maiores</option></select>}
                <div className="flex overflow-hidden rounded-xl border border-borda">
                  <button type="button" onClick={() => trocarModo("lista")} aria-pressed={modo === "lista"} className={`min-h-10 px-3 text-sm font-bold ${modo === "lista" ? "bg-marca text-white" : "bg-white text-suave"}`}>Lista</button>
                  <button type="button" onClick={() => trocarModo("grade")} aria-pressed={modo === "grade"} className={`min-h-10 px-3 text-sm font-bold ${modo === "grade" ? "bg-marca text-white" : "bg-white text-suave"}`}>Grade</button>
                </div>
              </>
            )}
          </div>
        )}

        {arrastando && <div className="rounded-3xl border-2 border-dashed border-marca bg-marca-clara p-6 text-center font-bold text-marca-esc">Solte aqui para enviar para “{mapa.get(cur ?? "")?.nome}”</div>}

        {vista === "compartilhados" ? (
          <div className="flex flex-col gap-2">
            {linksAtivos.length === 0 && <Vazio>Nenhum link ativo. Abra o menu de uma pasta ou arquivo e escolha “Compartilhar”.</Vazio>}
            {linksAtivos.map((l) => {
              const nomeItem = l.pasta_id ? mapa.get(l.pasta_id)?.nome : arqMap.get(l.arquivo_id!)?.nome;
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-borda bg-white p-3">
                  <span className="text-marca"><Icone n={l.pasta_id ? "pasta" : "arquivo"} tam={22} /></span>
                  <div className="min-w-0 flex-1 leading-tight"><b className="block truncate">{nomeItem}</b><span className="text-xs text-suave">{validade(l)}</span></div>
                  <Botao v="sec" onClick={async () => { try { await navigator.clipboard.writeText(urlLink(l.token)); aviso("Link copiado."); } catch { aviso("Não consegui copiar."); } }} className="!min-h-10 !px-3 !text-sm">Copiar</Botao>
                  <Botao v="sec" onClick={() => setPartilha({ tipo: l.pasta_id ? "pasta" : "arquivo", id: (l.pasta_id ?? l.arquivo_id)!, nome: nomeItem ?? "" })} className="!min-h-10 !px-3 !text-sm">Gerenciar</Botao>
                </div>
              );
            })}
          </div>
        ) : itens.length === 0 ? (
          <Vazio>{nq ? "Nada encontrado." : vista === "lixeira" ? "A lixeira está vazia." : vista === "favoritos" ? "Nenhum favorito ainda. Use o menu de um item e escolha “Favoritar”." : vista === "recentes" ? "Nenhum arquivo enviado ainda." : cur === null ? (pode ? "Nenhuma pasta ainda. Toque em “Nova pasta”." : "Nenhuma pasta ainda.") : pode ? "Pasta vazia. Envie arquivos ou crie uma subpasta." : "Pasta vazia."}</Vazio>
        ) : (
          <div className={modo === "grade" ? "grid grid-cols-2 gap-2.5 md:grid-cols-4" : "flex flex-col gap-2"}>{itens.map(renderPeca)}</div>
        )}

        {vista === "drive" && <p className="m-0 pt-2 text-xs text-suave">{arqsAtivos.length} arquivo{arqsAtivos.length === 1 ? "" : "s"} no drive · {tam(usado)} em uso. {toque ? "Toque para abrir." : "Clique para selecionar, dois cliques para abrir, botão direito para o menu."}</p>}
      </div>

      {/* ----- menu do item ----- */}
      {menu && (
        <Janela titulo={menu.nome} onFechar={() => setMenu(null)}>
          <div className="flex flex-col gap-2 overflow-y-auto pb-2">
            <p className="m-0 text-xs text-suave">{menu.pasta ? `Pasta · ${menu.sub}` : `${menu.sub}${menu.arq?.tipo ? " · " + menu.arq.tipo : ""}`}</p>
            {emLixeira ? (
              <>
                <Acao rotulo="Restaurar" icone="mover" onClick={() => { setMenu(null); restaurar([menu]); }} />
                <Acao rotulo="Apagar de vez" icone="lixo" perigo onClick={() => { setMenu(null); setConfirma({ itens: [menu] }); }} />
              </>
            ) : (
              <>
                <Acao rotulo={menu.pasta ? "Abrir pasta" : podeImprimir(tipoDe(menu.arq!)) ? "Abrir e imprimir" : "Abrir (pré-visualizar)"} icone={menu.pasta ? "pasta" : podeImprimir(tipoDe(menu.arq!)) ? "imprimir" : "arquivo"} onClick={() => { const m = menu; setMenu(null); abrir(m); }} />
                <Acao rotulo={menu.pasta ? "Baixar pasta (.zip)" : "Baixar"} icone="baixar" onClick={() => baixar([menu])} />
                <Acao rotulo={fav(menu) ? "Tirar dos favoritos" : "Favoritar"} icone="estrela" onClick={() => favoritar(menu)} />
                {pode && <Acao rotulo="Compartilhar por link" icone="compartilhar" onClick={() => { setPartilha({ tipo: tipoFav(menu.k), id: menu.id, nome: menu.nome }); setMenu(null); }} />}
                {pode && <Acao rotulo="Renomear" icone="lapis" onClick={() => { setNome(menu.nome); setRenomear(menu); setMenu(null); }} />}
                {pode && <Acao rotulo="Mover para…" icone="mover" onClick={() => { setMover([menu]); setDestino(undefined); setMenu(null); }} />}
                {pode && <Acao rotulo="Apagar (vai para a lixeira)" icone="lixo" perigo onClick={() => paraLixeira([menu])} />}
              </>
            )}
          </div>
        </Janela>
      )}

      {prev && <Previa arquivo={prev} lista={listaPrev} onTrocar={(a) => setPrev(arqMap.get(a.id) ?? null)} onFechar={() => setPrev(null)}
        extra={pode ? <button type="button" onClick={() => { setPartilha({ tipo: "arquivo", id: prev.id, nome: prev.nome }); }} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-white hover:bg-white/10"><Icone n="compartilhar" tam={20} />Compartilhar</button> : undefined} />}
      {partilha && <div className="relative z-[80]"><Compartilhar item={partilha} onFechar={() => setPartilha(null)} onMudou={linksQ.recarregar} /></div>}

      {novaPasta && (
        <Janela titulo="Nova pasta" onFechar={() => setNovaPasta(false)}>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); criarPasta(); }}><Campo rotulo={cur ? `Dentro de “${mapa.get(cur)?.nome}”` : "Nome da pasta"} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Louvor" autoFocus /><Botao type="submit" bloco>Criar pasta</Botao></form>
        </Janela>
      )}
      {renomear && (
        <Janela titulo="Renomear" onFechar={() => setRenomear(null)}>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); salvarNome(); }}><Campo rotulo="Novo nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /><Botao type="submit" bloco>Salvar</Botao></form>
        </Janela>
      )}
      {mover && (
        <Janela titulo={`Mover ${mover.length === 1 ? `“${mover[0].nome}”` : mover.length + " itens"}`} onFechar={() => setMover(null)}>
          <div className="flex flex-col gap-2 overflow-y-auto pb-2">
            {soPastas && <button type="button" onClick={() => setDestino(null)} className={`min-h-12 rounded-2xl border px-4 text-left font-bold ${destino === null ? "border-marca bg-marca-clara" : "border-borda bg-white"}`}>Meu drive (raiz)</button>}
            {arvoreMover.map(({ p, nivel }) => (
              <button key={p.id} type="button" onClick={() => setDestino(p.id)} style={{ marginLeft: nivel * 16 }} className={`flex min-h-12 items-center gap-2 rounded-2xl border px-4 text-left font-bold ${destino === p.id ? "border-marca bg-marca-clara" : "border-borda bg-white"}`}><span className="text-marca"><Icone n="pasta" tam={18} /></span>{p.nome}</button>
            ))}
            {arvoreMover.length === 0 && !soPastas && <Vazio>Crie uma pasta primeiro.</Vazio>}
            <Botao bloco disabled={destino === undefined} onClick={() => destino !== undefined && moverPara(mover, destino)}>Mover para aqui</Botao>
          </div>
        </Janela>
      )}
      {confirma && (
        <Janela titulo={confirma.todos ? "Esvaziar a lixeira?" : "Apagar de vez?"} onFechar={() => setConfirma(null)}>
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm">{confirma.todos ? `Os ${confirma.itens.length} itens da lixeira` : confirma.itens.length === 1 ? `“${confirma.itens[0].nome}”` : `${confirma.itens.length} itens`} {confirma.itens.some((i) => i.pasta) ? "(com tudo que há dentro das pastas) " : ""}serão apagados para sempre. Os links compartilhados deles também deixam de funcionar. Não dá para desfazer.</p>
            <Botao v="perigo" bloco disabled={!!ocupado} onClick={() => apagarDeVez(confirma.itens)}>{ocupado || "Apagar para sempre"}</Botao>
            <Botao v="sec" bloco onClick={() => setConfirma(null)}>Cancelar</Botao>
          </div>
        </Janela>
      )}
    </div>
  );
}
