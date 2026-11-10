import { temaDe, descricaoEd } from "./cores";
import type { Edicao } from "./tipos";

export type LinhaSaude = { id: string; nome: string; idade: number | null; categoria: string | null; necessidade: string | null; contatos: string[] | null; observacao: string | null; quarto: string | null };

export const TAGS: Record<string, RegExp> = {
  Medicação: /medic|rem[eé]dio|insulin|press[aã]o|diabet|asma|epilep|convuls|hormon|tarja|comprimid|uso cont/i,
  Alimentar: /alerg|alimen|intoler|lactose|gl[uú]ten|vegetar|dieta|cel[ií]ac|amendoim|camar/i,
  Locomoção: /cadeira|locomo|mobilid|muleta|bengala|andar|joelho|cirurg|fratura|coluna/i,
};
export const tagsDe = (t: string | null) => Object.entries(TAGS).filter(([, r]) => r.test(t ?? "")).map(([k]) => k);
const COR_TAG: Record<string, [number, number, number]> = { Medicação: [214, 40, 40], Alimentar: [217, 119, 6], Locomoção: [31, 111, 235] };
const hexRgb = (h: string): [number, number, number] => { const m = /^#?([0-9a-f]{6})$/i.exec(h); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [31, 111, 235]; };

/** PDF para imprimir (A4 paisagem): uma linha por pessoa com quarto, necessidade e contatos de emergência, em ordem alfabética. */
export async function pdfSaude(ed: Edicao, linhas: LinhaSaude[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const d = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297, H = 210, M = 10;
  const marca = hexRgb(temaDe(ed).marca);
  const cols = [{ t: "Nome", x: M + 4, w: 56 }, { t: "Quarto", x: M + 60, w: 24 }, { t: "Necessidade de saúde", x: M + 84, w: 84 }, { t: "Contato de emergência", x: M + 168, w: 66 }, { t: "Obs. da saúde", x: M + 234, w: 43 }];
  const ordenadas = linhas.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  const topo = (primeira: boolean) => {
    let y = M;
    if (primeira) {
      d.setFillColor(...marca); d.rect(0, 0, W, 22, "F");
      d.setTextColor(255, 255, 255); d.setFont("helvetica", "bold"); d.setFontSize(18); d.text(`Saúde · ${ed.nome}`, M, 11);
      d.setFont("helvetica", "normal"); d.setFontSize(9.5);
      d.text(`${descricaoEd(ed)} · ${ordenadas.length} ${ordenadas.length === 1 ? "pessoa com necessidade" : "pessoas com necessidade"} · gerado em ${agora}`, M, 17.5);
      d.setFont("helvetica", "bold"); d.setFontSize(8.5); d.text("DOCUMENTO RESERVADO", W - M, 11, { align: "right" });
      d.setFont("helvetica", "normal"); d.text("Dados de saúde: não compartilhar", W - M, 16, { align: "right" });
      y = 27;
    }
    d.setFillColor(40, 40, 40); d.rect(M, y, W - 2 * M, 7, "F");
    d.setTextColor(255, 255, 255); d.setFont("helvetica", "bold"); d.setFontSize(9);
    cols.forEach((c) => d.text(c.t.toUpperCase(), c.x, y + 4.8));
    return y + 7;
  };

  let y = topo(true);
  d.setTextColor(0, 0, 0);
  ordenadas.forEach((l, i) => {
    d.setFontSize(9.5);
    const nec = d.splitTextToSize(l.necessidade || "Não informado", cols[2].w - 2) as string[];
    const cont = (l.contatos ?? []).flatMap((c) => d.splitTextToSize(c, cols[3].w - 2) as string[]);
    const obs = d.splitTextToSize(l.observacao ?? "", cols[4].w - 2) as string[];
    const tags = tagsDe(l.necessidade);
    const nome = d.splitTextToSize(l.nome, cols[0].w - 2) as string[];
    const linhasTxt = Math.max(nec.length, cont.length || 1, obs.length || 1, nome.length + 1);
    const h = Math.max(13, linhasTxt * 4.3 + 4 + (tags.length ? 5 : 0));
    if (y + h > H - 12) { d.addPage(); y = topo(false); }
    if (i % 2 === 0) { d.setFillColor(244, 244, 241); d.rect(M, y, W - 2 * M, h, "F"); }
    const cor = COR_TAG[tags[0]] ?? [120, 120, 120];
    d.setFillColor(...cor); d.rect(M, y, 1.8, h, "F");
    d.setTextColor(0, 0, 0);
    d.setFont("helvetica", "bold"); d.setFontSize(10.5); d.text(nome, cols[0].x, y + 5);
    d.setFont("helvetica", "normal"); d.setFontSize(8.5); d.setTextColor(90, 90, 90);
    d.text([l.idade ? `${l.idade} anos` : "", l.categoria && l.categoria.trim() !== "Encontrista" ? l.categoria.trim() : ""].filter(Boolean).join(" · "), cols[0].x, y + 5 + nome.length * 4.4);
    // quarto em destaque
    d.setTextColor(0, 0, 0);
    if (l.quarto) {
      d.setFillColor(...marca); d.roundedRect(cols[1].x, y + 2.2, cols[1].w - 3, 8, 2, 2, "F");
      d.setTextColor(255, 255, 255); d.setFont("helvetica", "bold"); d.setFontSize(l.quarto.length > 9 ? 8 : 10);
      d.text(l.quarto, cols[1].x + (cols[1].w - 3) / 2, y + 7.6, { align: "center", maxWidth: cols[1].w - 5 });
    } else { d.setTextColor(150, 150, 150); d.setFont("helvetica", "italic"); d.setFontSize(8.5); d.text("sem quarto", cols[1].x, y + 7.4); }
    d.setTextColor(0, 0, 0); d.setFont("helvetica", "normal"); d.setFontSize(9.5);
    d.text(nec, cols[2].x, y + 5);
    let tx = cols[2].x;
    tags.forEach((t) => {
      d.setFontSize(7); d.setFont("helvetica", "bold");
      const w = d.getTextWidth(t.toUpperCase()) + 4;
      d.setFillColor(...COR_TAG[t]); d.roundedRect(tx, y + h - 6, w, 4.2, 1.2, 1.2, "F");
      d.setTextColor(255, 255, 255); d.text(t.toUpperCase(), tx + 2, y + h - 3);
      tx += w + 1.5;
    });
    d.setTextColor(0, 0, 0); d.setFont("helvetica", "bold"); d.setFontSize(9.5);
    d.text(cont.length ? cont : ["—"], cols[3].x, y + 5);
    d.setFont("helvetica", "normal"); d.setFontSize(8.5); d.setTextColor(70, 70, 70);
    d.text(obs, cols[4].x, y + 5);
    d.setDrawColor(215, 215, 210); d.line(M, y + h, W - M, y + h);
    y += h;
  });
  if (ordenadas.length === 0) { d.setTextColor(90, 90, 90); d.setFontSize(11); d.text("Nenhuma pessoa com necessidade de saúde nesta edição.", M, y + 10); }

  const n = d.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    d.setPage(p); d.setFont("helvetica", "normal"); d.setFontSize(8); d.setTextColor(120, 120, 120);
    d.text(`${ed.nome} · Saúde · ${agora}`, M, H - 6); d.text(`Página ${p} de ${n}`, W - M, H - 6, { align: "right" });
  }
  return d.output("blob");
}

export async function excelSaude(ed: Edicao, linhas: LinhaSaude[]): Promise<Blob> {
  const XLSX = await import("xlsx");
  const ord = linhas.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const ws = XLSX.utils.aoa_to_sheet([
    ["Nome", "Idade", "Quarto", "Necessidade de saúde", "Tipo", "Contato de emergência", "Observação da saúde"],
    ...ord.map((l) => [l.nome, l.idade ?? "", l.quarto ?? "", l.necessidade ?? "", tagsDe(l.necessidade).join(", "), (l.contatos ?? []).join("  |  "), l.observacao ?? ""]),
  ]);
  ws["!cols"] = [{ wch: 34 }, { wch: 7 }, { wch: 12 }, { wch: 60 }, { wch: 24 }, { wch: 50 }, { wch: 36 }];
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as never;
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Saúde");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
