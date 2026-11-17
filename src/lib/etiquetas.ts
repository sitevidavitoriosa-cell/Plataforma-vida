/** Etiquetas de cama (só o nome do encontrista): folha de etiquetas adesivas com medidas ajustáveis (colunas, linhas, margens e espaços em milímetros). */
export type Cfg = {
  papel: "a4" | "carta";
  colunas: number; linhas: number;
  larg: number; alt: number;           // tamanho de cada etiqueta
  topo: number; esq: number;           // margem da folha até a primeira etiqueta
  espCol: number; espLin: number;      // espaço entre colunas / entre linhas
  ajusteX: number; ajusteY: number;    // ajuste fino para a impressora (desloca tudo)
  fonte: number;                       // escala dos textos (%)
  faixa: boolean; borda: boolean;
};
export type Etq = { nome: string };
export type Rect = { x: number; y: number; w: number; h: number };
export type Prim =
  | { t: "ret"; x: number; y: number; w: number; h: number; cor: string }
  | { t: "linha"; x1: number; y1: number; x2: number; y2: number; cor: string }
  | { t: "texto"; x: number; y: number; pt: number; negrito: boolean; cor: string; texto: string; centro?: boolean };

export const PAPEL = { a4: { w: 210, h: 297, nome: "A4" }, carta: { w: 215.9, h: 279.4, nome: "Carta" } };

/** Folhas adesivas conhecidas. `conferida` = medidas do fabricante; `estimada` = tamanho e quantidade vêm do fabricante, mas as margens foram calculadas (use o teste de alinhamento). */
export type Modelo = { id: string; marca: string; codigo: string; nome: string; papel: "a4" | "carta"; c: Partial<Cfg>; nota?: string };
// 25,4 × 63,5 mm, A4, 33 por folha (3 colunas × 11 linhas): Pimaco A4256/A4356, Colacril CA4156/CA4256/CA4356/8042, Maxprint A4356
const G_A4_33: Partial<Cfg> = { colunas: 3, linhas: 11, larg: 63.5, alt: 25.4, topo: 8.8, esq: 9.75, espCol: 0, espLin: 0 };
const NOTA_A4_33 = "Tamanho (25,4 × 63,5 mm) e 33 por folha vêm do fabricante; as margens são estimadas (centralizadas na folha A4). Imprima o teste de alinhamento e use o ajuste fino.";
// 25,4 × 66,7 mm, Carta, 30 por folha (3 × 10): Pimaco 6180, Colacril CC080/CC180/CC280/8005, Maxprint 6180 (mesma grade da Avery 5160)
const G_CARTA_30: Partial<Cfg> = { colunas: 3, linhas: 10, larg: 66.7, alt: 25.4, topo: 12.7, esq: 4.8, espCol: 3.2, espLin: 0 };
const NOTA_CARTA_30 = "Folha Carta, 25,4 × 66,7 mm, 30 por folha. Margens da grade padrão 6180/5160; confira com o teste de alinhamento.";
export const MODELOS: Modelo[] = [
  { id: "pimaco-a4256", marca: "Pimaco", codigo: "A4256", nome: "Pimaco A4256 · 25,4 × 63,5 mm · A4 · 33 por folha", papel: "a4", c: G_A4_33, nota: NOTA_A4_33 },
  { id: "pimaco-a4356", marca: "Pimaco", codigo: "A4356", nome: "Pimaco A4356 · 25,4 × 63,5 mm · A4 · 33 por folha", papel: "a4", c: G_A4_33, nota: NOTA_A4_33 },
  { id: "pimaco-6180", marca: "Pimaco", codigo: "6180", nome: "Pimaco 6180 · 25,4 × 66,7 mm · Carta · 30 por folha", papel: "carta", c: G_CARTA_30, nota: NOTA_CARTA_30 },
  { id: "colacril-ca4256", marca: "Colacril", codigo: "CA4256", nome: "Colacril CA4256 · 25,4 × 63,5 mm · A4 · 33 por folha", papel: "a4", c: G_A4_33, nota: NOTA_A4_33 },
  { id: "colacril-ca4356", marca: "Colacril", codigo: "CA4356", nome: "Colacril CA4356 · 25,4 × 63,5 mm · A4 · 33 por folha", papel: "a4", c: G_A4_33, nota: NOTA_A4_33 },
  { id: "colacril-ca4156", marca: "Colacril", codigo: "CA4156", nome: "Colacril CA4156 · 25,4 × 63,5 mm · A4 · 33 por folha", papel: "a4", c: G_A4_33, nota: NOTA_A4_33 },
  { id: "colacril-8042", marca: "Colacril", codigo: "8042", nome: "Colacril 8042 · 25,4 × 63,5 mm · A4 · 33 por folha", papel: "a4", c: G_A4_33, nota: NOTA_A4_33 },
  { id: "colacril-cc180", marca: "Colacril", codigo: "CC180", nome: "Colacril CC080/CC180/CC280 · 25,4 × 66,7 mm · Carta · 30 por folha", papel: "carta", c: G_CARTA_30, nota: NOTA_CARTA_30 },
  { id: "maxprint-a4356", marca: "Maxprint", codigo: "A4356", nome: "Maxprint A4356 · 25,4 × 63,5 mm · A4 · 33 por folha", papel: "a4", c: G_A4_33, nota: NOTA_A4_33 },
  { id: "maxprint-6180", marca: "Maxprint", codigo: "6180", nome: "Maxprint 6180 · 25,4 × 66,7 mm · Carta · 30 por folha", papel: "carta", c: G_CARTA_30, nota: NOTA_CARTA_30 },
  { id: "avery-l7160", marca: "Avery", codigo: "L7160", nome: "Avery L7160 · 63,5 × 38,1 mm · A4 · 21 por folha", papel: "a4", c: { colunas: 3, linhas: 7, larg: 63.5, alt: 38.1, topo: 15.1, esq: 7.2, espCol: 2.5, espLin: 0 } },
  { id: "avery-l7163", marca: "Avery", codigo: "L7163", nome: "Avery L7163 · 99,1 × 38,1 mm · A4 · 14 por folha", papel: "a4", c: { colunas: 2, linhas: 7, larg: 99.1, alt: 38.1, topo: 15.1, esq: 4.65, espCol: 2.5, espLin: 0 } },
  { id: "avery-l7651", marca: "Avery", codigo: "L7651", nome: "Avery L7651 · 38,1 × 21,2 mm · A4 · 65 por folha", papel: "a4", c: { colunas: 5, linhas: 13, larg: 38.1, alt: 21.2, topo: 10.7, esq: 4.75, espCol: 2.5, espLin: 0 } },
  { id: "comum", marca: "Folha comum", codigo: "", nome: "Folha comum A4 · 2 × 6, 100 × 45 mm (recortar)", papel: "a4", c: { colunas: 2, linhas: 6, larg: 100, alt: 45, topo: 13.5, esq: 5, espCol: 0, espLin: 0 } },
];
export const MARCAS = Array.from(new Set(MODELOS.map((m) => m.marca)));
export const CFG_PADRAO: Cfg = { papel: "a4", colunas: 3, linhas: 11, larg: 63.5, alt: 25.4, topo: 8.8, esq: 9.75, espCol: 0, espLin: 0, ajusteX: 0, ajusteY: 0, fonte: 100, faixa: false, borda: false };

export const porPagina = (c: Cfg) => Math.max(1, Math.floor(c.colunas) * Math.floor(c.linhas));
/** Posição de cada etiqueta da folha (linha por linha, da esquerda para a direita). */
export function posicoes(c: Cfg): Rect[] {
  const out: Rect[] = [];
  for (let l = 0; l < Math.floor(c.linhas); l++) for (let k = 0; k < Math.floor(c.colunas); k++)
    out.push({ x: c.esq + c.ajusteX + k * (c.larg + c.espCol), y: c.topo + c.ajusteY + l * (c.alt + c.espLin), w: c.larg, h: c.alt });
  return out;
}
/** Avisa quando a grade passa da folha. */
export function conferir(c: Cfg): string | null {
  const p = PAPEL[c.papel];
  const largTotal = c.esq + c.colunas * c.larg + (c.colunas - 1) * c.espCol, altTotal = c.topo + c.linhas * c.alt + (c.linhas - 1) * c.espLin;
  if (c.larg <= 0 || c.alt <= 0 || c.colunas < 1 || c.linhas < 1) return "Colunas, linhas e o tamanho da etiqueta precisam ser maiores que zero.";
  if (largTotal + c.ajusteX > p.w + 0.05) return `A grade passa da largura da folha (${largTotal.toFixed(1)} mm de ${p.w} mm).`;
  if (altTotal + c.ajusteY > p.h + 0.05) return `A grade passa da altura da folha (${altTotal.toFixed(1)} mm de ${p.h} mm).`;
  return null;
}

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);
/** Primeiro nome inteiro, nomes do meio só com a inicial e o último sobrenome inteiro. Ex.: "João Pedro da Silva Albuquerque" → "João P. S. Albuquerque". */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (partes.length <= 2) return partes.join(" ");
  const meio = partes.slice(1, -1).filter((p) => !PARTICULAS.has(p.toLowerCase())).map((p) => p[0].toLocaleUpperCase("pt-BR") + ".");
  return [partes[0], ...meio, partes[partes.length - 1]].join(" ");
}
/** Uma etiqueta por encontrista, em ordem alfabética, com o nome abreviado. */
export const montar = (nomes: string[]): Etq[] => nomes.slice().sort((a, b) => a.localeCompare(b, "pt-BR")).map((nome) => ({ nome: nomeCurto(nome) }));

const MM_PT = 25.4 / 72;
type Medir = (texto: string, pt: number, negrito: boolean) => number; // largura em mm

/** Maior tamanho (pt) em que o texto cabe na largura, entre mínimo e máximo. */
export function ajustar(texto: string, larguraMm: number, max: number, min: number, medir: Medir, negrito = true): number {
  let pt = max;
  while (pt > min && medir(texto, pt, negrito) > larguraMm) pt -= 0.5;
  return Math.max(min, pt);
}

/** Desenho de uma etiqueta: só o nome, centralizado, em uma linha, no maior tamanho que couber (fonte pequena). */
export function desenhar(r: Rect, e: Etq, c: Cfg, cor: string, medir: Medir): Prim[] {
  const p: Prim[] = [];
  const esc = c.fonte / 100;
  const faixa = c.faixa ? Math.min(3.2, r.w * 0.06) : 0;
  const pad = Math.min(2.5, r.w * 0.05);
  const larg = r.w - faixa - 2 * pad, cx = r.x + faixa + pad + larg / 2;
  if (c.faixa) p.push({ t: "ret", x: r.x, y: r.y, w: faixa, h: r.h, cor });
  const nome = e.nome.trim().replace(/\s+/g, " ");
  const pt = ajustar(nome, larg, Math.min(11, (r.h * 0.3) / MM_PT) * esc, 4, medir);
  p.push({ t: "texto", x: cx, y: r.y + r.h / 2 + pt * MM_PT * 0.35, pt, negrito: true, cor: "#111111", texto: nome, centro: true });
  return p;
}

const rgb = (h: string): [number, number, number] => { const m = /^#?([0-9a-f]{6})$/i.exec(h); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [22, 41, 77]; };

/** PDF com todas as etiquetas (`inicio` = número da etiqueta da primeira folha por onde começar, para aproveitar folha usada). `teste` imprime só os contornos para conferir o alinhamento. */
export async function pdfEtiquetas(c: Cfg, etqs: Etq[], cor: string, inicio = 1, teste = false): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pp = PAPEL[c.papel];
  const d = new jsPDF({ unit: "mm", format: [pp.w, pp.h], orientation: "portrait" });
  const medir: Medir = (t, pt, n) => { d.setFont("helvetica", n ? "bold" : "normal"); d.setFontSize(pt); return d.getTextWidth(t); };
  const slots = posicoes(c), n = slots.length;
  const lista: (Etq | null)[] = [...Array(Math.max(0, Math.min(n - 1, inicio - 1))).fill(null), ...(teste ? Array(n).fill({ nome: "" }) : etqs)];
  const paginas = Math.max(1, Math.ceil(lista.length / n));
  for (let pg = 0; pg < paginas; pg++) {
    if (pg > 0) d.addPage([pp.w, pp.h], "portrait");
    slots.forEach((r, i) => {
      const e = lista[pg * n + i];
      if (e === undefined) return;
      if (e === null) return;
      if (teste || c.borda) { d.setDrawColor(150, 150, 150); d.setLineWidth(0.2); d.rect(r.x, r.y, r.w, r.h); }
      if (teste) { d.setFont("helvetica", "normal"); d.setFontSize(7); d.setTextColor(120, 120, 120); d.text(`${i + 1}`, r.x + 2, r.y + 4); return; }
      desenhar(r, e, c, cor, medir).forEach((f) => {
        if (f.t === "ret") { d.setFillColor(...rgb(f.cor)); d.rect(f.x, f.y, f.w, f.h, "F"); }
        else if (f.t === "linha") { d.setDrawColor(...rgb(f.cor)); d.setLineWidth(0.25); d.line(f.x1, f.y1, f.x2, f.y2); }
        else { d.setFont("helvetica", f.negrito ? "bold" : "normal"); d.setFontSize(f.pt); d.setTextColor(...rgb(f.cor)); d.text(f.texto, f.x, f.y, f.centro ? { align: "center" } : undefined); }
      });
    });
  }
  return d.output("blob");
}

/** Medidor para a prévia na tela (mesma fonte, tamanho proporcional). */
export function medirTela(): Medir {
  const cv = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  return (t, pt, n) => {
    if (!cv) return t.length * pt * MM_PT * 0.55;
    cv.font = `${n ? "bold " : ""}100px Helvetica, Arial, sans-serif`;
    return (cv.measureText(t).width / 100) * pt * MM_PT;
  };
}
export const ptParaMm = (pt: number) => pt * MM_PT;
