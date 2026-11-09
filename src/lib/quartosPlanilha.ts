import { norm } from "./tipos";

/** Modelo vazio com a coluna Encontrista (uma linha por vaga do quarto). */
export async function baixarModeloQuarto(vagas: number, nomeQuarto: string) {
  const XLSX = await import("xlsx");
  const linhas = Array.from({ length: Math.max(1, vagas) }, () => [""]);
  const ws = XLSX.utils.aoa_to_sheet([["Encontrista"], ...linhas]);
  ws["!cols"] = [{ wch: 42 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (nomeQuarto || "Quarto").slice(0, 28));
  XLSX.writeFile(wb, "Modelo_quarto.xlsx");
}

/** Lê os nomes da primeira coluna (ignora o cabeçalho "Encontrista" e linhas vazias). */
export async function lerNomesQuarto(f: File): Promise<string[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: "" }) as unknown[][];
  return rows.map((r) => String(r[0] ?? "").trim()).filter((n, i) => n && !(i === 0 && norm(n).startsWith("encontrista")));
}

const limpo = (t: string) => norm(t).replace(/[^a-z0-9]+/g, " ").trim();

/** Acha a pessoa pelo nome: igual, ou todas as palavras contidas no nome (se só uma pessoa servir). */
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
