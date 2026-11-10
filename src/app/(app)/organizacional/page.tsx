"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { norm } from "@/lib/tipos";
import { podeEscrever } from "@/lib/perm";
import { useAuth, useAviso } from "@/components/provedores";
import { baixarArquivo, baixarZip, BUCKET, COR_TIPO, dataBr, extDe, LIMITE, podeImprimir, ROTULO_TIPO, seguro, tam, tipoDe, type Arq, type NoZip, type Pasta, type Tipo } from "@/lib/drive";
import { Compartilhar, urlInterno, urlLink, validade, type LinkOrg } from "@/components/compartilharDrive";
import { Previa } from "@/components/previa";
import { Botao, Campo, Carregando, Icone, Janela, Vazio } from "@/components/ui";

type Vista = "drive" | "recentes" | "favoritos" | "compartilhados" | "lixeira";
type Item = { k: "p" | "a"; id: string; nome: string; data: string; tam: number; pasta?: Pasta; arq?: Arq };
type Fav = { tipo: "pasta" | "arquivo"; item_id: string };
type Envio = { id: string; nome: string; estado: "fila" | "enviando" | "ok" | "erro" };
type Acao = { rotulo: string; icone: string; onClick: () => void; perigo?: boolean; sep?: boolean };
type Filtro = "pasta" | Tipo | null;
const chave = (i: { k: string; id: string }) => `${i.k}:${i.id}`;
const tipoFav = (k: "p" | "a") => (k === "p" ? "pasta" : "arquivo");
const MIME = "text/vv-org";

/** Lê arquivos e pastas soltos na tela (arrastar e soltar), mantendo o caminho das subpastas. */
async function lerSoltos(dt: DataTransfer): Promise<{ f: File; rel: string }[]> {
  const entradas = Array.from(dt.items ?? []).map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
  if (entradas.length === 0 || entradas.some((e) => !e)) return Array.from(dt.files).map((f) => ({ f, rel: f.name }));
  const out: { f: File; rel: string }[] = [];
  const andar = async (e: FileSystemEntry, base: string): Promise<void> => {
    if (e.isFile) { const f = await new Promise<File>((ok, no) => (e as FileSystemFileEntry).file(ok, no)); out.push({ f, rel: base + e.name }); return; }
    const r = (e as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const lote = await new Promise<FileSystemEntry[]>((ok, no) => r.readEntries(ok, no));
      if (!lote.length) break;
      for (const x of lote) await andar(x, base + e.name + "/");
    }
  };
  for (const e of entradas) if (e) await andar(e, "");
  return out;
}

/** Organizacional = o Drive do Vida Vitoriosa (mesma lógica e visual do Google Drive). */
export default function Organizacional() {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const pastasQ = useLista<Pasta>("org_areas", "*", "nome");
  const arqsQ = useLista<Arq & { atualizado_em?: string }>("org_arquivos", "*", "criado_em");
  const favsQ = useLista<Fav>("org_favoritos", "*");
  const linksQ = useLista<LinkOrg>("org_links", "*", "criado_em");
  const pode = podeEscrever(acesso, "organizacional");

  const [vista, setVista] = useState<Vista>("drive");
  const [cur, setCur] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ item: Item; x: number; y: number } | null>(null);
  const [novoMenu, setNovoMenu] = useState<{ x: number; y: number } | null>(null);
  const [prev, setPrev] = useState<Arq | null>(null);
  const [partilha, setPartilha] = useState<{ tipo: "pasta" | "arquivo"; id: string; nome: string } | null>(null);
  const [mover, setMover] = useState<Item[] | null>(null);
  const [destino, setDestino] = useState<string | null | undefined>(undefined);
  const [novaPasta, setNovaPasta] = useState(false);
  const [renomear, setRenomear] = useState<Item | null>(null);
  const [nome, setNome] = useState("");
  const [confirma, setConfirma] = useState<{ itens: Item[]; todos?: boolean } | null>(null);
  const [detalhes, setDetalhes] = useState<Item | null>(null);
  const [ocupado, setOcupado] = useState("");
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [bandejaAberta, setBandejaAberta] = useState(true);
  const [arrastando, setArrastando] = useState(false);
  const [modo, setModo] = useState<"lista" | "grade">("lista");
  const [ordem, setOrdem] = useState<{ c: "nome" | "data" | "tam"; dir: 1 | -1 }>({ c: "nome", dir: 1 });
  const [toque, setToque] = useState(false);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const arquivosRef = useRef<HTMLInputElement>(null);
  const pastaRef = useRef<HTMLInputElement>(null);
  const profundidade = useRef(0);
  const linkInicial = useRef(false);

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

  const trilha = useCallback((id: string | null): Pasta[] => {
    const r: Pasta[] = []; let p = id ? mapa.get(id) : undefined;
    while (p) { r.unshift(p); p = p.pai_id ? mapa.get(p.pai_id) : undefined; }
    return r;
  }, [mapa]);
  const caminhoTxt = useCallback((id: string | null) => ["Meu Drive", ...trilha(id).map((p) => p.nome)].join(" › "), [trilha]);
  const descendentes = useCallback((id: string) => {
    const r = new Set<string>([id]); let mudou = true;
    while (mudou) { mudou = false; (pastas ?? []).forEach((p) => { if (p.pai_id && r.has(p.pai_id) && !r.has(p.id)) { r.add(p.id); mudou = true; } }); }
    return r;
  }, [pastas]);

  const itemPasta = useCallback((p: Pasta): Item => ({ k: "p", id: p.id, nome: p.nome, data: p.criado_em, tam: 0, pasta: p }), []);
  const itemArq = useCallback((a: Arq & { atualizado_em?: string }): Item => ({ k: "a", id: a.id, nome: a.nome, data: a.atualizado_em ?? a.criado_em, tam: a.tamanho, arq: a }), []);
  const ordenar = useCallback((l: Item[]) => l.slice().sort((x, y) => {
    if (x.k !== y.k) return x.k === "p" ? -1 : 1;
    if (ordem.c === "data") return ordem.dir * x.data.localeCompare(y.data);
    if (ordem.c === "tam" && x.k === "a") return ordem.dir * (x.tam - y.tam);
    return ordem.dir * x.nome.localeCompare(y.nome, "pt-BR", { numeric: true });
  }), [ordem]);

  const nq = norm(q);
  const passa = useCallback((i: Item) => {
    if (nq && !norm(i.nome).includes(nq)) return false;
    if (!filtro) return true;
    if (filtro === "pasta") return i.k === "p";
    if (i.k === "p") return false;
    const t = tipoDe(i.arq!);
    return filtro === "docx" ? t === "docx" || t === "texto" : t === filtro;
  }, [nq, filtro]);
  const itens: Item[] = useMemo(() => {
    if (!pastas || !arqs) return [];
    if (vista === "drive") {
      const base = nq || filtro ? [...pastasAtivas.filter((p) => !nq && filtro ? p.pai_id === cur : true).map(itemPasta), ...arqsAtivos.filter((a) => !nq && filtro ? a.area_id === cur : true).map(itemArq)]
        : [...pastasAtivas.filter((p) => p.pai_id === cur).map(itemPasta), ...arqsAtivos.filter((a) => a.area_id === cur).map(itemArq)];
      return ordenar(base.filter(passa));
    }
    let l: Item[] = [];
    if (vista === "recentes") l = arqsAtivos.slice().sort((a, b) => (b.atualizado_em ?? b.criado_em).localeCompare(a.atualizado_em ?? a.criado_em)).slice(0, 60).map(itemArq);
    if (vista === "favoritos") l = [...pastasAtivas.filter((p) => favSet.has("pasta:" + p.id)).map(itemPasta), ...arqsAtivos.filter((a) => favSet.has("arquivo:" + a.id)).map(itemArq)];
    if (vista === "lixeira") l = [...pastas.filter((p) => p.apagado_em && ativaMemo(p.pai_id)).map(itemPasta), ...arqs.filter((a) => a.apagado_em && ativaMemo(a.area_id)).map(itemArq)];
    l = l.filter(passa);
    return vista === "recentes" ? l : ordenar(l);
  }, [pastas, arqs, vista, cur, nq, filtro, pastasAtivas, arqsAtivos, favSet, ativaMemo, ordenar, passa, itemPasta, itemArq]);
  const porChave = useMemo(() => new Map(itens.map((i) => [chave(i), i])), [itens]);
  const listaPrev = useMemo(() => itens.filter((i) => i.arq).map((i) => i.arq!), [itens]);

  /* miniaturas das imagens na visão em grade */
  useEffect(() => {
    if (modo !== "grade") return;
    const alvo = itens.filter((i) => i.arq && tipoDe(i.arq) === "imagem" && i.tam < 8_000_000 && !thumbs.has(i.id)).slice(0, 40);
    if (!alvo.length) return;
    let vivo = true;
    supabase.storage.from(BUCKET).createSignedUrls(alvo.map((i) => i.arq!.caminho), 3600).then(({ data }) => {
      if (!vivo || !data) return;
      const porCaminho = new Map(data.map((d) => [d.path, d.signedUrl]));
      setThumbs((prev) => { const n = new Map(prev); alvo.forEach((i) => { const u = porCaminho.get(i.arq!.caminho); if (u) n.set(i.id, u); }); return n; });
    });
    return () => { vivo = false; };
  }, [itens, modo, thumbs]);

  /* link interno (?item=p:ID ou a:ID): abre a pasta ou o arquivo */
  useEffect(() => {
    if (linkInicial.current || !pastas || !arqs) return;
    linkInicial.current = true;
    const v = new URLSearchParams(window.location.search).get("item");
    if (!v) return;
    const [t, id] = v.split(":");
    if (t === "p" && mapa.get(id) && ativaMemo(id)) setCur(id);
    if (t === "a") { const a = arqMap.get(id); if (a && !a.apagado_em && ativaMemo(a.area_id)) { setCur(a.area_id); setPrev(a); } }
  }, [pastas, arqs, mapa, arqMap, ativaMemo]);

  useEffect(() => {
    if (!menu && !novoMenu) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(null); setNovoMenu(null); } };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, [menu, novoMenu]);

  if (!pastas || !arqs) return <Carregando />;

  const recarregar = () => { pastasQ.recarregar(); arqsQ.recarregar(); favsQ.recarregar(); linksQ.recarregar(); };
  const limparSel = () => setSel(new Set());
  const irPara = (v: Vista, pasta: string | null = null) => { setVista(v); setCur(pasta); setQ(""); setFiltro(null); limparSel(); };
  const abrir = (i: Item) => { if (vista === "lixeira") return; if (i.pasta) { setVista("drive"); setCur(i.id); setQ(""); setFiltro(null); limparSel(); } else if (i.arq) setPrev(i.arq); };
  const alternarSel = (i: Item) => setSel((s) => { const n = new Set(s); const c = chave(i); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const selecionados = () => Array.from(sel).map((c) => porChave.get(c)).filter(Boolean) as Item[];
  const fav = (i: Item) => favSet.has(`${tipoFav(i.k)}:${i.id}`);
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
    setMenu(null); limparSel(); recarregar(); aviso(its.length === 1 ? "Movido para a lixeira." : `${its.length} itens movidos para a lixeira.`);
  }
  async function restaurar(its: Item[]) {
    for (const i of its) {
      const r = i.pasta ? await supabase.from("org_areas").update({ apagado_em: null }).eq("id", i.id) : await supabase.from("org_arquivos").update({ apagado_em: null }).eq("id", i.id);
      if (r.error) { aviso(r.error.code === "23505" ? `Já existe uma pasta chamada “${i.nome}” no mesmo lugar. Renomeie uma delas.` : msgErro(r.error)); recarregar(); return; }
    }
    setMenu(null); limparSel(); recarregar(); aviso("Restaurado.");
  }
  async function apagarDeVez(its: Item[]) {
    setOcupado("Apagando…");
    const topo = new Set<string>(), pastaIds = new Set<string>(), arqIds = new Set<string>();
    its.forEach((i) => { if (i.pasta) { topo.add(i.id); descendentes(i.id).forEach((d) => pastaIds.add(d)); } else arqIds.add(i.id); });
    const caminhos = (arqs ?? []).filter((a) => arqIds.has(a.id) || (a.area_id && pastaIds.has(a.area_id))).map((a) => a.caminho);
    for (let n = 0; n < caminhos.length; n += 100) await supabase.storage.from(BUCKET).remove(caminhos.slice(n, n + 100));
    if (arqIds.size) await supabase.from("org_arquivos").delete().in("id", Array.from(arqIds));
    if (topo.size) { const { error } = await supabase.from("org_areas").delete().in("id", Array.from(topo)); if (error) aviso(msgErro(error)); }
    setOcupado(""); setConfirma(null); limparSel(); recarregar(); aviso("Excluído permanentemente.");
  }
  async function moverPara(its: Item[], dest: string | null) {
    const ps = its.filter((i) => i.pasta).map((i) => i.id), as = its.filter((i) => i.arq).map((i) => i.id);
    if (ps.length) { const { error } = await supabase.from("org_areas").update({ pai_id: dest }).in("id", ps); if (error) { aviso(erroNome(error)); return; } }
    if (as.length) { const { error } = await supabase.from("org_arquivos").update({ area_id: dest }).in("id", as); if (error) { aviso(msgErro(error)); return; } }
    setMover(null); setDestino(undefined); setMenu(null); limparSel(); recarregar(); aviso("Movido.");
  }
  async function favoritar(its: Item[]) {
    const todosFav = its.every(fav);
    for (const i of its) {
      const t = tipoFav(i.k);
      const { error } = todosFav ? await supabase.from("org_favoritos").delete().eq("tipo", t).eq("item_id", i.id) : fav(i) ? { error: null } : await supabase.from("org_favoritos").insert({ tipo: t, item_id: i.id });
      if (error) { aviso(msgErro(error)); return; }
    }
    setMenu(null); favsQ.recarregar(); aviso(todosFav ? "Removido dos favoritos." : "Adicionado aos favoritos.");
  }
  async function fazerCopia(a: Arq) {
    setMenu(null); setOcupado("Fazendo uma cópia…");
    const novo = `${a.area_id ?? "raiz"}/${crypto.randomUUID()}-${seguro(a.nome)}`;
    const c = await supabase.storage.from(BUCKET).copy(a.caminho, novo);
    if (c.error) { setOcupado(""); aviso("Não consegui copiar o arquivo."); return; }
    const { error } = await supabase.from("org_arquivos").insert({ area_id: a.area_id, nome: `Cópia de ${a.nome}`, caminho: novo, tamanho: a.tamanho, tipo: a.tipo, criado_por: acesso?.id ?? null });
    setOcupado("");
    if (error) { await supabase.storage.from(BUCKET).remove([novo]); aviso(msgErro(error)); return; }
    recarregar(); aviso("Cópia criada.");
  }

  async function subir(entradas: { f: File; rel: string }[]) {
    if (!entradas.length) return;
    const base = Date.now();
    const lista: Envio[] = entradas.map((e, n) => ({ id: `${base}-${n}`, nome: e.rel, estado: "fila" }));
    setEnvios(lista); setBandejaAberta(true);
    const marca = (id: string, estado: Envio["estado"]) => setEnvios((l) => l.map((x) => (x.id === id ? { ...x, estado } : x)));
    const cache = new Map<string, string>();
    const acharPasta = async (pai: string | null, n: string): Promise<string | null> => {
      const k = (pai ?? "raiz") + "/" + n.toLowerCase();
      if (cache.has(k)) return cache.get(k)!;
      const ex = pastasAtivas.find((p) => p.pai_id === pai && p.nome.toLowerCase() === n.toLowerCase());
      if (ex) { cache.set(k, ex.id); return ex.id; }
      const { data, error } = await supabase.from("org_areas").insert({ nome: n, pai_id: pai }).select("id").single();
      if (error || !data) return null;
      cache.set(k, data.id); return data.id;
    };
    let ok = 0;
    for (let n = 0; n < entradas.length; n++) {
      const { f, rel } = entradas[n], id = lista[n].id;
      marca(id, "enviando");
      if (f.size > LIMITE) { marca(id, "erro"); aviso(`“${f.name}” passa de 50 MB e não foi enviado.`); continue; }
      let dest: string | null = cur, falhou = false;
      for (const parte of rel.split("/").slice(0, -1)) { const r = await acharPasta(dest, parte); if (!r) { falhou = true; break; } dest = r; }
      if (falhou) { marca(id, "erro"); continue; }
      const caminho = `${dest ?? "raiz"}/${crypto.randomUUID()}-${seguro(f.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(caminho, f, { contentType: f.type || undefined });
      if (up.error) { marca(id, "erro"); continue; }
      const { error } = await supabase.from("org_arquivos").insert({ area_id: dest, nome: f.name, caminho, tamanho: f.size, tipo: f.type || null, criado_por: acesso?.id ?? null });
      if (error) { await supabase.storage.from(BUCKET).remove([caminho]); marca(id, "erro"); continue; }
      marca(id, "ok"); ok++;
    }
    recarregar();
    if (ok === 0) aviso("Nenhum arquivo foi enviado.");
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
  const compartilhar = (i: Item) => { setMenu(null); setPartilha({ tipo: tipoFav(i.k), id: i.id, nome: i.nome }); };

  /* ----- arrastar e soltar ----- */
  const externo = (e: React.DragEvent) => pode && vista === "drive" && e.dataTransfer.types.includes("Files");
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
  const emLixeira = vista === "lixeira";
  const trilhaAtual = trilha(cur);
  const usado = arqsAtivos.reduce((s, a) => s + a.tamanho, 0);
  const aoVivo = (i: Item) => (i.pasta ? "Pasta" : ROTULO_TIPO[tipoDe(i.arq!)]);
  const abrirPopover = (i: Item, el: HTMLElement) => { const r = el.getBoundingClientRect(); setMenu({ item: i, x: Math.max(8, r.right - 250), y: r.bottom + 4 }); };

  const acoesDe = (i: Item): Acao[] => {
    if (emLixeira) return [{ rotulo: "Restaurar", icone: "restaurar", onClick: () => restaurar([i]) }, { rotulo: "Excluir permanentemente", icone: "lixo", perigo: true, onClick: () => { setMenu(null); setConfirma({ itens: [i] }); } }];
    const l: Acao[] = [
      { rotulo: i.pasta ? "Abrir" : "Visualizar", icone: i.pasta ? "pasta" : "arquivo", onClick: () => { setMenu(null); abrir(i); } },
      { rotulo: i.pasta ? "Baixar (.zip)" : "Baixar", icone: "baixar", onClick: () => baixar([i]), sep: true },
    ];
    if (i.arq && podeImprimir(tipoDe(i.arq))) l.push({ rotulo: "Imprimir", icone: "imprimir", onClick: () => { setMenu(null); setPrev(i.arq!); } });
    if (pode) l.push({ rotulo: "Renomear", icone: "lapis", onClick: () => { setNome(i.nome); setRenomear(i); setMenu(null); } });
    if (pode && i.arq) l.push({ rotulo: "Fazer uma cópia", icone: "copia", onClick: () => fazerCopia(i.arq!) });
    l.push({ rotulo: "Compartilhar", icone: "compartilhar", onClick: () => compartilhar(i), sep: true });
    l.push({ rotulo: fav(i) ? "Remover dos favoritos" : "Adicionar aos favoritos", icone: "estrela", onClick: () => favoritar([i]) });
    if (pode) l.push({ rotulo: "Mover para…", icone: "mover", onClick: () => { setMover([i]); setDestino(undefined); setMenu(null); } });
    l.push({ rotulo: "Informações", icone: "info", onClick: () => { setDetalhes(i); setMenu(null); }, sep: true });
    if (pode) l.push({ rotulo: "Mover para a lixeira", icone: "lixo", perigo: true, onClick: () => paraLixeira([i]), sep: true });
    return l;
  };

  /* ----- peças ----- */
  const iconeItem = (i: Item, g = false) => {
    if (i.pasta) return <span className="text-[#5f6368]"><Icone n="pasta" tam={g ? 22 : 24} /></span>;
    const t = tipoDe(i.arq!);
    return <span className="grid shrink-0 place-items-center rounded text-[9px] font-extrabold leading-none text-white" style={{ background: COR_TIPO[t], width: g ? 22 : 24, height: g ? 22 : 24 }}>{(extDe(i.nome) || "arq").toUpperCase().slice(0, 3)}</span>;
  };
  const propsLinha = (i: Item) => {
    const c = chave(i), marcado = sel.has(c);
    return {
      marcado,
      props: {
        role: "button" as const, tabIndex: 0, "aria-label": i.nome, "aria-pressed": marcado,
        draggable: pode && vista === "drive",
        onDragStart: (e: React.DragEvent) => { const ks = marcado ? Array.from(sel) : [c]; e.dataTransfer.setData(MIME, JSON.stringify(ks)); e.dataTransfer.effectAllowed = "move"; },
        ...(i.pasta && !emLixeira ? alvoPasta(i.id) : {}),
        onClick: (e: React.MouseEvent) => { if (emLixeira) { setSel(new Set([c])); return; } if (toque) abrir(i); else if (e.ctrlKey || e.metaKey || e.shiftKey) alternarSel(i); else setSel(new Set([c])); },
        onDoubleClick: () => abrir(i),
        onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setSel((s) => (s.has(c) ? s : new Set([c]))); setMenu({ item: i, x: Math.min(e.clientX, window.innerWidth - 260), y: Math.min(e.clientY, window.innerHeight - 380) }); },
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") abrir(i); if (e.key === " ") { e.preventDefault(); alternarSel(i); } },
      },
    };
  };
  const botaoMais = (i: Item) => <button type="button" onClick={(e) => { e.stopPropagation(); abrirPopover(i, e.currentTarget); }} aria-label={`Mais ações de ${i.nome}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#5f6368] hover:bg-black/5"><Icone n="mais_v" tam={20} /></button>;

  const linhaLista = (i: Item) => {
    const { marcado, props } = propsLinha(i);
    return (
      <div key={chave(i)} {...props} className={`grid cursor-pointer select-none items-center gap-3 border-b border-borda px-3 py-1.5 outline-none last:border-b-0 focus-visible:bg-marca-clara md:grid-cols-[minmax(0,1fr)_110px_120px_90px_40px] grid-cols-[minmax(0,1fr)_40px] ${marcado ? "bg-marca-clara" : "hover:bg-[#f1f3f4]"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <input type="checkbox" checked={marcado} onChange={() => alternarSel(i)} onClick={(e) => e.stopPropagation()} aria-label={`Selecionar ${i.nome}`} className="h-4 w-4 shrink-0 accent-[#16294d]" />
          {iconeItem(i)}
          <div className="min-w-0 leading-tight"><b className="block truncate text-sm font-medium">{i.nome}{fav(i) && <span className="ml-1.5 text-amber-500">★</span>}</b>
            <span className="block truncate text-xs text-suave md:hidden">{dataBr(i.data)}{i.arq ? ` · ${tam(i.tam)}` : ""}</span>
            {(vista !== "drive" || nq) && <span className="block truncate text-xs text-suave">{caminhoTxt(i.pasta ? i.pasta.pai_id : i.arq!.area_id)}</span>}</div>
        </div>
        <span className="hidden text-sm text-suave md:block">{aoVivo(i)}</span>
        <span className="hidden text-sm text-suave md:block">{dataBr(i.data)}</span>
        <span className="hidden text-sm text-suave md:block">{i.arq ? tam(i.tam) : "—"}</span>
        {botaoMais(i)}
      </div>
    );
  };
  const cartaoGrade = (i: Item) => {
    const { marcado, props } = propsLinha(i);
    if (i.pasta) return (
      <div key={chave(i)} {...props} className={`flex min-h-12 cursor-pointer select-none items-center gap-3 rounded-xl border px-3 outline-none ${marcado ? "border-marca bg-marca-clara" : "border-borda bg-[#f9fafb] hover:bg-[#f1f3f4]"}`}>
        {iconeItem(i, true)}<b className="min-w-0 flex-1 truncate text-sm font-medium">{i.nome}</b>{fav(i) && <span className="text-amber-500">★</span>}{botaoMais(i)}
      </div>
    );
    const t = tipoDe(i.arq!), th = thumbs.get(i.id);
    return (
      <div key={chave(i)} {...props} className={`flex cursor-pointer select-none flex-col overflow-hidden rounded-xl border outline-none ${marcado ? "border-marca bg-marca-clara" : "border-borda bg-[#f9fafb] hover:bg-[#f1f3f4]"}`}>
        <div className="flex items-center gap-2 px-3 py-2">{iconeItem(i, true)}<b className="min-w-0 flex-1 truncate text-sm font-medium">{i.nome}</b>{fav(i) && <span className="text-amber-500">★</span>}{botaoMais(i)}</div>
        <div className="mx-2 mb-2 grid h-32 place-items-center overflow-hidden rounded-lg bg-white">
          {th /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={th} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-xl text-lg font-extrabold text-white" style={{ background: COR_TIPO[t] }}>{(extDe(i.nome) || "arq").toUpperCase().slice(0, 4)}</span>}
        </div>
      </div>
    );
  };

  const arvoreMover = (() => {
    if (!mover) return [] as { p: Pasta; nivel: number }[];
    const proibidas = new Set<string>(); mover.filter((i) => i.pasta).forEach((i) => descendentes(i.id).forEach((d) => proibidas.add(d)));
    const r: { p: Pasta; nivel: number }[] = [];
    const andar = (pai: string | null, nivel: number) => pastasAtivas.filter((p) => p.pai_id === pai && !proibidas.has(p.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })).forEach((p) => { r.push({ p, nivel }); andar(p.id, nivel + 1); });
    andar(null, 0); return r;
  })();

  const NAV: { v: Vista; t: string; ic: string; so?: "pode" }[] = [
    { v: "drive", t: "Meu Drive", ic: "pasta" }, { v: "recentes", t: "Recentes", ic: "relogio" }, { v: "favoritos", t: "Com estrela", ic: "estrela" },
    { v: "compartilhados", t: "Compartilhados", ic: "compartilhar", so: "pode" }, { v: "lixeira", t: "Lixeira", ic: "lixo", so: "pode" },
  ];
  const navVisivel = NAV.filter((n) => !n.so || pode);
  const linksAtivos = (linksQ.dados ?? []).filter((l) => l.ativo && ((l.pasta_id && ativaMemo(l.pasta_id) && mapa.get(l.pasta_id) && !mapa.get(l.pasta_id)!.apagado_em) || (l.arquivo_id && arqMap.get(l.arquivo_id) && !arqMap.get(l.arquivo_id)!.apagado_em)));
  const abrirNovo = (el: HTMLElement) => { const r = el.getBoundingClientRect(); setNovoMenu({ x: Math.max(8, Math.min(r.left, window.innerWidth - 270)), y: Math.min(r.bottom + 6, window.innerHeight - 190) }); };
  const concluidos = envios.filter((e) => e.estado === "ok").length, emAndamento = envios.some((e) => e.estado === "fila" || e.estado === "enviando");

  const itemMenu = (a: Acao, n: number) => (
    <li key={n} className={a.sep ? "mt-1 border-t border-borda pt-1" : ""}>
      <button type="button" onClick={a.onClick} className={`flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-medium hover:bg-[#f1f3f4] ${a.perigo ? "text-alerta" : ""}`}><Icone n={a.icone} tam={18} />{a.rotulo}</button>
    </li>
  );
  const Chapeu = ({ onClose }: { onClose: () => void }) => <div className="fixed inset-0 z-[60]" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />;

  return (
    <div
      onDragEnter={(e) => { if (externo(e)) { profundidade.current++; setArrastando(true); } }}
      onDragOver={(e) => { if (externo(e)) e.preventDefault(); }}
      onDragLeave={(e) => { if (externo(e) && --profundidade.current <= 0) { profundidade.current = 0; setArrastando(false); } }}
      onDrop={async (e) => { if (!externo(e)) return; e.preventDefault(); profundidade.current = 0; setArrastando(false); subir(await lerSoltos(e.dataTransfer)); }}
      className="pt-4"
    >
      <input ref={arquivosRef} type="file" multiple hidden onChange={(e) => { subir(Array.from(e.target.files ?? []).map((f) => ({ f, rel: f.name }))); e.target.value = ""; }} />
      <input ref={pastaRef} type="file" hidden {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} multiple onChange={(e) => { subir(Array.from(e.target.files ?? []).map((f) => ({ f, rel: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name }))); e.target.value = ""; }} />
      <h1 className="sr-only">Organizacional</h1>

      <div className="md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-6">
        {/* ---- lateral (computador) ---- */}
        <aside className="hidden md:block">
          {pode && <button type="button" onClick={(e) => abrirNovo(e.currentTarget)} className="mb-4 flex min-h-14 items-center gap-3 rounded-2xl bg-white px-5 text-[15px] font-bold shadow-[0_1px_3px_rgba(60,64,67,.3),0_4px_8px_3px_rgba(60,64,67,.15)] hover:bg-[#f8f9fa]"><span className="text-marca"><Icone n="mais_grande" tam={26} /></span>Novo</button>}
          <nav className="flex flex-col gap-0.5" aria-label="Seções do drive">
            {navVisivel.map((n) => <button key={n.v} type="button" onClick={() => irPara(n.v)} aria-current={vista === n.v} className={`flex min-h-10 items-center gap-4 rounded-full px-4 text-sm ${vista === n.v ? "bg-marca-clara font-bold text-marca" : "font-medium hover:bg-[#f1f3f4]"}`}><Icone n={n.ic} tam={20} />{n.t}</button>)}
          </nav>
          <div className="mt-6 border-t border-borda px-4 pt-4 text-xs text-suave"><b className="block text-sm text-texto">Armazenamento</b>{tam(usado)} em uso<br />{arqsAtivos.length} arquivo{arqsAtivos.length === 1 ? "" : "s"}</div>
        </aside>

        <section className="min-w-0 pb-4">
          {/* ---- seções (celular) ---- */}
          <div className="mb-3 flex gap-2 overflow-x-auto md:hidden">
            {navVisivel.map((n) => <button key={n.v} type="button" onClick={() => irPara(n.v)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold ${vista === n.v ? "bg-marca-clara text-marca" : "border border-borda bg-white text-suave"}`}><Icone n={n.ic} tam={16} />{n.t}</button>)}
          </div>

          <label className="flex min-h-12 items-center gap-3 rounded-full bg-[#edf2fa] px-5 focus-within:bg-white focus-within:shadow-[0_1px_3px_rgba(60,64,67,.3)]">
            <Icone n="busca" tam={20} />
            <input value={q} onChange={(e) => { setQ(e.target.value); limparSel(); }} placeholder="Pesquisar no Drive" aria-label="Pesquisar no Drive" className="min-w-0 flex-1 bg-transparent outline-none" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Limpar pesquisa" className="h-9 w-9 text-xl font-bold text-suave">×</button>}
          </label>


          {/* ---- cabeçalho: caminho ou barra de seleção ---- */}
          <div className="mt-3 flex min-h-12 flex-wrap items-center gap-2">
            {nSel > 0 && vista !== "compartilhados" ? (
              <div className="flex max-w-full flex-wrap items-center gap-0.5 rounded-full bg-marca-clara px-2 py-1">
                <button type="button" onClick={limparSel} title="Limpar seleção" aria-label="Limpar seleção" className="grid h-10 w-10 place-items-center rounded-full text-lg font-bold hover:bg-black/5">×</button>
                <b className="px-2 text-sm font-medium">{nSel} selecionado{nSel > 1 ? "s" : ""}</b>
                <span className="mx-1 h-6 w-px bg-black/15" />
                {emLixeira ? (
                  <>
                    <BotaoIcone t="Restaurar" ic="restaurar" onClick={() => restaurar(selecionados())} />
                    <BotaoIcone t="Excluir permanentemente" ic="lixo" onClick={() => setConfirma({ itens: selecionados() })} />
                  </>
                ) : (
                  <>
                    {nSel === 1 && <BotaoIcone t="Compartilhar" ic="compartilhar" onClick={() => compartilhar(selecionados()[0])} />}
                    <BotaoIcone t={nSel > 1 || selecionados().some((i) => i.pasta) ? "Baixar (.zip)" : "Baixar"} ic="baixar" onClick={() => baixar(selecionados())} />
                    {pode && vista === "drive" && <BotaoIcone t="Mover para" ic="mover" onClick={() => { setMover(selecionados()); setDestino(undefined); }} />}
                    {pode && <BotaoIcone t="Mover para a lixeira" ic="lixo" onClick={() => paraLixeira(selecionados())} />}
                    <BotaoIcone t="Favoritar" ic="estrela" onClick={() => favoritar(selecionados())} />
                    {nSel === 1 && <BotaoIcone t="Mais ações" ic="mais_v" onClick={(el) => abrirPopover(selecionados()[0], el)} />}
                  </>
                )}
              </div>
            ) : (
              <>
                {vista === "drive" && !nq ? (
                  <nav aria-label="Caminho" className="flex min-w-0 basis-full flex-wrap items-center text-[19px] md:flex-1 md:basis-0">
                    <button type="button" onClick={() => irPara("drive", null)} {...alvoPasta(null)} className={`min-h-10 whitespace-nowrap rounded-full px-3 ${cur === null ? "font-medium" : "text-suave hover:bg-[#f1f3f4]"}`}>Meu Drive</button>
                    {trilhaAtual.map((p, n) => (
                      <span key={p.id} className="flex items-center"><span className="text-suave">›</span>
                        <button type="button" onClick={() => irPara("drive", p.id)} {...alvoPasta(p.id)} className={`min-h-10 rounded-full px-3 ${n === trilhaAtual.length - 1 ? "font-medium" : "text-suave hover:bg-[#f1f3f4]"}`}>{p.nome}</button></span>
                    ))}
                  </nav>
                ) : <h2 className="m-0 min-w-0 basis-full text-[19px] font-medium md:flex-1 md:basis-0">{nq ? `Resultados para “${q}”` : NAV.find((n) => n.v === vista)?.t}</h2>}
                {emLixeira && itens.length > 0 && <Botao v="sec" onClick={() => setConfirma({ itens, todos: true })} className="!min-h-10 !rounded-full !text-alerta">Esvaziar lixeira</Botao>}
                {vista !== "compartilhados" && (
                  <>
                    <select value={`${ordem.c}:${ordem.dir}`} onChange={(e) => { const [c, d] = e.target.value.split(":"); setOrdem({ c: c as "nome" | "data" | "tam", dir: Number(d) as 1 | -1 }); }} aria-label="Ordenar" className="ml-auto min-h-10 rounded-full border border-borda bg-white px-3 text-sm md:hidden"><option value="nome:1">Nome A–Z</option><option value="nome:-1">Nome Z–A</option><option value="data:-1">Mais recentes</option><option value="data:1">Mais antigos</option><option value="tam:-1">Maiores</option></select>
                    <div className="flex overflow-hidden rounded-full border border-borda" role="group" aria-label="Modo de exibição">
                      <button type="button" onClick={() => trocarModo("lista")} aria-pressed={modo === "lista"} title="Lista" aria-label="Exibir em lista" className={`grid h-10 w-12 place-items-center ${modo === "lista" ? "bg-marca-clara text-marca" : "bg-white text-suave"}`}><Icone n="lista" tam={20} /></button>
                      <button type="button" onClick={() => trocarModo("grade")} aria-pressed={modo === "grade"} title="Grade" aria-label="Exibir em grade" className={`grid h-10 w-12 place-items-center border-l border-borda ${modo === "grade" ? "bg-marca-clara text-marca" : "bg-white text-suave"}`}><Icone n="grade" tam={20} /></button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {emLixeira && <p className="mb-2 mt-0 rounded-xl bg-[#f1f3f4] px-4 py-2 text-sm text-suave">Os itens da lixeira podem ser restaurados. Para liberar espaço, exclua permanentemente.</p>}
          {ocupado && <div role="status" className="mb-2 rounded-xl bg-marca-clara px-4 py-2 text-sm font-bold text-marca-esc">{ocupado}</div>}

          {/* ---- conteúdo ---- */}
          {vista === "compartilhados" ? (
            <div className="overflow-hidden rounded-2xl border border-borda bg-white">
              {linksAtivos.length === 0 && <div className="p-6"><Vazio>Nenhum link público ativo. Selecione um item e use Compartilhar.</Vazio></div>}
              {linksAtivos.map((l) => {
                const nomeItem = l.pasta_id ? mapa.get(l.pasta_id)?.nome : arqMap.get(l.arquivo_id!)?.nome;
                return (
                  <div key={l.id} className="flex flex-wrap items-center gap-3 border-b border-borda px-4 py-2 last:border-b-0">
                    <span className="text-[#5f6368]"><Icone n={l.pasta_id ? "pasta" : "arquivo"} tam={22} /></span>
                    <div className="min-w-0 flex-1 leading-tight"><b className="block truncate text-sm font-medium">{nomeItem}</b><span className="text-xs text-suave">Qualquer pessoa com o link · {validade(l)}</span></div>
                    <Botao v="sec" onClick={async () => { try { await navigator.clipboard.writeText(urlLink(l.token)); aviso("Link copiado."); } catch { aviso("Não consegui copiar."); } }} className="!min-h-10 !rounded-full !px-4 !text-sm">Copiar link</Botao>
                    <Botao v="sec" onClick={() => setPartilha({ tipo: l.pasta_id ? "pasta" : "arquivo", id: (l.pasta_id ?? l.arquivo_id)!, nome: nomeItem ?? "" })} className="!min-h-10 !rounded-full !px-4 !text-sm">Gerenciar</Botao>
                  </div>
                );
              })}
            </div>
          ) : itens.length === 0 ? (
            <div className="grid place-items-center gap-2 px-4 py-16 text-center text-suave">
              <span className="text-[#bdc1c6]"><Icone n={emLixeira ? "lixo" : vista === "favoritos" ? "estrela" : "pasta"} tam={72} /></span>
              <b className="text-lg text-texto">{nq || filtro ? "Nenhum resultado" : emLixeira ? "A lixeira está vazia" : vista === "favoritos" ? "Nenhum item com estrela" : vista === "recentes" ? "Nada recente" : pode ? "Um lugar para todos os seus arquivos" : "Esta pasta está vazia"}</b>
              <span className="text-sm">{nq || filtro ? "Tente outros termos ou remova os filtros." : emLixeira ? "" : vista === "favoritos" ? "Adicione estrela aos itens importantes para encontrá-los rápido." : pode && vista === "drive" ? "Arraste arquivos ou pastas para cá, ou use o botão Novo." : ""}</span>
            </div>
          ) : modo === "lista" ? (
            <div className="overflow-hidden rounded-2xl border border-borda bg-white">
              <div className="hidden grid-cols-[minmax(0,1fr)_110px_120px_90px_40px] items-center gap-3 border-b border-borda px-3 py-2 text-xs font-bold text-suave md:grid">
                <button type="button" onClick={() => setOrdem((o) => ({ c: "nome", dir: o.c === "nome" ? (-o.dir as 1 | -1) : 1 }))} className="pl-[52px] text-left hover:text-texto">Nome{ordem.c === "nome" ? (ordem.dir === 1 ? " ↑" : " ↓") : ""}</button>
                <span>Tipo</span>
                <button type="button" onClick={() => setOrdem((o) => ({ c: "data", dir: o.c === "data" ? (-o.dir as 1 | -1) : -1 }))} className="text-left hover:text-texto">Modificado{ordem.c === "data" ? (ordem.dir === 1 ? " ↑" : " ↓") : ""}</button>
                <button type="button" onClick={() => setOrdem((o) => ({ c: "tam", dir: o.c === "tam" ? (-o.dir as 1 | -1) : -1 }))} className="text-left hover:text-texto">Tamanho{ordem.c === "tam" ? (ordem.dir === 1 ? " ↑" : " ↓") : ""}</button>
                <span />
              </div>
              {itens.map(linhaLista)}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {itens.some((i) => i.pasta) && <div><h3 className="mb-2 mt-0 text-sm font-medium text-suave">Pastas</h3><div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">{itens.filter((i) => i.pasta).map(cartaoGrade)}</div></div>}
              {itens.some((i) => i.arq) && <div><h3 className="mb-2 mt-0 text-sm font-medium text-suave">Arquivos</h3><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{itens.filter((i) => i.arq).map(cartaoGrade)}</div></div>}
            </div>
          )}
          <p className="mb-0 mt-3 text-xs text-suave">{toque ? "Toque para abrir. Os três pontos abrem o menu." : "Clique para selecionar, dois cliques para abrir, botão direito para o menu."}</p>
        </section>
      </div>

      {/* ---- botão + (celular) ---- */}
      {pode && vista === "drive" && <button type="button" onClick={(e) => abrirNovo(e.currentTarget)} aria-label="Novo" className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-marca text-white shadow-lg md:hidden"><Icone n="mais_grande" tam={28} /></button>}

      {arrastando && <div className="pointer-events-none fixed inset-0 z-[55] grid place-items-center border-4 border-marca bg-marca/15"><div className="rounded-2xl bg-white px-8 py-6 text-center text-lg font-bold shadow-xl">Solte aqui para fazer upload{cur ? <><br /><span className="text-sm font-medium text-suave">em “{mapa.get(cur)?.nome}”</span></> : <><br /><span className="text-sm font-medium text-suave">em Meu Drive</span></>}</div></div>}

      {/* ---- menu Novo ---- */}
      {novoMenu && (
        <>
          <Chapeu onClose={() => setNovoMenu(null)} />
          <ul role="menu" className="fixed z-[61] m-0 w-64 list-none overflow-hidden rounded-xl bg-white py-2 shadow-[0_2px_10px_rgba(0,0,0,.3)]" style={{ left: novoMenu.x, top: novoMenu.y }}>
            {itemMenu({ rotulo: "Nova pasta", icone: "nova_pasta", onClick: () => { setNovoMenu(null); setNome(""); setNovaPasta(true); } }, 0)}
            {itemMenu({ rotulo: "Upload de arquivo", icone: "subir", sep: true, onClick: () => { setNovoMenu(null); arquivosRef.current?.click(); } }, 1)}
            {itemMenu({ rotulo: "Upload de pasta", icone: "pasta_up", onClick: () => { setNovoMenu(null); pastaRef.current?.click(); } }, 2)}
          </ul>
        </>
      )}

      {/* ---- menu do item (botão direito ou três pontos) ---- */}
      {menu && (toque ? (
        <Janela titulo={menu.item.nome} onFechar={() => setMenu(null)}><ul className="m-0 flex list-none flex-col overflow-y-auto rounded-2xl bg-white p-0 py-1">{acoesDe(menu.item).map(itemMenu)}</ul></Janela>
      ) : (
        <>
          <Chapeu onClose={() => setMenu(null)} />
          <ul role="menu" className="fixed z-[61] m-0 w-64 list-none overflow-hidden rounded-xl bg-white py-2 shadow-[0_2px_10px_rgba(0,0,0,.3)]" style={{ left: menu.x, top: menu.y }}>{acoesDe(menu.item).map(itemMenu)}</ul>
        </>
      ))}

      {prev && <Previa arquivo={prev} lista={listaPrev} onTrocar={(a) => setPrev(arqMap.get(a.id) ?? null)} onFechar={() => setPrev(null)}
        extra={<button type="button" onClick={() => setPartilha({ tipo: "arquivo", id: prev.id, nome: prev.nome })} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-white hover:bg-white/10"><Icone n="compartilhar" tam={20} />Compartilhar</button>} />}
      {partilha && <Compartilhar item={partilha} podeMudar={pode} onFechar={() => setPartilha(null)} onMudou={linksQ.recarregar} />}

      {novaPasta && (
        <Janela titulo="Nova pasta" onFechar={() => setNovaPasta(false)}>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); criarPasta(); }}><Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Pasta sem título" autoFocus /><div className="flex justify-end gap-2"><Botao v="sec" onClick={() => setNovaPasta(false)} className="!rounded-full">Cancelar</Botao><Botao type="submit" className="!rounded-full">Criar</Botao></div></form>
        </Janela>
      )}
      {renomear && (
        <Janela titulo="Renomear" onFechar={() => setRenomear(null)}>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); salvarNome(); }}><Campo rotulo="Novo nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /><div className="flex justify-end gap-2"><Botao v="sec" onClick={() => setRenomear(null)} className="!rounded-full">Cancelar</Botao><Botao type="submit" className="!rounded-full">OK</Botao></div></form>
        </Janela>
      )}
      {mover && (
        <Janela titulo={`Mover ${mover.length === 1 ? `“${mover[0].nome}”` : mover.length + " itens"}`} onFechar={() => setMover(null)}>
          <div className="flex flex-col gap-1.5 overflow-y-auto pb-2">
            <button type="button" onClick={() => setDestino(null)} className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 text-left font-bold ${destino === null ? "border-marca bg-marca-clara" : "border-borda bg-white"}`}><Icone n="pasta" tam={18} />Meu Drive</button>
            {arvoreMover.map(({ p, nivel }) => (
              <button key={p.id} type="button" onClick={() => setDestino(p.id)} style={{ marginLeft: (nivel + 1) * 16 }} className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 text-left font-medium ${destino === p.id ? "border-marca bg-marca-clara" : "border-borda bg-white"}`}><span className="text-[#5f6368]"><Icone n="pasta" tam={18} /></span>{p.nome}</button>
            ))}
            <div className="flex justify-end gap-2 pt-2"><Botao v="sec" onClick={() => setMover(null)} className="!rounded-full">Cancelar</Botao><Botao disabled={destino === undefined} onClick={() => destino !== undefined && moverPara(mover, destino)} className="!rounded-full">Mover</Botao></div>
          </div>
        </Janela>
      )}
      {detalhes && (
        <Janela titulo="Informações" onFechar={() => setDetalhes(null)}>
          <dl className="m-0 flex flex-col gap-3 overflow-y-auto pb-2 text-sm">
            <div className="flex items-center gap-3">{iconeItem(detalhes, true)}<b className="break-all text-base">{detalhes.nome}</b></div>
            {([["Tipo", aoVivo(detalhes)], ["Local", caminhoTxt(detalhes.pasta ? detalhes.pasta.pai_id : detalhes.arq!.area_id)], ...(detalhes.arq ? [["Tamanho", tam(detalhes.tam)]] : [["Itens dentro", String(pastasAtivas.filter((p) => p.pai_id === detalhes.id).length + arqsAtivos.filter((a) => a.area_id === detalhes.id).length)]]), ["Modificado", dataBr(detalhes.data)], ["Criado", dataBr(detalhes.pasta?.criado_em ?? detalhes.arq!.criado_em)]] as string[][]).map(([r, v]) => <div key={r} className="flex justify-between gap-4 border-b border-borda pb-2 last:border-0"><dt className="text-suave">{r}</dt><dd className="m-0 text-right font-medium">{v}</dd></div>)}
            <div><Botao v="sec" onClick={async () => { try { await navigator.clipboard.writeText(urlInterno(tipoFav(detalhes.k), detalhes.id)); aviso("Link copiado."); } catch { aviso("Não consegui copiar."); } }} className="!min-h-10 !rounded-full !text-sm">Copiar link interno</Botao></div>
          </dl>
        </Janela>
      )}
      {confirma && (
        <Janela titulo={confirma.todos ? "Esvaziar a lixeira?" : "Excluir permanentemente?"} onFechar={() => setConfirma(null)}>
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm">{confirma.todos ? `Os ${confirma.itens.length} itens da lixeira` : confirma.itens.length === 1 ? `“${confirma.itens[0].nome}”` : `${confirma.itens.length} itens`} {confirma.itens.some((i) => i.pasta) ? "(com tudo que há dentro das pastas) " : ""}serão excluídos para sempre e os links deles deixam de funcionar. Não dá para desfazer.</p>
            <div className="flex justify-end gap-2"><Botao v="sec" onClick={() => setConfirma(null)} className="!rounded-full">Cancelar</Botao><Botao v="perigo" disabled={!!ocupado} onClick={() => apagarDeVez(confirma.itens)} className="!rounded-full">{ocupado || "Excluir"}</Botao></div>
          </div>
        </Janela>
      )}

      {/* ---- bandeja de uploads ---- */}
      {envios.length > 0 && (
        <div className="fixed bottom-24 left-4 right-20 z-30 overflow-hidden rounded-xl bg-white shadow-[0_2px_10px_rgba(0,0,0,.3)] md:bottom-6 md:left-auto md:right-6 md:w-80">
          <div className="flex items-center gap-2 bg-[#202124] px-4 py-2.5 text-sm text-white">
            <b className="flex-1 font-medium">{emAndamento ? `Fazendo upload de ${envios.length} ${envios.length === 1 ? "item" : "itens"}` : `${concluidos} ${concluidos === 1 ? "upload concluído" : "uploads concluídos"}`}</b>
            <button type="button" onClick={() => setBandejaAberta((a) => !a)} aria-label={bandejaAberta ? "Recolher" : "Expandir"} className="h-8 w-8 rounded-full hover:bg-white/10">{bandejaAberta ? "▾" : "▴"}</button>
            <button type="button" onClick={() => setEnvios([])} aria-label="Fechar" className="h-8 w-8 rounded-full text-lg hover:bg-white/10">×</button>
          </div>
          {bandejaAberta && <ul className="m-0 max-h-60 list-none overflow-y-auto p-0">{envios.map((e) => (
            <li key={e.id} className="flex items-center gap-3 border-b border-borda px-4 py-2 text-sm last:border-b-0"><span className="min-w-0 flex-1 truncate">{e.nome}</span>
              <span className={e.estado === "ok" ? "font-bold text-green-700" : e.estado === "erro" ? "font-bold text-alerta" : "text-suave"}>{e.estado === "ok" ? "✓" : e.estado === "erro" ? "Falhou" : e.estado === "enviando" ? "…" : "Na fila"}</span></li>))}</ul>}
        </div>
      )}
    </div>
  );
}

function BotaoIcone({ t, ic, onClick }: { t: string; ic: string; onClick: (el: HTMLElement) => void }) {
  return <button type="button" title={t} aria-label={t} onClick={(e) => onClick(e.currentTarget)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5"><Icone n={ic} tam={20} /></button>;
}
