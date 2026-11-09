"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLista } from "@/lib/dados";
import { dmy, fmtN, type Envio, type Item } from "@/lib/tipos";
import { podeVerFicha } from "@/lib/perm";
import { descricaoEd, temaDe } from "@/lib/cores";
import { useAuth, useAviso, useEdicao } from "@/components/provedores";
import { LinhaTempo, Pizza, corDaRede } from "@/components/graficos";
import { perfilDe, pc } from "@/lib/perfil";
import { slideInscricoes, slidePerfil, slidePessoas, slideRedes, type Deck } from "@/lib/slidesVida";
import { fmtDia, fmtDiaAno, resumoInscricoes } from "@/lib/inscricoes";
import { Botao, Carregando, Chip, Titulo, Vazio } from "@/components/ui";

type Esp = { batizado: boolean | null; rede: string | null; igreja: string | null; em_celula: boolean | null };
type Enc = { id: string; edicao_id: string; nome: string; data_inscricao: string | null; categoria: string | null; sexo: string | null; cancelada: boolean;
  encontrista_saude: { tem_necessidade: boolean } | { tem_necessidade: boolean }[] | null;
  encontrista_espiritual: Esp | Esp[] | null };
type Dec = { edicao_id: string; encontrista_id: string; botao: string; criado_em: string; por: string | null };
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const conta = <T,>(l: T[], f: (x: T) => string) => { const m = new Map<string, number>(); l.forEach((x) => { const k = f(x) || "Não informado"; m.set(k, (m.get(k) ?? 0) + 1); }); return Array.from(m.entries()).sort((a, b) => b[1] - a[1]); };

export default function Relatorio() {
  const { acesso } = useAuth();
  const { ed } = useEdicao();
  const aviso = useAviso();
  const itens = useLista<Item>("itens", "*", "nome");
  const envios = useLista<Envio>("envios");
  const decs = useLista<Dec>("decisoes");
  const encs = useLista<Enc>("encontristas", "id, edicao_id, nome, data_inscricao, categoria, sexo, cancelada, encontrista_saude(tem_necessidade), encontrista_espiritual(batizado, rede, igreja, em_celula)", "nome");
  const [sec, setSec] = useState({ materiais: true, pessoas: true, decisoes: true });
  const [nomes, setNomes] = useState(false);
  const admin = podeVerFicha(acesso);

  const dados = useMemo(() => {
    if (!ed || !itens.dados || !envios.dados) return null;
    const porId = new Map(itens.dados.map((i) => [i.id, i]));
    const linhas = envios.dados.filter((x) => x.edicao_id === ed.id).map((x) => {
      const it = porId.get(x.item_id); if (!it) return null;
      const volta = x.volta ?? Number(x.env) + Number(x.comp);
      return { setor: it.setor, nome: it.nome, un: it.un, env: Number(x.env), comp: Number(x.comp), volta, cons: Number(x.env) + Number(x.comp) - volta, estoque: Number(it.qtd), min: Number(it.min), fechado: x.aplicado != null };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    const setores = Array.from(new Set(linhas.map((l) => l.setor))).sort((a, b) => a.localeCompare(b));
    const emFalta = itens.dados.filter((i) => i.min > 0 && i.qtd < i.min).length;
    const pessoas = (encs.dados ?? []).filter((e) => e.edicao_id === ed.id);
    const ativos = pessoas.filter((e) => !e.cancelada);
    const dec = (decs.dados ?? []).filter((d) => d.edicao_id === ed.id);
    return { linhas, setores, emFalta, pessoas, ativos, dec, nomePor: new Map((encs.dados ?? []).map((e) => [e.id, e.nome])) };
  }, [ed, itens.dados, envios.dados, encs.dados, decs.dados]);

  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!dados) return <Carregando />;
  const { linhas, setores, emFalta, pessoas, ativos, dec, nomePor } = dados;
  const principais = ativos.filter((e) => (e.categoria ?? "").trim() === "Encontrista");
  const equipe = ativos.length - principais.length;
  const batizados = principais.filter((e) => um(e.encontrista_espiritual)?.batizado === true).length;
  const saude = ativos.filter((e) => um(e.encontrista_saude)?.tem_necessidade).length;
  const porBotao = conta(dec, (d) => d.botao);
  const insc = resumoInscricoes(principais.map((e) => e.data_inscricao));
  const perfil = perfilDe(principais.map((e) => um(e.encontrista_espiritual)));
  const redes2 = conta(principais, (e) => um(e.encontrista_espiritual)?.rede ?? "").map(([a, b]) => [a || "Sem rede", b] as [string, number]);

  async function excel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const add = (nome: string, rows: (string | number)[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), nome.slice(0, 31));
    add("Resumo", [["Edição", ed!.nome], ["Rede/tipo", descricaoEd(ed!)], ["Período", `${dmy(ed!.data_ini)} a ${dmy(ed!.data_fim)}`], ["Local", ed!.local ?? ""], ["Responsável", ed!.resp ?? ""],
      ["Itens enviados", linhas.length], ["Itens em falta (estoque geral)", emFalta], ...(admin ? [["Encontristas", principais.length], ["Equipe", equipe], ["Batizados", batizados], ["Com necessidade de saúde", saude]] : []), ["Decisões registradas", dec.length]] as (string | number)[][]);
    if (sec.materiais) add("Materiais", [["Setor", "Item", "Medida", "Enviado", "Comprado", "Voltou", "Consumo", "Estoque atual", "Mínimo", "Balanço"], ...linhas.map((l) => [l.setor, l.nome, l.un, l.env, l.comp, l.volta, l.cons, l.estoque, l.min, l.fechado ? "fechado" : "aberto"])]);
    if (sec.pessoas && admin) {
      add("Pessoas", [["Indicador", "Valor"], ["Encontristas", principais.length], ["Equipe", equipe], ["Cancelados", pessoas.length - ativos.length], ["Batizados", batizados], ["Necessidade de saúde", saude],
        [], ["Rede", "Encontristas"], ...conta(principais, (e) => um(e.encontrista_espiritual)?.rede ?? ""), [], ["Sexo", "Encontristas"], ...conta(principais, (e) => e.sexo ?? "")]);
      add("Perfil espiritual", [["Indicador", "Pessoas", "% dos encontristas"], ["Batizados", perfil.bat, pc(perfil.bat, perfil.total)], ["Não batizados", perfil.nbat, pc(perfil.nbat, perfil.total)], ["Em célula", perfil.cel, pc(perfil.cel, perfil.total)], ["Sem célula", perfil.scel, pc(perfil.scel, perfil.total)], ["Com igreja", perfil.igr, pc(perfil.igr, perfil.total)], ["Sem igreja", perfil.sigr, pc(perfil.sigr, perfil.total)], ["Com rede", perfil.comRede, pc(perfil.comRede, perfil.total)], ["Sem rede", perfil.srede, pc(perfil.srede, perfil.total)]]);
      if (insc.comData > 0) add("Inscrições", [["Mês", "Inscrições"], ...insc.meses.map((m) => [m.rotulo, m.n]), [], ["Dia", "Inscrições"], ...insc.dias.map((d) => [fmtDia(d.data) + "/" + d.chave.slice(0, 4), d.n])]);
      if (nomes) add("Lista nominal", [["Nome", "Categoria", "Rede"], ...ativos.map((e) => [e.nome, e.categoria ?? "", um(e.encontrista_espiritual)?.rede ?? ""])]);
    }
    if (sec.decisoes) add("Decisões", [["Decisão", "Quantidade"], ...porBotao, ...(admin && nomes ? [[], ["Nome", "Decisão", "Data"], ...dec.map((d) => [nomePor.get(d.encontrista_id) ?? "", d.botao, new Date(d.criado_em).toLocaleDateString("pt-BR")])] : [])] as (string | number)[][]);
    XLSX.writeFile(wb, `Relatorio_${ed!.nome.replace(/[^a-zA-Z0-9]+/g, "_")}.xlsx`);
    aviso("Planilha gerada.");
  }


  async function slides() {
    const { default: Pptx } = await import("pptxgenjs");
    const t = temaDe(ed), hx = (c: string) => c.replace("#", "");
    const COR = { marca: hx(t.marca), esc: hx(t.esc), det: hx(t.detalhe), clara: hx(t.clara), fundo: hx(t.fundo), txt: "1B1B1A", suave: "76766F", linha: "DDDCD6" };
    const pp = new Pptx(); pp.layout = "LAYOUT_WIDE"; pp.title = `Relatório ${ed!.nome}`;
    const TIT = "Georgia", COR_TXT = "Calibri";
    const W = 13.33;
    const periodo = `${dmy(ed!.data_ini)}${ed!.data_fim ? " a " + dmy(ed!.data_fim) : ""}${ed!.local ? "  ·  " + ed!.local : ""}`;
    type Sl = ReturnType<typeof pp.addSlide>;

    // base de cada slide de conteúdo: faixa lateral fina, chamada pequena, título em serifa, rodapé discreto
    const base = (num: string, kicker: string, titulo: string, sub?: string): Sl => {
      const sl = pp.addSlide(); sl.background = { color: COR.fundo };
      sl.addShape("rect", { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: COR.marca } });
      sl.addShape("rect", { x: 0, y: 0, w: 0.22, h: 1.7, fill: { color: COR.det } });
      sl.addText(`${num}  ${kicker.toUpperCase()}`, { x: 0.9, y: 0.45, w: 8, h: 0.3, fontFace: COR_TXT, fontSize: 11, bold: true, color: COR.det, charSpacing: 5 });
      sl.addText(titulo, { x: 0.9, y: 0.78, w: 11.6, h: 0.8, fontFace: TIT, fontSize: 34, bold: true, color: COR.esc });
      if (sub) sl.addText(sub, { x: 0.9, y: 1.52, w: 11.6, h: 0.35, fontFace: COR_TXT, fontSize: 14, color: COR.suave });
      sl.addText(ed!.nome, { x: 0.9, y: 7.0, w: 6, h: 0.3, fontFace: COR_TXT, fontSize: 10, color: COR.suave });
      return sl;
    };
    // número grande com legenda e fio no topo
    const dado = (sl: Sl, v: string | number, r: string, x: number, y: number, w: number, tam = 46, cor = COR.marca) => {
      sl.addShape("rect", { x, y, w: w - 0.3, h: 0.04, fill: { color: COR.det } });
      sl.addText(String(typeof v === "number" ? fmtN(v) : v), { x, y: y + 0.12, w: w - 0.3, h: tam / 40, fontFace: TIT, fontSize: tam, bold: true, color: cor });
      sl.addText(r, { x, y: y + 0.2 + tam / 40, w: w - 0.3, h: 0.4, fontFace: COR_TXT, fontSize: 13, color: COR.suave });
    };
    // barras horizontais desenhadas à mão (rótulo, barra proporcional, valor)
    const barras = (sl: Sl, itens: [string, number][], x: number, y: number, w: number, h: number) => {
      const lista = itens.slice(0, 9); if (!lista.length) return;
      const max = Math.max(...lista.map((i) => i[1]), 1), lin = Math.min(0.62, h / lista.length), lw = 3.0, bw = w - lw - 1.0;
      lista.forEach(([nome, v], i) => {
        const yy = y + i * lin;
        sl.addText(nome, { x, y: yy, w: lw - 0.15, h: lin, fontFace: COR_TXT, fontSize: 13, color: COR.txt, valign: "middle", align: "right", fit: "shrink" });
        sl.addShape("roundRect", { x: x + lw, y: yy + lin * 0.2, w: bw, h: lin * 0.6, fill: { color: COR.linha }, rectRadius: 0.05 });
        sl.addShape("roundRect", { x: x + lw, y: yy + lin * 0.2, w: Math.max(0.12, (bw * v) / max), h: lin * 0.6, fill: { color: i === 0 ? COR.det : COR.marca }, rectRadius: 0.05 });
        sl.addText(fmtN(v), { x: x + lw + bw + 0.1, y: yy, w: 0.9, h: lin, fontFace: TIT, fontSize: 15, bold: true, color: COR.esc, valign: "middle" });
      });
    };

    // ---- capa
    const c = pp.addSlide(); c.background = { color: COR.esc };
    c.addShape("ellipse", { x: 8.3, y: -1.4, w: 7.6, h: 7.6, fill: { color: COR.marca } });
    c.addShape("ellipse", { x: 10.9, y: 4.5, w: 3.8, h: 3.8, fill: { color: COR.det } });
    c.addShape("ellipse", { x: 7.5, y: 3.4, w: 2.2, h: 2.2, fill: { color: COR.det, transparency: 100 }, line: { color: COR.det, width: 2 } });
    c.addText("RELATÓRIO GERAL", { x: 0.9, y: 1.3, w: 8, h: 0.4, fontFace: COR_TXT, fontSize: 14, bold: true, color: COR.det, charSpacing: 8 });
    c.addText(ed!.nome, { x: 0.9, y: 1.85, w: 8.2, h: 2.2, fontFace: TIT, fontSize: 60, bold: true, color: "FFFFFF", valign: "top", fit: "shrink" });
    c.addShape("rect", { x: 0.95, y: 4.35, w: 1.3, h: 0.07, fill: { color: COR.det } });
    c.addText([descricaoEd(ed!), periodo, ed!.resp ? `Responsável: ${ed!.resp}` : ""].filter(Boolean).join("\n"), { x: 0.9, y: 4.65, w: 7.2, h: 1.4, fontFace: COR_TXT, fontSize: 17, color: "E6E6E0", valign: "top", paraSpaceAfter: 4 });
    c.addText("VIDA VITORIOSA", { x: 0.9, y: 6.75, w: 6, h: 0.3, fontFace: COR_TXT, fontSize: 11, bold: true, color: COR.det, charSpacing: 6 });

    // ---- resumo: painel de cor com o número principal + grade de números
    const r = pp.addSlide(); r.background = { color: COR.fundo };
    r.addShape("rect", { x: 0, y: 0, w: 5.2, h: 7.5, fill: { color: COR.marca } });
    r.addShape("ellipse", { x: -1.4, y: 4.6, w: 4.6, h: 4.6, fill: { color: COR.det, transparency: 70 } });
    r.addText("01  RESUMO", { x: 0.8, y: 0.6, w: 4, h: 0.3, fontFace: COR_TXT, fontSize: 11, bold: true, color: COR.det, charSpacing: 5 });
    const principal: [number, string] = admin ? [principais.length, "encontristas"] : [linhas.length, "itens enviados"];
    r.addText(fmtN(principal[0]), { x: 0.8, y: 2.2, w: 4.2, h: 1.9, fontFace: TIT, fontSize: 100, bold: true, color: "FFFFFF", fit: "shrink" });
    r.addText(principal[1], { x: 0.8, y: 4.1, w: 4.2, h: 0.5, fontFace: COR_TXT, fontSize: 20, color: "FFFFFF" });
    r.addText(ed!.nome, { x: 0.8, y: 6.7, w: 4.2, h: 0.4, fontFace: TIT, fontSize: 14, color: COR.clara });
    r.addText("O que aconteceu nesta edição", { x: 5.9, y: 0.55, w: 7, h: 0.8, fontFace: TIT, fontSize: 30, bold: true, color: COR.esc });
    const grade: [number, string][] = [[linhas.length, "itens enviados"], [dec.length, "decisões registradas"], ...(admin ? ([[equipe, "pessoas na equipe"], [batizados, "encontristas batizados"], [saude, "com necessidade de saúde"]] as [number, string][]) : []), [emFalta, "itens em falta no estoque"]];
    grade.slice(0, 6).forEach(([v, rot], i) => dado(r, v, rot, 5.9 + (i % 2) * 3.6, 1.9 + Math.floor(i / 2) * 1.7, 3.6));

    // ---- materiais
    let n = 2;
    if (sec.materiais && linhas.length) {
      const m = base(String(n++).padStart(2, "0"), "Materiais", "O que saiu para a edição", "Unidades enviadas por setor");
      barras(m, setores.map((st) => [st, linhas.filter((l) => l.setor === st).reduce((a, l) => a + l.env, 0)] as [string, number]).sort((a, b) => b[1] - a[1]), 0.9, 2.15, 11.6, 4.7);
      for (const st of setores) {
        const l = linhas.filter((x) => x.setor === st);
        const totEnv = l.reduce((a, x) => a + x.env, 0), totCons = l.reduce((a, x) => a + x.cons, 0);
        for (let k = 0; k < l.length; k += 9) {
          const sl = pp.addSlide(); sl.background = { color: COR.fundo };
          sl.addShape("rect", { x: 0, y: 0, w: 4.1, h: 7.5, fill: { color: COR.clara } });
          sl.addShape("rect", { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: COR.marca } });
          sl.addText("MATERIAIS", { x: 0.8, y: 0.55, w: 3, h: 0.3, fontFace: COR_TXT, fontSize: 11, bold: true, color: COR.det, charSpacing: 5 });
          sl.addText(st + (k > 0 ? " (cont.)" : ""), { x: 0.8, y: 0.9, w: 3.1, h: 1.7, fontFace: TIT, fontSize: 30, bold: true, color: COR.esc, valign: "top", fit: "shrink" });
          dado(sl, l.length, "itens", 0.8, 2.9, 3.2, 30); dado(sl, totEnv, "unidades enviadas", 0.8, 4.4, 3.2, 30); dado(sl, totCons, "consumidas", 0.8, 5.9, 3.2, 30, COR.esc);
          const nb = { type: "none" as const }, fio = (cor: string, pt = 0.75) => ({ type: "solid" as const, color: cor, pt });
          const cab = ["Item", "Enviado", "Comprado", "Voltou", "Consumo"].map((h, i) => ({ text: h.toUpperCase(), options: { bold: true, fontSize: 10, color: COR.suave, align: i ? "right" : "left", border: [nb, nb, fio(COR.marca, 1.5), nb] } }));
          const corpo = l.slice(k, k + 9).map((x) => [`${x.nome}`, x.env, x.comp, x.volta, x.cons].map((v, i) => ({ text: typeof v === "number" ? fmtN(v) : v, options: { align: i ? "right" : "left", bold: i === 4, color: i === 4 ? COR.esc : COR.txt, border: [nb, nb, fio(COR.linha), nb] } })));
          sl.addTable([cab, ...corpo] as never, { x: 4.6, y: 0.9, w: 8.2, colW: [3.6, 1.1, 1.2, 1.1, 1.2], fontFace: COR_TXT, fontSize: 13, rowH: 0.55, valign: "middle" });
          sl.addText(`Balanço ${l.every((x) => x.fechado) ? "fechado" : "em aberto"}`, { x: 4.6, y: 6.95, w: 4, h: 0.3, fontFace: COR_TXT, fontSize: 10, color: COR.suave });
        }
      }
    }
    // ---- pessoas, perfil espiritual, redes e inscrições (peças compartilhadas em slidesVida)
    if (sec.pessoas && admin) {
      const d: Deck = { pp, COR, TIT, TXT: COR_TXT, base };
      const sexos = conta(principais, (e) => e.sexo ?? "").filter(([a]) => a) as [string, number][];
      slidePessoas(d, String(n++).padStart(2, "0"), { cards: [[principais.length, "encontristas"], [equipe, "pessoas na equipe"], [batizados, "encontristas batizados"], [saude, "com necessidade de saúde"]], sexos, sub: "Encontristas e equipe" });
      if (principais.length) slidePerfil(d, String(n++).padStart(2, "0"), perfil, `${principais.length} encontristas · ${ed!.nome}`);
      if (redes2.length) slideRedes(d, String(n++).padStart(2, "0"), redes2.sort((a, b) => b[1] - a[1]), "A rede de cada encontrista, na própria cor");
      if (insc.comData) slideInscricoes(d, String(n++).padStart(2, "0"), insc, `${ed!.nome} · do primeiro ao último dia de inscrição`, fmtDia);
    }
    // ---- decisões
    if (sec.decisoes) {
      const sl = pp.addSlide(); sl.background = { color: COR.esc };
      sl.addShape("ellipse", { x: -2.2, y: 3.2, w: 6.2, h: 6.2, fill: { color: COR.marca } });
      sl.addText(`${String(n++).padStart(2, "0")}  DECISÕES`, { x: 0.9, y: 0.55, w: 6, h: 0.3, fontFace: COR_TXT, fontSize: 11, bold: true, color: COR.det, charSpacing: 5 });
      sl.addText(fmtN(dec.length), { x: 0.9, y: 1.5, w: 4.4, h: 2.2, fontFace: TIT, fontSize: 110, bold: true, color: "FFFFFF", fit: "shrink" });
      sl.addText("decisões registradas", { x: 0.9, y: 3.7, w: 4.4, h: 0.5, fontFace: COR_TXT, fontSize: 20, color: COR.clara });
      if (porBotao.length) {
        const max = Math.max(...porBotao.map((x) => x[1]), 1);
        porBotao.slice(0, 7).forEach(([nome, v], i) => {
          const yy = 1.3 + i * 0.78;
          sl.addText(String(nome), { x: 5.9, y: yy, w: 4.3, h: 0.7, fontFace: COR_TXT, fontSize: 17, color: "FFFFFF", valign: "middle", fit: "shrink" });
          sl.addShape("roundRect", { x: 10.1, y: yy + 0.22, w: 2.2 * (v / max) + 0.1, h: 0.26, fill: { color: i % 2 ? COR.clara : COR.det }, rectRadius: 0.05 });
          sl.addText(fmtN(v as number), { x: 10.1 + 2.2 * (v / max) + 0.25, y: yy, w: 0.9, h: 0.7, fontFace: TIT, fontSize: 20, bold: true, color: "FFFFFF", valign: "middle" });
        });
      } else sl.addText("Nenhuma decisão registrada nesta edição.", { x: 5.9, y: 3, w: 6.8, h: 1, fontFace: COR_TXT, fontSize: 20, color: COR.clara });
    }
    // ---- encerramento
    const f = pp.addSlide(); f.background = { color: COR.marca };
    f.addShape("ellipse", { x: 9.2, y: -1.6, w: 6, h: 6, fill: { color: COR.det, transparency: 65 } });
    f.addText("Obrigado", { x: 0.9, y: 2.4, w: 9, h: 1.4, fontFace: TIT, fontSize: 64, bold: true, color: "FFFFFF" });
    f.addShape("rect", { x: 0.95, y: 3.95, w: 1.3, h: 0.07, fill: { color: COR.det } });
    f.addText(`${ed!.nome}  ·  ${periodo}`, { x: 0.9, y: 4.2, w: 11, h: 0.5, fontFace: COR_TXT, fontSize: 18, color: "FFFFFF" });
    f.addText("VIDA VITORIOSA", { x: 0.9, y: 6.75, w: 6, h: 0.3, fontFace: COR_TXT, fontSize: 11, bold: true, color: COR.det, charSpacing: 6 });
    void W;
    await pp.writeFile({ fileName: `Apresentacao_${ed!.nome.replace(/[^a-zA-Z0-9]+/g, "_")}.pptx` });
    aviso("Apresentação gerada.");
  }

  const Tit = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 mt-8 border-b-2 border-detalhe pb-1.5 text-xl font-extrabold print:mt-6 print:break-after-avoid">{children}</h2>;
  const Kpi = ({ v, t }: { v: number | string; t: string }) => <div className="rounded-2xl border border-borda bg-white p-3 print:break-inside-avoid"><div className="text-2xl font-extrabold leading-none">{v}</div><div className="mt-1 text-xs text-suave">{t}</div></div>;
  const Tab = ({ cab, linhas: ls }: { cab: string[]; linhas: (string | number)[][] }) => (
    <div className="overflow-x-auto rounded-2xl border border-borda bg-white print:overflow-visible">
      <table className="w-full border-collapse text-sm">
        <thead><tr className="bg-marca-clara text-left">{cab.map((c, i) => <th key={c} className={`px-3 py-2 font-bold ${i > 1 ? "text-right" : ""}`}>{c}</th>)}</tr></thead>
        <tbody>{ls.map((r, i) => <tr key={i} className="border-t border-borda print:break-inside-avoid">{r.map((c, j) => <td key={j} className={`px-3 py-1.5 ${j > 1 ? "text-right" : ""}`}>{typeof c === "number" ? fmtN(c) : c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );

  return (
    <div className="pb-8">
      <div className="print:hidden">
        <Titulo>Relatório geral</Titulo>
        <p className="m-0 pb-3 text-sm text-suave">Para apresentação e comprovação. Escolha o que entra e imprima (ou salve em PDF) ou baixe em Excel.</p>
        <div className="flex flex-wrap gap-2 pb-3">
          <Chip ativo={sec.materiais} onClick={() => setSec({ ...sec, materiais: !sec.materiais })}>Materiais</Chip>
          {admin && <Chip ativo={sec.pessoas} onClick={() => setSec({ ...sec, pessoas: !sec.pessoas })}>Pessoas</Chip>}
          <Chip ativo={sec.decisoes} onClick={() => setSec({ ...sec, decisoes: !sec.decisoes })}>Decisões</Chip>
          {admin && <Chip ativo={nomes} onClick={() => setNomes(!nomes)}>Com lista de nomes</Chip>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => window.print()} className="!min-h-11">Imprimir / salvar PDF</Botao>
          <Botao v="sec" onClick={excel} className="!min-h-11">Baixar Excel</Botao>
          <Botao v="sec" onClick={slides} className="!min-h-11">Baixar apresentação (slides)</Botao>
          {acesso?.perfil === "admin" && <Link href="/relatorio-anual" className="inline-flex min-h-11 items-center rounded-2xl border border-borda bg-white px-4 text-sm font-bold text-marca">Relatório anual →</Link>}
        </div>
      </div>

      <header className="mt-6 print:mt-0">
        <div className="text-xs font-extrabold uppercase tracking-wide text-marca">Relatório geral · {descricaoEd(ed)}</div>
        <h1 className="m-0 text-3xl font-extrabold">{ed.nome}</h1>
        <p className="m-0 text-sm text-suave">{dmy(ed.data_ini)}{ed.data_fim ? ` a ${dmy(ed.data_fim)}` : ""}{ed.local ? ` · ${ed.local}` : ""}{ed.resp ? ` · Responsável: ${ed.resp}` : ""}</p>
        <p className="m-0 text-xs text-suave">Gerado em {new Date().toLocaleString("pt-BR")}</p>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi v={linhas.length} t="itens enviados" />
        <Kpi v={emFalta} t="itens em falta no estoque" />
        {admin && <Kpi v={principais.length} t="encontristas" />}
        {admin && <Kpi v={equipe} t="equipe" />}
        <Kpi v={dec.length} t="decisões registradas" />
      </div>

      {sec.materiais && (
        <>
          <Tit>Materiais por setor</Tit>
          {setores.length === 0 && <Vazio>Nenhum item enviado para esta edição.</Vazio>}
          {setores.map((s) => {
            const l = linhas.filter((x) => x.setor === s);
            return (
              <section key={s} className="mb-5 print:break-inside-avoid-page">
                <h3 className="mb-2 flex items-baseline justify-between text-base font-extrabold"><span>{s}</span><span className="text-xs font-normal text-suave">{l.length} itens · balanço {l.every((x) => x.fechado) ? "fechado" : "aberto"}</span></h3>
                <Tab cab={["Item", "Medida", "Enviado", "Comprado", "Voltou", "Consumo", "Estoque"]} linhas={l.map((x) => [x.nome, x.un, x.env, x.comp, x.volta, x.cons, x.estoque])} />
              </section>
            );
          })}
        </>
      )}

      {sec.pessoas && admin && (
        <>
          <Tit>Pessoas</Tit>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi v={principais.length} t="encontristas" /><Kpi v={equipe} t="equipe" /><Kpi v={batizados} t="encontristas batizados" /><Kpi v={saude} t="com necessidade de saúde" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><h3 className="mb-2 text-base font-extrabold">Por rede</h3><Tab cab={["Rede", "Encontristas"]} linhas={conta(principais, (e) => um(e.encontrista_espiritual)?.rede ?? "")} /></div>
            <div><h3 className="mb-2 text-base font-extrabold">Por sexo</h3><Tab cab={["Sexo", "Encontristas"]} linhas={conta(principais, (e) => e.sexo ?? "")} /></div>
          </div>
          <h3 className="mb-2 mt-5 text-base font-extrabold">Perfil espiritual dos encontristas</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:break-inside-avoid">
            {[["Batizados", perfil.bat], ["Não batizados", perfil.nbat], ["Em célula", perfil.cel], ["Sem célula", perfil.scel], ["Com igreja", perfil.igr], ["Sem igreja", perfil.sigr], ["Com rede", perfil.comRede], ["Sem rede", perfil.srede]].map(([t, v]) => (
              <div key={t as string} className="rounded-2xl border border-borda bg-white p-3"><div className="text-2xl font-extrabold leading-none">{v as number}<span className="ml-1.5 text-sm font-bold text-suave">{pc(v as number, perfil.total)}%</span></div><div className="mt-1 text-sm text-suave">{t as string}</div></div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-borda bg-white p-4 print:break-inside-avoid md:flex-row md:items-center">
            <div className="flex flex-col items-center gap-2 md:w-1/2">
              <h3 className="m-0 self-start text-base font-extrabold">Redes (pizza)</h3>
              <Pizza fatias={Array.from(conta(principais, (e) => um(e.encontrista_espiritual)?.rede ?? "")).map(([nome, valor]) => ({ nome, valor, cor: corDaRede(nome) }))} />
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">{conta(principais, (e) => um(e.encontrista_espiritual)?.rede ?? "").map(([nome, valor]) => <span key={nome} className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full" style={{ background: corDaRede(nome) }} />{nome} ({valor})</span>)}</div>
            </div>
            <div className="min-w-0 md:w-1/2">
              <h3 className="mb-1 text-base font-extrabold">Inscrições desta edição</h3>
              {insc.comData > 0 && <p className="m-0 mb-2 text-xs text-suave">{ed.nome}: inscrições abertas de {insc.ini ? fmtDiaAno(insc.ini) : ""} a {insc.fim ? fmtDiaAno(insc.fim) : ""} ({insc.diasAbertos} dias) · {insc.comData} encontristas inscritos</p>}
              {insc.comData === 0 ? <Vazio>Sem datas de inscrição. Importe a planilha de novo em “Encontristas”.</Vazio> : (
                <>
                  <LinhaTempo dias={insc.dias} acumulado cor={temaDe(ed).marca} />
                  <p className="m-0 mt-2 text-sm">Mês com mais inscrições: <b>{insc.mesTopNome}</b> ({insc.mesTop?.n}) · Dia de pico: <b>{insc.pico ? fmtDia(insc.pico.data) : "–"}</b> ({insc.pico?.n})</p>
                  <div className="mt-2"><Tab cab={["Mês", "Inscrições"]} linhas={insc.meses.map((m) => [m.rotulo, m.n])} /></div>
                </>
              )}
            </div>
          </div>
          {nomes && (
            <div className="mt-4"><h3 className="mb-2 text-base font-extrabold">Lista nominal ({ativos.length})</h3>
              <Tab cab={["Nome", "Categoria", "Rede"]} linhas={ativos.map((e) => [e.nome, e.categoria ?? "", um(e.encontrista_espiritual)?.rede ?? ""])} /></div>
          )}
        </>
      )}

      {sec.decisoes && (
        <>
          <Tit>Decisões</Tit>
          {dec.length === 0 ? <Vazio>Nenhuma decisão registrada nesta edição.</Vazio> : (
            <>
              <Tab cab={["Decisão", "Quantidade"]} linhas={porBotao} />
              {admin && nomes && <div className="mt-4"><Tab cab={["Nome", "Decisão", "Data"]} linhas={dec.map((d) => [nomePor.get(d.encontrista_id) ?? "", d.botao, new Date(d.criado_em).toLocaleDateString("pt-BR")])} /></div>}
            </>
          )}
        </>
      )}
    </div>
  );
}
