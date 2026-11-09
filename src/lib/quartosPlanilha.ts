import { norm } from "./tipos";

export type LinhaQuarto = { quarto: string; vagas: number | null; nomes: string[] };

/** Modelo para preencher: uma linha por quarto, com colunas Encontrista 1..N. */
export async function baixarModeloQuartos(qtd: number, colunas = 8) {
  const XLSX = await import("xlsx");
  const cab = ["Quarto", "Vagas (opcional)", ...Array.from({ length: colunas }, (_, i) => `Encontrista ${i + 1}`)];
  const linhas = Array.from({ length: qtd }, (_, i) => [`Quarto ${i + 1}`, "", ...Array(colunas).fill("")]);
  const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
  ws["!cols"] = [{ wch: 14 }, { wch: 16 }, ...Array(colunas).fill({ wch: 30 })];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Quartos");
  XLSX.writeFile(wb, "Modelo_quartos.xlsx");
}

/** Lê a planilha preenchida. Aceita uma linha por quarto (várias colunas de nomes) ou uma linha por pessoa (Quarto + Encontrista). */
export async function lerQuartos(f: File): Promise<LinhaQuarto[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" }) as unknown[][];
  if (rows.length < 2) return [];
  const cab = rows[0].map((c) => norm(String(c)));
  const iq = Math.max(0, cab.findIndex((c) => c.startsWith("quarto")));
  const iv = cab.findIndex((c) => c.startsWith("vagas"));
  const iNomes = cab.map((c, i) => (i !== iq && i !== iv && c !== "" ? i : -1)).filter((i) => i >= 0);
  const por = new Map<string, LinhaQuarto>();
  for (const r of rows.slice(1)) {
    const q = String(r[iq] ?? "").trim();
    if (!q) continue;
    const k = norm(q);
    const l = por.get(k) ?? { quarto: q, vagas: null, nomes: [] };
    const v = iv >= 0 ? Number(String(r[iv] ?? "").replace(",", ".")) : NaN;
    if (isFinite(v) && v > 0) l.vagas = Math.min(60, Math.round(v));
    for (const i of iNomes) { const n = String(r[i] ?? "").trim(); if (n && !l.nomes.some((x) => norm(x) === norm(n))) l.nomes.push(n); }
    por.set(k, l);
  }
  return Array.from(por.values());
}

const limpo = (t: string) => norm(t).replace(/[^a-z0-9]+/g, " ").trim();

/** Acha o encontrista pelo nome: igual, ou todas as palavras digitadas contidas no nome (se só uma pessoa servir). */
export function acharPessoa<T extends { nome: string }>(nome: string, pessoas: T[]): T | null {
  const n = limpo(nome);
  if (!n) return null;
  const igual = pessoas.filter((p) => limpo(p.nome) === n);
  if (igual.length === 1) return igual[0];
  if (igual.length > 1) return null;
  const palavras = n.split(" ");
  const parecidos = pessoas.filter((p) => { const pn = " " + limpo(p.nome) + " "; return palavras.every((w) => pn.includes(" " + w + " ")); });
  return parecidos.length === 1 ? parecidos[0] : null;
}
