import { supabase } from "@/lib/supabase";

export const BUCKET = "organizacional";
export const LIMITE = 50 * 1024 * 1024;

export type Pasta = { id: string; nome: string; pai_id: string | null; apagado_em: string | null; criado_em: string };
export type Arq = { id: string; area_id: string | null; nome: string; caminho: string; tamanho: number; tipo: string | null; criado_em: string; apagado_em: string | null };
/** Arquivo como a prévia precisa (serve para o drive e para o link público). */
export type ArqPrev = { id: string; nome: string; caminho: string; tamanho: number; tipo: string | null; criado_em: string };

export const tam = (b: number) =>
  b >= 1073741824 ? `${(b / 1073741824).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`
  : b >= 1048576 ? `${(b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`
  : `${Math.max(1, Math.round(b / 1024))} KB`;
export const dataBr = (s: string) => new Date(s).toLocaleDateString("pt-BR");
export const extDe = (n: string) => (n.includes(".") ? n.split(".").pop()!.toLowerCase() : "");
export const seguro = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type Tipo = "imagem" | "pdf" | "video" | "audio" | "texto" | "docx" | "planilha" | "slides" | "zip" | "outro";
export function tipoDe(a: { nome: string; tipo?: string | null }): Tipo {
  const e = extDe(a.nome), m = a.tipo ?? "";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(e)) return "imagem";
  if (m === "application/pdf" || e === "pdf") return "pdf";
  if (m.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(e)) return "video";
  if (m.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac"].includes(e)) return "audio";
  if (e === "docx") return "docx";
  if (["xlsx", "xls", "csv"].includes(e)) return "planilha";
  if (["pptx", "ppt"].includes(e)) return "slides";
  if (["zip", "rar", "7z"].includes(e)) return "zip";
  if (m.startsWith("text/") || ["txt", "md", "json", "log", "xml", "rtf"].includes(e)) return "texto";
  return "outro";
}
export const COR_TIPO: Record<Tipo, string> = { imagem: "#7c3aed", pdf: "#dc2626", video: "#db2777", audio: "#0891b2", texto: "#475569", docx: "#2563eb", planilha: "#16a34a", slides: "#ea580c", zip: "#a16207", outro: "#64748b" };
export const ROTULO_TIPO: Record<Tipo, string> = { imagem: "Imagem", pdf: "PDF", video: "Vídeo", audio: "Áudio", texto: "Texto", docx: "Word", planilha: "Planilha", slides: "Apresentação", zip: "Compactado", outro: "Arquivo" };
export const podeImprimir = (t: Tipo) => ["imagem", "pdf", "texto", "docx", "planilha"].includes(t);

export async function assinar(caminho: string, baixarComo?: string, seg = 300): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, seg, baixarComo ? { download: baixarComo } : undefined);
  return error || !data ? null : data.signedUrl;
}
export async function baixarArquivo(a: { nome: string; caminho: string }): Promise<boolean> {
  const u = await assinar(a.caminho, a.nome);
  if (!u) return false;
  const l = document.createElement("a"); l.href = u; l.download = a.nome; document.body.appendChild(l); l.click(); l.remove();
  return true;
}
export async function buscarBlob(caminho: string): Promise<Blob | null> {
  const u = await assinar(caminho);
  if (!u) return null;
  try { const r = await fetch(u); return r.ok ? await r.blob() : null; } catch { return null; }
}

/** Imprime um HTML qualquer numa moldura escondida (sem sair da página). */
export function imprimirHtml(html: string) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open(); d.write(html); d.close();
  const rodar = () => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } finally { setTimeout(() => f.remove(), 60000); } };
  const imgs = Array.from(d.images);
  if (imgs.length === 0 || imgs.every((i) => i.complete)) setTimeout(rodar, 150);
  else { let n = imgs.filter((i) => !i.complete).length; imgs.forEach((i) => { if (!i.complete) i.onload = i.onerror = () => { if (--n === 0) rodar(); }; }); }
}
export const CSS_IMPRESSAO = "body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:18px}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 7px;vertical-align:top}img{max-width:100%}h1,h2,h3{margin:.6em 0 .3em}p{margin:.4em 0}pre{white-space:pre-wrap;word-wrap:break-word}";
export const htmlTexto = (t: string) => `<pre>${esc(t)}</pre>`;

/** Gera o conteúdo legível de docx/planilha/texto para pré-visualizar e imprimir. */
export async function htmlDe(a: { nome: string; tipo?: string | null }, blob: Blob): Promise<string> {
  const t = tipoDe(a);
  if (t === "docx") {
    const mammoth = await import("mammoth");
    const r = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
    return r.value;
  }
  if (t === "planilha") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
    return wb.SheetNames.slice(0, 12).map((n) => `<h3>${esc(n)}</h3>${XLSX.utils.sheet_to_html(wb.Sheets[n], { header: "", footer: "" }).replace(/^[\s\S]*?<table/i, "<table").replace(/<\/table>[\s\S]*$/i, "</table>")}`).join("");
  }
  return htmlTexto((await blob.text()).slice(0, 400000));
}

export type NoZip = { nome: string; caminho?: string; filhos?: NoZip[] };
/** Baixa vários arquivos/pastas como um .zip (mantém as subpastas). */
export async function baixarZip(nome: string, raiz: NoZip[], progresso?: (feito: number, total: number) => void): Promise<boolean> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const lista: { caminho: string; destino: string }[] = [];
  const usados = new Set<string>();
  const unico = (dest: string) => { let d = dest, i = 1; while (usados.has(d.toLowerCase())) { const p = dest.lastIndexOf("."); d = p > 0 ? `${dest.slice(0, p)} (${i})${dest.slice(p)}` : `${dest} (${i})`; i++; } usados.add(d.toLowerCase()); return d; };
  const limpa = (n: string) => n.replace(/[\\/:*?"<>|]/g, "_");
  const andar = (nos: NoZip[], base: string) => nos.forEach((n) => {
    if (n.filhos) { zip.folder(base + limpa(n.nome)); andar(n.filhos, base + limpa(n.nome) + "/"); }
    else if (n.caminho) lista.push({ caminho: n.caminho, destino: unico(base + limpa(n.nome)) });
  });
  andar(raiz, "");
  if (lista.length === 0) return false;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(lista.map((l) => l.caminho), 600);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  let feito = 0;
  for (const l of lista) {
    const u = urls.get(l.caminho);
    if (!u) return false;
    const r = await fetch(u);
    if (!r.ok) return false;
    zip.file(l.destino, await r.blob());
    progresso?.(++feito, lista.length);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = limpa(nome) + ".zip"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  return true;
}
