"use client";
import { useMemo, useState } from "react";
import { useLista } from "@/lib/dados";
import { dmy, fmtN, type Edicao } from "@/lib/tipos";
import { descricaoEd, temaDe } from "@/lib/cores";
import { resumoInscricoes, fmtDia } from "@/lib/inscricoes";
import { LinhaTempo, Pizza, corDaRede } from "@/components/graficos";
import { perfilDe, pc } from "@/lib/perfil";
import { cartao, slidePerfil, slidePessoas, slideRedes, type Deck } from "@/lib/slidesVida";
import { useAuth, useAviso } from "@/components/provedores";
import { Botao, Carregando, Chip, Titulo, Vazio } from "@/components/ui";

type Esp = { batizado: boolean | null; rede: string | null; igreja: string | null; em_celula: boolean | null };
type Enc = { id: string; edicao_id: string; data_inscricao: string | null; categoria: string | null; cancelada: boolean; sexo: string | null; encontrista_espiritual: Esp | Esp[] | null };
type Dec = { edicao_id: string };
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const anoDe = (e: Edicao) => (e.data_ini ?? e.data_fim ?? "").slice(0, 4) || "Sem data";
const pct = (n: number, t: number) => `${Math.round((n / Math.max(1, t)) * 100)}%`;

export function RelatorioAnual() {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const edicoes = useLista<Edicao>("edicoes", "*", "data_ini");
  const encs = useLista<Enc>("encontristas", "id, edicao_id, data_inscricao, categoria, cancelada, sexo, encontrista_espiritual(batizado, rede, igreja, em_celula)");
  const decs = useLista<Dec>("decisoes", "edicao_id");
  const [anoSel, setAnoSel] = useState<string | null>(null);

  const anos = useMemo(() => Array.from(new Set((edicoes.dados ?? []).map(anoDe))).sort().reverse(), [edicoes.dados]);

  if (acesso && acesso.perfil !== "admin") return <Vazio>O relatório anual é só para o administrador geral da plataforma.</Vazio>;
  if (!acesso || !edicoes.dados || !encs.dados || !decs.dados) return <Carregando />;
  if (anos.length === 0) return <Vazio>Nenhuma edição cadastrada ainda.</Vazio>;

  const ano = anoSel && anos.includes(anoSel) ? anoSel : anos.includes(String(new Date().getFullYear())) ? String(new Date().getFullYear()) : anos[0];
  const eds = edicoes.dados.filter((e) => anoDe(e) === ano);
  const ids = new Set(eds.map((e) => e.id));
  const doAno = encs.dados.filter((e) => ids.has(e.edicao_id) && !e.cancelada);
  const principais = doAno.filter((e) => (e.categoria ?? "").trim() === "Encontrista");
  const equipe = doAno.length - principais.length;
  const nDec = decs.dados.filter((d) => ids.has(d.edicao_id)).length;
  const bat = principais.filter((e) => um(e.encontrista_espiritual)?.batizado === true).length;
  const cel = principais.filter((e) => um(e.encontrista_espiritual)?.em_celula === true).length;
  const igr = principais.filter((e) => um(e.encontrista_espiritual)?.igreja).length;
  const redesMap = new Map<string, number>();
  principais.forEach((e) => { const r = um(e.encontrista_espiritual)?.rede || "Sem rede"; redesMap.set(r, (redesMap.get(r) ?? 0) + 1); });
  const redes = Array.from(redesMap.entries()).sort((a, b) => b[1] - a[1]);
  const perfilAno = perfilDe(principais.map((e) => um(e.encontrista_espiritual)));
  const insc = resumoInscricoes(principais.map((e) => e.data_inscricao));
  const porEd = eds.map((e) => {
    const ps = principais.filter((x) => x.edicao_id === e.id);
    return { e, p: perfilDe(ps.map((x) => um(x.encontrista_espiritual))), enc: ps.length, equipe: doAno.filter((x) => x.edicao_id === e.id).length - ps.length,
      bat: ps.filter((x) => um(x.encontrista_espiritual)?.batizado === true).length, dec: decs.dados!.filter((d) => d.edicao_id === e.id).length };
  });

  function excel() {
    import("xlsx").then((XLSX) => {
      const wb = XLSX.utils.book_new();
      const add = (nome: string, rows: (string | number)[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), nome.slice(0, 31));
      add("Resumo", [["Ano", ano], ["Edições", eds.length], ["Encontristas", principais.length], ["Equipe", equipe], ["Batizados", bat], ["Em célula", cel], ["Com igreja", igr], ["Decisões", nDec],
        ["Mês com mais inscrições", insc.mesTopNome], ["Inscrições nesse mês", insc.mesTop?.n ?? 0], ["Dia de pico", insc.pico ? fmtDia(insc.pico.data) : ""], ["Inscrições no pico", insc.pico?.n ?? 0]]);
      add("Edições", [["Edição", "Rede/tipo", "Início", "Fim", "Encontristas", "Equipe", "Batizados", "Não batizados", "Em célula", "Sem célula", "Com igreja", "Sem igreja", "Sem rede", "Decisões"], ...porEd.map((x) => [x.e.nome, descricaoEd(x.e), dmy(x.e.data_ini), dmy(x.e.data_fim), x.enc, x.equipe, x.p.bat, x.p.nbat, x.p.cel, x.p.scel, x.p.igr, x.p.sigr, x.p.srede, x.dec])]);
      add("Perfil espiritual", [["Indicador", "Pessoas", "%"], ["Batizados", perfilAno.bat, pc(perfilAno.bat, perfilAno.total)], ["Não batizados", perfilAno.nbat, pc(perfilAno.nbat, perfilAno.total)], ["Em célula", perfilAno.cel, pc(perfilAno.cel, perfilAno.total)], ["Sem célula", perfilAno.scel, pc(perfilAno.scel, perfilAno.total)], ["Com igreja", perfilAno.igr, pc(perfilAno.igr, perfilAno.total)], ["Sem igreja", perfilAno.sigr, pc(perfilAno.sigr, perfilAno.total)], ["Sem rede", perfilAno.srede, pc(perfilAno.srede, perfilAno.total)]]);
      add("Redes", [["Rede", "Encontristas"], ...redes]);
      add("Inscrições por mês", [["Mês", "Inscrições"], ...insc.meses.map((m) => [m.rotulo, m.n])]);
      add("Inscrições por dia", [["Dia", "Inscrições"], ...insc.dias.map((d) => [fmtDia(d.data) + "/" + d.chave.slice(0, 4), d.n])]);
      XLSX.writeFile(wb, `Relatorio_anual_${ano}.xlsx`);
      aviso("Planilha gerada.");
    });
  }

  async function slides() {
    const { default: Pptx } = await import("pptxgenjs");
    const t = temaDe(null), hx = (c: string) => c.replace("#", "");
    const COR = { marca: hx(t.marca), esc: hx(t.esc), det: hx(t.detalhe), clara: hx(t.clara), fundo: hx(t.fundo), txt: "1B1B1A", suave: "76766F", linha: "DDDCD6" };
    const pp = new Pptx(); pp.layout = "LAYOUT_WIDE"; pp.title = `Relatório anual ${ano}`;
    const TIT = "Georgia", TXT = "Calibri";
    type Sl = ReturnType<typeof pp.addSlide>;
    const base = (num: string, kicker: string, titulo: string, sub?: string): Sl => {
      const sl = pp.addSlide(); sl.background = { color: COR.fundo };
      sl.addShape("rect", { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: COR.marca } });
      sl.addShape("rect", { x: 0, y: 0, w: 0.22, h: 1.7, fill: { color: COR.det } });
      sl.addText(`${num}  ${kicker.toUpperCase()}`, { x: 0.9, y: 0.45, w: 8, h: 0.3, fontFace: TXT, fontSize: 11, bold: true, color: COR.det, charSpacing: 5 });
      sl.addText(titulo, { x: 0.9, y: 0.78, w: 11.6, h: 0.8, fontFace: TIT, fontSize: 34, bold: true, color: COR.esc });
      if (sub) sl.addText(sub, { x: 0.9, y: 1.52, w: 11.6, h: 0.35, fontFace: TXT, fontSize: 14, color: COR.suave });
      sl.addText(`Vida Vitoriosa · ${ano}`, { x: 0.9, y: 7.0, w: 6, h: 0.3, fontFace: TXT, fontSize: 10, color: COR.suave });
      return sl;
    };
    const dado = (sl: Sl, v: string | number, r: string, x: number, y: number, w: number, tam = 44, cor = COR.marca) => {
      sl.addShape("rect", { x, y, w: w - 0.3, h: 0.04, fill: { color: COR.det } });
      sl.addText(String(typeof v === "number" ? fmtN(v) : v), { x, y: y + 0.12, w: w - 0.3, h: tam / 40, fontFace: TIT, fontSize: tam, bold: true, color: cor });
      sl.addText(r, { x, y: y + 0.2 + tam / 40, w: w - 0.3, h: 0.4, fontFace: TXT, fontSize: 13, color: COR.suave });
    };
    const c = pp.addSlide(); c.background = { color: COR.esc };
    c.addShape("ellipse", { x: 8.3, y: -1.4, w: 7.6, h: 7.6, fill: { color: COR.marca } });
    c.addShape("ellipse", { x: 10.9, y: 4.5, w: 3.8, h: 3.8, fill: { color: COR.det } });
    c.addText("RELATÓRIO ANUAL", { x: 0.9, y: 1.3, w: 8, h: 0.4, fontFace: TXT, fontSize: 14, bold: true, color: COR.det, charSpacing: 8 });
    c.addText(ano, { x: 0.9, y: 1.85, w: 8, h: 2.2, fontFace: TIT, fontSize: 96, bold: true, color: "FFFFFF", valign: "top", fit: "shrink" });
    c.addShape("rect", { x: 0.95, y: 4.35, w: 1.3, h: 0.07, fill: { color: COR.det } });
    c.addText(`${eds.length} edição(ões)  ·  ${fmtN(principais.length)} encontristas`, { x: 0.9, y: 4.65, w: 7.2, h: 0.6, fontFace: TXT, fontSize: 18, color: "E6E6E0" });
    c.addText("VIDA VITORIOSA", { x: 0.9, y: 6.75, w: 6, h: 0.3, fontFace: TXT, fontSize: 11, bold: true, color: COR.det, charSpacing: 6 });

    const d: Deck = { pp, COR, TIT, TXT, base };
    const sexos = Array.from(principais.reduce((m, e) => m.set(e.sexo ?? "", (m.get(e.sexo ?? "") ?? 0) + 1), new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]) as [string, number][];
    let k = 1; const nn = () => String(k++).padStart(2, "0");
    slidePessoas(d, nn(), { cards: [[principais.length, "encontristas no ano"], [equipe, "pessoas na equipe"], [eds.length, "edições"], [nDec, "decisões registradas"]], sexos, titulo: "O ano em números", sub: `${eds.length} edição(ões) em ${ano}` });
    if (principais.length) slidePerfil(d, nn(), perfilAno, `Todas as edições de ${ano} juntas`);
    if (redes.length) slideRedes(d, nn(), redes, `Redes dos encontristas em ${ano}`);
    if (insc.meses.length) {
      const sl = base(nn(), "Inscrições", "Quando as pessoas se inscrevem", "Inscrições por mês, somando as edições do ano");
      cartao(d, sl, 0.9, 2.05, 8.1, 4.8);
      sl.addText("INSCRIÇÕES POR MÊS", { x: 1.25, y: 2.25, w: 5, h: 0.3, fontFace: TXT, fontSize: 10.5, bold: true, color: COR.det, charSpacing: 4 });
      sl.addChart("bar" as never, [{ name: "Inscrições", labels: insc.meses.map((m) => m.rotulo), values: insc.meses.map((m) => m.n) }],
        { x: 1.1, y: 2.6, w: 7.7, h: 4.1, barDir: "col", barGapWidthPct: 45, chartColors: [COR.marca], catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, catAxisLabelColor: COR.suave, valAxisLabelColor: COR.suave, valGridLine: { color: "ECEBE5", size: 0.5 }, showLegend: false, showValue: true, dataLabelFontSize: 11, dataLabelColor: COR.esc } as never);
      ([["Mês com mais inscrições", insc.mesTopNome || "–"], ["Inscrições nesse mês", String(insc.mesTop?.n ?? 0)], ["Dia de pico", insc.pico ? `${fmtDia(insc.pico.data)} · ${insc.pico.n}` : "–"], ["Total no período", String(insc.comData)]] as [string, string][]).forEach(([r, v], idx) => {
        const y = 2.05 + idx * 1.2;
        cartao(d, sl, 9.25, y, 3.25, 1.05);
        sl.addShape("rect", { x: 9.25, y: y + 0.18, w: 0.07, h: 0.69, fill: { color: COR.det } });
        sl.addText(r.toUpperCase(), { x: 9.5, y: y + 0.12, w: 2.9, h: 0.3, fontFace: TXT, fontSize: 9.5, bold: true, color: COR.suave, charSpacing: 3 });
        sl.addText(v, { x: 9.5, y: y + 0.4, w: 2.9, h: 0.55, fontFace: TIT, fontSize: 20, bold: true, color: COR.esc, fit: "shrink" });
      });
    }
    if (porEd.length) {
      const t = base(nn(), "Vida por Vida", "Cada edição em números", "Batismo, célula e rede de cada uma");
      cartao(d, t, 0.9, 2.05, 11.6, 4.8);
      const nb = { type: "none" as const }, fio = (cor: string, pt = 0.75) => ({ type: "solid" as const, color: cor, pt });
      const cab = ["Edição", "Encontristas", "Batizados", "Não batizados", "Em célula", "Sem célula", "Sem rede"].map((h, i) => ({ text: h.toUpperCase(), options: { bold: true, fontSize: 9.5, color: "FFFFFF", fill: { color: COR.marca }, align: i ? "center" : "left", valign: "middle", border: [nb, nb, nb, nb] } }));
      const corpo = porEd.slice(0, 9).map((x, r) => [x.e.nome, x.enc, x.p.bat, x.p.nbat, x.p.cel, x.p.scel, x.p.srede].map((v, i) => ({ text: typeof v === "number" ? fmtN(v) : String(v), options: { align: i ? "center" : "left", bold: i === 0 || i === 1, fontSize: 13, color: i === 0 ? COR.esc : COR.txt, fill: { color: r % 2 ? "FFFFFF" : COR.fundo }, border: [nb, nb, fio(COR.linha), nb] } })));
      t.addTable([cab, ...corpo] as never, { x: 1.15, y: 2.3, w: 11.1, colW: [3.3, 1.4, 1.2, 1.4, 1.3, 1.3, 1.2], fontFace: TXT, rowH: 0.46, valign: "middle" });
      const g = base(nn(), "Vida por Vida", "Quem está mais perto", "Percentual de cada edição sobre seus encontristas");
      cartao(d, g, 0.9, 2.05, 11.6, 4.8);
      g.addChart("bar" as never, [
        { name: "Batizados", labels: porEd.map((x) => x.e.nome), values: porEd.map((x) => pc(x.p.bat, x.p.total)) },
        { name: "Em célula", labels: porEd.map((x) => x.e.nome), values: porEd.map((x) => pc(x.p.cel, x.p.total)) },
        { name: "Com igreja", labels: porEd.map((x) => x.e.nome), values: porEd.map((x) => pc(x.p.igr, x.p.total)) },
      ], { x: 1.1, y: 2.2, w: 11.2, h: 4.5, barDir: "col", barGapWidthPct: 60, chartColors: [COR.marca, COR.det, "9A9A94"], valAxisMaxVal: 100, valAxisLabelFormatCode: "0\"%\"", showLegend: true, legendPos: "b", legendFontSize: 12, legendFontFace: TXT, showValue: true, dataLabelFormatCode: "0\"%\"", dataLabelFontSize: 10, catAxisLabelFontSize: 11, valGridLine: { color: "ECEBE5", size: 0.5 }, catAxisLabelColor: COR.suave, valAxisLabelColor: COR.suave } as never);
    }
    const f = pp.addSlide(); f.background = { color: COR.marca };
    f.addText("Obrigado", { x: 0.9, y: 2.4, w: 9, h: 1.4, fontFace: TIT, fontSize: 64, bold: true, color: "FFFFFF" });
    f.addShape("rect", { x: 0.95, y: 3.95, w: 1.3, h: 0.07, fill: { color: COR.det } });
    f.addText(`Relatório anual ${ano}`, { x: 0.9, y: 4.2, w: 11, h: 0.5, fontFace: TXT, fontSize: 18, color: "FFFFFF" });
    await pp.writeFile({ fileName: `Relatorio_anual_${ano}.pptx` });
    aviso("Apresentação gerada.");
  }

  const Kpi = ({ v, t }: { v: number | string; t: string }) => <div className="rounded-2xl border border-borda bg-white p-3 print:break-inside-avoid"><div className="text-2xl font-extrabold leading-none">{typeof v === "number" ? fmtN(v) : v}</div><div className="mt-1 text-sm text-suave">{t}</div></div>;
  const tema = temaDe(null);

  return (
    <div className="pb-8">
      <div className="print:hidden">
        <Titulo>Relatório anual</Titulo>
        <p className="m-0 pb-3 text-sm text-suave">Soma todas as edições do ano. Disponível só para o administrador geral.</p>
        <div className="flex flex-wrap gap-2 pb-3">{anos.map((a) => <Chip key={a} ativo={a === ano} onClick={() => setAnoSel(a)}>{a}</Chip>)}</div>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => window.print()} className="!min-h-11">Imprimir / salvar PDF</Botao>
          <Botao v="sec" onClick={excel} className="!min-h-11">Baixar Excel</Botao>
          <Botao v="sec" onClick={slides} className="!min-h-11">Baixar apresentação (slides)</Botao>
        </div>
      </div>

      <header className="mt-6 print:mt-0">
        <div className="text-xs font-extrabold uppercase tracking-wide text-marca">Relatório anual</div>
        <h1 className="m-0 text-3xl font-extrabold">{ano}</h1>
        <p className="m-0 text-sm text-suave">{eds.length} edição(ões) · Gerado em {new Date().toLocaleString("pt-BR")}</p>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi v={principais.length} t="encontristas" /><Kpi v={equipe} t="equipe" /><Kpi v={nDec} t="decisões" />
        <Kpi v={`${bat} · ${pct(bat, principais.length)}`} t="batizados" /><Kpi v={`${cel} · ${pct(cel, principais.length)}`} t="em célula" /><Kpi v={`${igr} · ${pct(igr, principais.length)}`} t="com igreja" />
      </div>

      <h2 className="mb-3 mt-8 border-b-2 border-detalhe pb-1.5 text-xl font-extrabold">Perfil espiritual</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:break-inside-avoid">
        {([["Batizados", perfilAno.bat], ["Não batizados", perfilAno.nbat], ["Em célula", perfilAno.cel], ["Sem célula", perfilAno.scel], ["Com igreja", perfilAno.igr], ["Sem igreja", perfilAno.sigr], ["Com rede", perfilAno.comRede], ["Sem rede", perfilAno.srede]] as [string, number][]).map(([t, v]) => (
          <div key={t} className="rounded-2xl border border-borda bg-white p-3"><div className="text-2xl font-extrabold leading-none">{v}<span className="ml-1.5 text-sm font-bold text-suave">{pc(v, perfilAno.total)}%</span></div><div className="mt-1 text-sm text-suave">{t}</div></div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 border-b-2 border-detalhe pb-1.5 text-xl font-extrabold">Redes e inscrições</h2>
      <div className="flex flex-col gap-6 rounded-2xl border border-borda bg-white p-4 print:break-inside-avoid md:flex-row md:items-start">
        <div className="flex flex-col items-center gap-2 md:w-1/2">
          <Pizza fatias={redes.map(([nome, valor]) => ({ nome, valor, cor: corDaRede(nome) }))} />
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">{redes.map(([nome, valor]) => <span key={nome} className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full" style={{ background: corDaRede(nome) }} />{nome} ({valor})</span>)}</div>
        </div>
        <div className="min-w-0 md:w-1/2">
          {insc.comData === 0 ? <Vazio>Sem datas de inscrição neste ano. Reimporte a planilha em “Encontristas”.</Vazio> : (
            <>
              <LinhaTempo dias={insc.dias} acumulado={false} cor={tema.marca} />
              <p className="m-0 mt-2 text-sm">Mês com mais inscrições: <b>{insc.mesTopNome}</b> ({insc.mesTop?.n}) · Dia de pico: <b>{insc.pico ? fmtDia(insc.pico.data) : "–"}</b> ({insc.pico?.n})</p>
              <div className="mt-3 flex flex-col gap-1">
                {insc.meses.map((m) => (
                  <div key={m.chave} className="flex items-center gap-2 text-sm"><span className="w-14 shrink-0">{m.rotulo}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fundo"><div className="h-full rounded-full bg-marca" style={{ width: `${(m.n / Math.max(1, insc.mesTop?.n ?? 1)) * 100}%` }} /></div><b className="w-8 text-right">{m.n}</b></div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-8 border-b-2 border-detalhe pb-1.5 text-xl font-extrabold">Comparativo das edições</h2>
      <div className="overflow-x-auto rounded-2xl border border-borda bg-white print:overflow-visible">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-marca-clara text-left"><th className="px-3 py-2">Edição</th><th className="px-3 py-2">Período</th><th className="px-3 py-2 text-right">Encontristas</th><th className="px-3 py-2 text-right">Equipe</th><th className="px-3 py-2 text-right">Batizados</th><th className="px-3 py-2 text-right">Não batiz.</th><th className="px-3 py-2 text-right">Em célula</th><th className="px-3 py-2 text-right">Sem célula</th><th className="px-3 py-2 text-right">Sem rede</th><th className="px-3 py-2 text-right">Decisões</th></tr></thead>
          <tbody>{porEd.map((x) => <tr key={x.e.id} className="border-t border-borda print:break-inside-avoid"><td className="px-3 py-1.5"><b>{x.e.nome}</b><div className="text-xs text-suave">{descricaoEd(x.e)}</div></td><td className="px-3 py-1.5">{dmy(x.e.data_ini)}</td><td className="px-3 py-1.5 text-right">{x.enc}</td><td className="px-3 py-1.5 text-right">{x.equipe}</td><td className="px-3 py-1.5 text-right">{x.p.bat}</td><td className="px-3 py-1.5 text-right">{x.p.nbat}</td><td className="px-3 py-1.5 text-right">{x.p.cel}</td><td className="px-3 py-1.5 text-right">{x.p.scel}</td><td className="px-3 py-1.5 text-right">{x.p.srede}</td><td className="px-3 py-1.5 text-right">{x.dec}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
