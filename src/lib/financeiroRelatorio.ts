import { brl, dmy, fmtN } from "./tipos";

export type LinhaGrafico = { nome: string; pago: number; previsto: number };
export type DadosRelatorio = {
  titulo: string;               // nome da edição ou "Todas as edições"
  subtitulo: string;
  cor: string;                  // cor principal (hex)
  entrou: number; saiu: number; aPagar: number;
  porEdicao?: { nome: string; entrou: number; saiu: number; aPagar: number }[];
  porCategoria: LinhaGrafico[];
  porSetor: LinhaGrafico[];
  compras: { data: string; item: string; setor: string; qtd: number; valor: number; edicao?: string }[];
  aComprar: { item: string; setor: string; falta: number; un: string; preco: number; previsto: number }[];
  alugueis: { item: string; qtd: number; fornecedor: string; valor: number; pago: boolean; edicao?: string }[];
  lancamentos: { data: string; tipo: "entrada" | "saida"; descricao: string; categoria: string; setor: string; valor: number; edicao?: string }[];
};

const esc = (t: string) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cor = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#16294d");

function barras(titulo: string, l: LinhaGrafico[], c: string) {
  const max = Math.max(1, ...l.map((x) => x.pago + x.previsto));
  return `<div class="card"><h3>${esc(titulo)}</h3>${l.length === 0 ? '<p class="mut">Nada registrado.</p>' : l.map((x) => `<div class="br"><span class="nm">${esc(x.nome)}</span><span class="tr"><i style="width:${(x.pago / max) * 100}%;background:${c}"></i><i style="width:${(x.previsto / max) * 100}%;background:#e8a400"></i></span><b>${brl(x.pago + x.previsto)}</b></div>`).join("")}<p class="leg"><i style="background:${c}"></i> Pago <i style="background:#e8a400"></i> A pagar</p></div>`;
}

/** Relatório financeiro completo, pronto para imprimir ou salvar em PDF (A4). */
export function relatorioFinanceiroHtml(d: DadosRelatorio): string {
  const c = cor(d.cor);
  const sobra = d.entrou - d.saiu, caixa = sobra - d.aPagar;
  const multi = !!d.porEdicao;
  const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const tabela = (cab: string[], linhas: string[][], dir: number[] = []) =>
    `<table><thead><tr>${cab.map((h, i) => `<th${dir.includes(i) ? ' class="r"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((v, i) => `<td${dir.includes(i) ? ' class="r"' : ""}>${v}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const sec = (t: string, corpo: string, n?: number) => `<section><h2>${esc(t)}${n != null ? ` <small>${n}</small>` : ""}</h2>${corpo}</section>`;

  const kpis = `<div class="kp"><div><span>Entrou</span><b class="v">${brl(d.entrou)}</b></div><div><span>Saiu (pago)</span><b class="n">${brl(d.saiu)}</b></div><div><span>Sobrou agora</span><b class="${sobra < 0 ? "n" : ""}">${brl(sobra)}</b></div><div class="am"><span>Ainda a pagar</span><b>${brl(d.aPagar)}</b></div></div>
  <p class="cx">Se tudo que está previsto for pago, o caixa fica em <b class="${caixa < 0 ? "n" : "v"}">${brl(caixa)}</b>.</p>`;

  const corpo = [
    kpis,
    multi ? sec("Por edição", tabela(["Edição", "Entrou", "Saiu", "Aluguéis a pagar", "Resultado"], d.porEdicao!.map((e) => [esc(e.nome), brl(e.entrou), brl(e.saiu), brl(e.aPagar), `<b class="${e.entrou - e.saiu < 0 ? "n" : ""}">${brl(e.entrou - e.saiu)}</b>`]), [1, 2, 3, 4]) + '<p class="mut">A reposição de estoque a comprar não pertence a uma edição ainda: ela entra na edição escolhida quando a compra é confirmada.</p>') : "",
    `<div class="duas">${barras("Por categoria", d.porCategoria, c)}${barras("Por setor", d.porSetor, c)}</div>`,
    sec("Compras de reposição feitas", d.compras.length ? tabela([...(multi ? ["Edição"] : []), "Data", "Item", "Setor", "Qtd", "Valor"], d.compras.map((x) => [...(multi ? [esc(x.edicao ?? "")] : []), dmy(x.data), esc(x.item), esc(x.setor), fmtN(x.qtd), brl(x.valor)]), [multi ? 4 : 3, multi ? 5 : 4]) : '<p class="mut">Nenhuma compra de reposição lançada.</p>', d.compras.length),
    sec("Ainda a comprar (abaixo do mínimo)", d.aComprar.length ? tabela(["Item", "Setor", "Comprar", "Preço unit.", "Previsto"], d.aComprar.map((x) => [esc(x.item), esc(x.setor), `${fmtN(x.falta)} ${esc(x.un)}`, x.preco > 0 ? brl(x.preco) : '<span class="n">sem preço</span>', brl(x.previsto)]), [2, 3, 4]) : '<p class="mut">Nada abaixo do mínimo agora.</p>', d.aComprar.length),
    sec("Itens alugados", d.alugueis.length ? tabela([...(multi ? ["Edição"] : []), "Item", "Qtd", "Fornecedor", "Valor", "Situação"], d.alugueis.map((x) => [...(multi ? [esc(x.edicao ?? "")] : []), esc(x.item), fmtN(x.qtd), esc(x.fornecedor), brl(x.valor), x.pago ? "Pago" : '<b class="am2">A pagar</b>']), [multi ? 2 : 1, multi ? 4 : 3]) : '<p class="mut">Nenhum aluguel registrado.</p>', d.alugueis.length),
    sec("Todos os lançamentos", d.lancamentos.length ? tabela([...(multi ? ["Edição"] : []), "Data", "Descrição", "Categoria", "Setor", "Valor"], d.lancamentos.map((x) => [...(multi ? [esc(x.edicao ?? "")] : []), dmy(x.data), esc(x.descricao), esc(x.categoria), esc(x.setor), `<b class="${x.tipo === "saida" ? "n" : "v"}">${x.tipo === "saida" ? "− " : "+ "}${brl(x.valor)}</b>`]), [multi ? 5 : 4]) : '<p class="mut">Nenhum lançamento.</p>', d.lancamentos.length),
  ].join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Financeiro · ${esc(d.titulo)}</title><style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#1c2333;margin:0;padding:0 2px}
.top{background:${c};color:#fff;border-radius:12px;padding:16px 18px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
.top h1{margin:0;font-size:22px}.top p{margin:3px 0 0;font-size:11.5px;opacity:.9}.top .dt{font-size:10.5px;text-align:right;opacity:.9}
.kp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.kp div{border:1px solid #d8dde6;border-radius:10px;padding:9px 11px}.kp span{display:block;font-size:10px;color:#667085;text-transform:uppercase;letter-spacing:.04em}.kp b{font-size:17px}
.kp .am{border:2px solid #e8a400}
.v{color:#1e7a50}.n{color:#c0392b}.am2{color:#b27800}.mut{color:#667085;margin:4px 0}.cx{margin:8px 0 2px}
section{margin-top:16px;break-inside:auto}
h2{font-size:14px;margin:0 0 6px;padding-bottom:4px;border-bottom:2px solid ${c}}h2 small{font-weight:400;color:#667085;font-size:11px;margin-left:6px}
h3{margin:0 0 8px;font-size:12.5px}
table{width:100%;border-collapse:collapse}
th{background:#eef1f6;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#475467;padding:5px 7px;border-bottom:1px solid #d0d5dd}
td{padding:5px 7px;border-bottom:1px solid #e8ebf1;vertical-align:top}
tr{break-inside:avoid}tbody tr:nth-child(even) td{background:#fafbfc}
.r{text-align:right;white-space:nowrap}
.duas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;break-inside:avoid}
.card{border:1px solid #d8dde6;border-radius:10px;padding:10px 12px}
.br{display:flex;align-items:center;gap:8px;margin:4px 0}.br .nm{width:120px;font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:10.5px}
.br .tr{flex:1;height:9px;background:#eef1f6;border-radius:6px;display:flex;overflow:hidden}.br .tr i{display:block;height:100%}
.br b{width:70px;text-align:right;font-size:10.5px}
.leg{font-size:10px;color:#667085;margin:8px 0 0}.leg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 3px 0 8px}
.rod{margin-top:18px;font-size:10px;color:#98a2b3;text-align:center}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="top"><div><h1>Relatório financeiro</h1><p>${esc(d.titulo)} · ${esc(d.subtitulo)}</p></div><div class="dt">Vida Vitoriosa<br>gerado em ${agora}</div></div>
${corpo}
<p class="rod">Vida Vitoriosa · Plataforma de Gestão</p>
</body></html>`;
}
