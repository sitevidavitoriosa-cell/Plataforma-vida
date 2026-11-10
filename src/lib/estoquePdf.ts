import { temaDe, descricaoEd } from "./cores";
import type { Edicao } from "./tipos";

/** PDF de uma lista de estoque (lista mãe, retirada, balanço ou material de equipe): A4 retrato, agrupado por setor, pronto para imprimir e conferir à mão. */
export type ColunaPdf = { t: string; w: number; dir?: boolean; caixa?: boolean };
export type LinhaPdf = { cel: string[]; alerta?: boolean };
export type GrupoPdf = { nome: string; linhas: LinhaPdf[] };
export type ListaPdf = {
  ed: Edicao | null;
  titulo: string;            // ex.: "Lista mãe do estoque"
  subtitulo?: string;        // ex.: "Retirada para a edição"
  resumo: { rotulo: string; valor: string; alerta?: boolean }[];
  colunas: ColunaPdf[];      // a 1ª coluna é o nome (quebra de linha automática); a soma de w deve ser 186
  grupos: GrupoPdf[];
};

const hexRgb = (h: string): [number, number, number] => { const m = /^#?([0-9a-f]{6})$/i.exec(h); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [22, 41, 77]; };
const mistura = (c: [number, number, number], t: number): [number, number, number] => [Math.round(c[0] + (255 - c[0]) * t), Math.round(c[1] + (255 - c[1]) * t), Math.round(c[2] + (255 - c[2]) * t)];

export async function pdfLista(l: ListaPdf): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const d = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 12, util = W - 2 * M;
  const marca = hexRgb(temaDe(l.ed).marca);
  const clara = mistura(marca, 0.9);
  const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const total = l.grupos.reduce((s, g) => s + g.linhas.length, 0);
  let y = 0, pagina = 1;

  const rodape = () => {
    d.setFont("helvetica", "normal"); d.setFontSize(8); d.setTextColor(140, 140, 140);
    d.text("Vida Vitoriosa · Plataforma de Gestão", M, H - 7);
    d.text(`Página ${pagina}`, W - M, H - 7, { align: "right" });
    d.setDrawColor(225, 225, 225); d.line(M, H - 10.5, W - M, H - 10.5);
  };
  const cabecalhoTabela = () => {
    d.setFillColor(45, 45, 50); d.rect(M, y, util, 7, "F");
    d.setTextColor(255, 255, 255); d.setFont("helvetica", "bold"); d.setFontSize(8);
    let x = M;
    l.colunas.forEach((c, i) => {
      if (c.dir) d.text(c.t.toUpperCase(), x + c.w - 2, y + 4.7, { align: "right" }); else d.text(c.t.toUpperCase(), x + (i === 0 ? 3 : 1.5), y + 4.7);
      x += c.w;
    });
    y += 7;
  };
  const novaPagina = () => { rodape(); d.addPage(); pagina++; y = M; cabecalhoTabela(); };

  // faixa de topo
  d.setFillColor(...marca); d.rect(0, 0, W, 30, "F");
  d.setTextColor(255, 255, 255); d.setFont("helvetica", "bold"); d.setFontSize(20); d.text(l.titulo, M, 13);
  d.setFont("helvetica", "normal"); d.setFontSize(10);
  d.text([l.ed ? `${l.ed.nome} · ${descricaoEd(l.ed)}` : "Todas as edições", l.subtitulo].filter(Boolean).join("  ·  "), M, 20);
  d.setFontSize(8.5); d.text(`Gerado em ${agora}  ·  ${total} ${total === 1 ? "item" : "itens"}`, M, 26);
  d.setFont("helvetica", "bold"); d.setFontSize(11); d.text("VIDA VITORIOSA", W - M, 13, { align: "right" });
  y = 36;

  // cartões de resumo
  if (l.resumo.length) {
    const n = l.resumo.length, gap = 3, cw = (util - gap * (n - 1)) / n;
    l.resumo.forEach((r, i) => {
      const x = M + i * (cw + gap);
      d.setFillColor(...clara); d.roundedRect(x, y, cw, 15, 2.5, 2.5, "F");
      d.setTextColor(100, 100, 100); d.setFont("helvetica", "normal"); d.setFontSize(7.5); d.text(r.rotulo.toUpperCase(), x + 3, y + 5);
      if (r.alerta) d.setTextColor(200, 50, 40); else d.setTextColor(...marca);
      d.setFont("helvetica", "bold"); d.setFontSize(13); d.text(r.valor, x + 3, y + 12);
    });
    y += 21;
  }

  cabecalhoTabela();
  d.setFontSize(9);
  l.grupos.forEach((g) => {
    if (g.linhas.length === 0) return;
    if (y + 7 + 10 > H - 14) novaPagina();
    d.setFillColor(...clara); d.rect(M, y, util, 6.5, "F");
    d.setFillColor(...marca); d.rect(M, y, 1.4, 6.5, "F");
    d.setTextColor(...marca); d.setFont("helvetica", "bold"); d.setFontSize(9.5);
    d.text(`${g.nome}  (${g.linhas.length})`, M + 4, y + 4.6);
    y += 6.5;
    g.linhas.forEach((ln, idx) => {
      d.setFont("helvetica", "normal"); d.setFontSize(9);
      const nomeLin = d.splitTextToSize(ln.cel[0] ?? "", l.colunas[0].w - 5) as string[];
      const h = Math.max(6.6, nomeLin.length * 4 + 2.6);
      if (y + h > H - 14) { novaPagina(); }
      if (idx % 2 === 1) { d.setFillColor(248, 248, 249); d.rect(M, y, util, h, "F"); }
      let x = M;
      l.colunas.forEach((c, i) => {
        const v = ln.cel[i] ?? "";
        if (c.caixa) { d.setDrawColor(120, 120, 120); d.setLineWidth(0.25); d.rect(x + c.w / 2 - 2, y + h / 2 - 2, 4, 4); }
        else if (i === 0) { d.setTextColor(30, 30, 35); d.setFont("helvetica", "bold"); d.text(nomeLin, x + 3, y + 4.6); }
        else {
          const bad = ln.alerta && (!!c.dir || i === l.colunas.length - 1);
          d.setFont("helvetica", bad ? "bold" : "normal"); d.setTextColor(bad ? 200 : 60, bad ? 50 : 60, bad ? 40 : 65);
          if (c.dir) d.text(v, x + c.w - 2, y + 4.6, { align: "right" }); else d.text(d.splitTextToSize(v, c.w - 2)[0] ?? "", x + 1.5, y + 4.6);
        }
        x += c.w;
      });
      d.setDrawColor(232, 232, 235); d.setLineWidth(0.15); d.line(M, y + h, W - M, y + h);
      y += h;
    });
    y += 2.5;
  });
  if (total === 0) { d.setTextColor(120, 120, 120); d.setFont("helvetica", "italic"); d.text("Nenhum item nesta lista.", M, y + 8); }
  rodape();
  return d.output("blob");
}

export function baixarBlob(blob: Blob, nome: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}
export const nomeArq = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
