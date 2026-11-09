// Peças de slide compartilhadas entre o relatório da edição e o relatório anual (pptxgenjs).
import type PptxGenJS from "pptxgenjs";
import { corDaRede } from "@/components/graficos";
import { fmtDiaAno } from "@/lib/inscricoes";
import { leituraRapida, pc, type Perfil } from "@/lib/perfil";

export type Cores = { marca: string; esc: string; det: string; clara: string; fundo: string; txt: string; suave: string; linha: string };
export type Sl = ReturnType<PptxGenJS["addSlide"]>;
export type Deck = { pp: PptxGenJS; COR: Cores; TIT: string; TXT: string; base: (num: string, kicker: string, titulo: string, sub?: string) => Sl };
const n = (v: number) => v.toLocaleString("pt-BR");
const hx = (c: string) => c.replace("#", "");

export function cartao(d: Deck, sl: Sl, x: number, y: number, w: number, h: number, fill = "FFFFFF") {
  sl.addShape("roundRect", { x, y, w, h, fill: { color: fill }, line: { color: d.COR.linha, width: 0.75 }, rectRadius: 0.12, shadow: { type: "outer", color: "000000", opacity: 0.1, blur: 10, offset: 3, angle: 90 } });
}
const rot = (d: Deck, sl: Sl, t: string, x: number, y: number, w: number) => sl.addText(t.toUpperCase(), { x, y, w, h: 0.3, fontFace: d.TXT, fontSize: 10.5, bold: true, color: d.COR.det, charSpacing: 4 });

/** Números grandes em cartões + barra de sexo. */
export function slidePessoas(d: Deck, num: string, s: { cards: [number, string][]; sexos: [string, number][]; sub: string; titulo?: string }) {
  const sl = d.base(num, "Pessoas", s.titulo ?? "Quem esteve conosco", s.sub);
  const w = 2.75, gap = 0.2;
  s.cards.slice(0, 4).forEach(([v, r], i) => {
    const x = 0.9 + i * (w + gap);
    cartao(d, sl, x, 2.05, w, 1.95);
    sl.addShape("rect", { x: x + 0.3, y: 2.3, w: 0.5, h: 0.06, fill: { color: d.COR.det } });
    sl.addText(n(v), { x: x + 0.25, y: 2.45, w: w - 0.5, h: 0.95, fontFace: d.TIT, fontSize: 52, bold: true, color: d.COR.marca, fit: "shrink" });
    sl.addText(r, { x: x + 0.3, y: 3.4, w: w - 0.5, h: 0.45, fontFace: d.TXT, fontSize: 14, color: d.COR.suave });
  });
  const sx = s.sexos.filter(([a]) => a).slice(0, 2), tot = sx.reduce((a, x) => a + x[1], 0);
  cartao(d, sl, 0.9, 4.25, 11.6, 2.5);
  rot(d, sl, "Por sexo", 1.25, 4.5, 4);
  if (tot > 0) {
    let x = 1.25; const W = 10.9;
    sx.forEach(([nome, v], i) => {
      const ww = Math.max(0.6, (W * v) / tot);
      sl.addShape("roundRect", { x, y: 5.0, w: ww - 0.04, h: 0.7, fill: { color: i ? d.COR.det : d.COR.marca }, rectRadius: 0.1 });
      sl.addText(`${pc(v, tot)}%`, { x, y: 5.0, w: ww - 0.04, h: 0.7, fontFace: d.TIT, fontSize: 22, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
      sl.addText(`${nome} · ${n(v)}`, { x, y: 5.8, w: ww, h: 0.4, fontFace: d.TXT, fontSize: 14, color: d.COR.txt, align: i ? "right" : "left" });
      x += ww;
    });
  } else sl.addText("Sexo não informado na planilha.", { x: 1.25, y: 5.0, w: 8, h: 0.5, fontFace: d.TXT, fontSize: 14, color: d.COR.suave });
  return sl;
}

/** Quatro anéis (batizados, célula, igreja, rede) + leitura rápida. */
export function slidePerfil(d: Deck, num: string, p: Perfil, sub: string) {
  const sl = d.base(num, "Perfil espiritual", "Quem chegou até aqui", sub);
  const itens: { t: string; sim: number; nao: number; a: string; b: string }[] = [
    { t: "Batismo", sim: p.bat, nao: p.nbat, a: "batizados", b: "não batizados" },
    { t: "Célula", sim: p.cel, nao: p.scel, a: "em célula", b: "sem célula" },
    { t: "Igreja", sim: p.igr, nao: p.sigr, a: "com igreja", b: "sem igreja" },
    { t: "Rede", sim: p.comRede, nao: p.srede, a: "com rede", b: "sem rede" },
  ];
  const w = 2.75, gap = 0.2;
  itens.forEach((it, i) => {
    const x = 0.9 + i * (w + gap);
    cartao(d, sl, x, 2.05, w, 3.55);
    rot(d, sl, it.t, x + 0.3, 2.22, w - 0.5);
    sl.addChart("doughnut" as never, [{ name: it.t, labels: [it.a, it.b], values: [Math.max(it.sim, 0.0001), Math.max(it.nao, 0.0001)] }],
      { x: x + 0.3, y: 2.55, w: w - 0.6, h: 2.15, holeSize: 72, chartColors: [d.COR.marca, "E4E3DC"], showLegend: false, showLabel: false, showPercent: false, showValue: false, dataBorder: { pt: 0, color: "FFFFFF" } } as never);
    sl.addText(`${pc(it.sim, p.total)}%`, { x: x + 0.3, y: 3.2, w: w - 0.6, h: 0.85, fontFace: d.TIT, fontSize: 25, bold: true, color: d.COR.esc, align: "center", valign: "middle" });
    sl.addText([{ text: `${n(it.sim)} ${it.a}`, options: { bold: true, color: d.COR.marca, breakLine: true } }, { text: `${n(it.nao)} ${it.b}`, options: { color: d.COR.suave } }],
      { x: x + 0.2, y: 4.75, w: w - 0.4, h: 0.75, fontFace: d.TXT, fontSize: 13, align: "center", valign: "top" });
  });
  const frases = leituraRapida(p);
  if (frases.length) {
    sl.addShape("roundRect", { x: 0.9, y: 5.8, w: 11.6, h: 1.05, fill: { color: d.COR.clara }, rectRadius: 0.1 });
    sl.addShape("rect", { x: 0.9, y: 5.9, w: 0.08, h: 0.85, fill: { color: d.COR.marca } });
    sl.addText("LEITURA RÁPIDA", { x: 1.2, y: 5.9, w: 2, h: 0.85, fontFace: d.TXT, fontSize: 10.5, bold: true, color: d.COR.det, charSpacing: 4, valign: "middle" });
    sl.addText(frases.map((f, k) => ({ text: f, options: { breakLine: k < frases.length - 1 } })), { x: 3.1, y: 5.9, w: 9.2, h: 0.85, fontFace: d.TXT, fontSize: 12.5, color: d.COR.txt, valign: "middle", paraSpaceAfter: 2 });
  }
  return sl;
}

/** Pizza das redes com ranking ao lado. */
export function slideRedes(d: Deck, num: string, redes: [string, number][], sub: string) {
  const sl = d.base(num, "Redes", "De onde vêm", sub);
  const total = redes.reduce((a, x) => a + x[1], 0);
  cartao(d, sl, 0.9, 2.05, 5.0, 4.8);
  sl.addChart("doughnut" as never, [{ name: "Redes", labels: redes.map((x) => x[0]), values: redes.map((x) => x[1]) }],
    { x: 1.05, y: 2.2, w: 4.7, h: 4.5, holeSize: 58, chartColors: redes.map((x) => hx(corDaRede(x[0]))), showLegend: false, showLabel: false, showPercent: false, showValue: false, dataBorder: { pt: 2, color: "FFFFFF" } } as never);
  sl.addText(n(total), { x: 2.25, y: 3.95, w: 2.3, h: 0.8, fontFace: d.TIT, fontSize: 40, bold: true, color: d.COR.esc, align: "center", valign: "middle" });
  sl.addText("encontristas", { x: 2.25, y: 4.7, w: 2.3, h: 0.35, fontFace: d.TXT, fontSize: 12, color: d.COR.suave, align: "center" });
  cartao(d, sl, 6.15, 2.05, 6.35, 4.8);
  rot(d, sl, "Ranking das redes", 6.5, 2.25, 4);
  const lista = redes.slice(0, 8), lin = Math.min(0.5, 4.0 / Math.max(lista.length, 1)), max = Math.max(...lista.map((x) => x[1]), 1);
  lista.forEach(([nome, v], i) => {
    const y = 2.7 + i * lin;
    sl.addShape("ellipse", { x: 6.5, y: y + lin / 2 - 0.1, w: 0.2, h: 0.2, fill: { color: hx(corDaRede(nome)) } });
    sl.addText(nome, { x: 6.85, y, w: 1.9, h: lin, fontFace: d.TXT, fontSize: 14, bold: true, color: d.COR.txt, valign: "middle", fit: "shrink" });
    sl.addShape("roundRect", { x: 8.8, y: y + lin * 0.3, w: 2.2, h: lin * 0.4, fill: { color: "EEEDE7" }, rectRadius: 0.05 });
    sl.addShape("roundRect", { x: 8.8, y: y + lin * 0.3, w: Math.max(0.1, (2.2 * v) / max), h: lin * 0.4, fill: { color: hx(corDaRede(nome)) }, rectRadius: 0.05 });
    sl.addText(n(v), { x: 11.05, y, w: 0.6, h: lin, fontFace: d.TIT, fontSize: 15, bold: true, color: d.COR.esc, valign: "middle", align: "right" });
    sl.addText(`${pc(v, total)}%`, { x: 11.65, y, w: 0.7, h: lin, fontFace: d.TXT, fontSize: 11, color: d.COR.suave, valign: "middle", align: "right" });
  });
  return sl;
}

type Insc = { ini: Date | null; fim: Date | null; diasAbertos: number; dias: { data: Date; n: number }[]; pico: { data: Date; n: number } | null; mesTopNome: string; mesTop: { n: number } | null; comData: number };
/** Linha acumulada das inscrições da edição + números ao lado. */
export function slideInscricoes(d: Deck, num: string, insc: Insc, sub: string, fmt: (x: Date) => string) {
  const sl = d.base(num, "Inscrições", "Quando se inscreveram", sub);
  cartao(d, sl, 0.9, 2.05, 8.1, 4.8);
  rot(d, sl, "Inscrições acumuladas", 1.25, 2.25, 5);
  let ac = 0;
  sl.addChart("line" as never, [{ name: "Inscrições", labels: insc.dias.map((x) => fmt(x.data)), values: insc.dias.map((x) => (ac += x.n)) }],
    { x: 1.1, y: 2.6, w: 7.7, h: 4.1, chartColors: [d.COR.marca], lineSize: 3.5, lineDataSymbol: "none", catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, catAxisLabelColor: d.COR.suave, valAxisLabelColor: d.COR.suave, valGridLine: { color: "ECEBE5", size: 0.5 }, catGridLine: { style: "none" }, showLegend: false } as never);
  const stats: [string, string][] = [
    ["Inscrições abertas em", insc.ini ? fmtDiaAno(insc.ini) : "–"], ["Último dia", insc.fim ? fmtDiaAno(insc.fim) : "–"],
    ["Tempo de inscrição", `${insc.diasAbertos} dias`], ["Dia de pico", insc.pico ? `${fmt(insc.pico.data)} · ${insc.pico.n}` : "–"],
  ];
  stats.forEach(([r, v], i) => {
    const y = 2.05 + i * 1.2;
    cartao(d, sl, 9.25, y, 3.25, 1.05);
    sl.addShape("rect", { x: 9.25, y: y + 0.18, w: 0.07, h: 0.69, fill: { color: d.COR.det } });
    sl.addText(r.toUpperCase(), { x: 9.5, y: y + 0.12, w: 2.9, h: 0.3, fontFace: d.TXT, fontSize: 9.5, bold: true, color: d.COR.suave, charSpacing: 3 });
    sl.addText(v, { x: 9.5, y: y + 0.4, w: 2.9, h: 0.55, fontFace: d.TIT, fontSize: 20, bold: true, color: d.COR.esc, fit: "shrink" });
  });
  return sl;
}
