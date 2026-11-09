import { norm } from "./tipos";

export type ItemInv = { setor: string; nome: string; un: string; qtd: number; min: number; cons: boolean; obs: string | null };

const SETORES: Record<string, string> = {
  "secretaria 1": "Secretaria 1", "secretaria 2": "Secretaria 2", dinamica: "Material de Dinâmicas", descartavel: "Descartáveis",
  "check-in / recepcao": "Recepcao", saude: "Saúde", refeitorio: "Refeitório", intercessao: "Intercessão",
};
const SETORES_BONITOS: Record<string, string> = { Recepcao: "Recepção" };
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "p/", "c/", "sem", "a", "o", "na", "no", "em"]);
const CONS = /bom-bom|bala menta|balões|balao|bola nº|fogos|álcool|alcool|pilhas|papel vegetal|tinta|folha a4|plástico a4|plástico rolo|plástico do crach|etiqueta|fita adesiva|grapos|sacos para celular|veste do filho|anel filho|caneta|bloco|lenço|chinelos|copos personalizados|crach|jacaré|sacola do correio|gás hélio|toalhinhas|cachepô|fantasminha/i;

const titulo = (t: string) =>
  t.replace(/\s+/g, " ").replace(/ -(?=\S)/g, "-").trim().toLowerCase().split(" ").map((p, i) => {
    if (/\d/.test(p) || /^(vv|aa|l|ml|a4|p\/c)$/i.test(p)) return p.toUpperCase();
    if (i > 0 && MINUSCULAS.has(p)) return p;
    return p.replace(/(^|[(\-/])([a-zà-ú])/g, (_, a, b) => a + b.toUpperCase());
  }).join(" ");

const setorDe = (t: string) => {
  const k = norm(t);
  const s = SETORES[k] ?? titulo(t);
  return SETORES_BONITOS[s] ?? s;
};

function unidade(medida: string, nome: string): { un: string; nome: string } {
  const m = medida.trim().toUpperCase();
  const pack = /(\d+)/.exec(m);
  if (m.startsWith("PCT")) return { un: "pacotes", nome: pack && !/pacote c\//i.test(nome) ? `${nome} (pacote c/ ${pack[1]})` : nome };
  if (m.startsWith("CX") || m === "CAIXA") return { un: "caixas", nome: pack && m.startsWith("CX (") ? `${nome} (caixa c/ ${pack[1]})` : nome };
  const mapa: Record<string, string> = { PAR: "pares", ROLO: "rolos", GARRAFA: "garrafas", CILINDRO: "cilindros" };
  return { un: mapa[m] ?? "un", nome };
}

const numero = (v: unknown): number | null => {
  if (typeof v === "number" && isFinite(v)) return v;
  const t = String(v ?? "").trim().replace(",", ".");
  return t !== "" && isFinite(Number(t)) ? Number(t) : null;
};

/** Lê o inventário (.xls ou .xlsx) no modelo atual: setores em linhas soltas e colunas ITENS / MEDIDA / ESTOQUE ATUAL / NECESSIDADE / OBS. */
export async function lerInventario(arquivo: File): Promise<{ itens: ItemInv[]; setores: string[]; ignorados: number }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
  let melhor: ItemInv[] = [], ign = 0;
  for (const nomeAba of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, defval: "", blankrows: false });
    const itens: ItemInv[] = [], vistos = new Set<string>();
    let setor = "", col = { med: 1, est: 2, nec: 3, obs: 6 }, achouCab = false, ignorados = 0;
    for (const l of linhas) {
      const c0 = String(l[0] ?? "").trim();
      if (!c0) continue;
      const preenchidas = l.filter((x) => String(x ?? "").trim() !== "").length;
      if (norm(c0).replace(":", "") === "itens") {
        const h = l.map((x) => norm(String(x ?? "")));
        const ix = (...nomes: string[]) => h.findIndex((x) => nomes.some((n) => x.startsWith(n)));
        col = { med: ix("medida"), est: ix("estoque atual", "quantidade"), nec: ix("necessidade"), obs: ix("obs") };
        achouCab = true; continue;
      }
      if (preenchidas <= 2) { setor = setorDe(c0); continue; } // linha de setor (ignora o título do arquivo)
      if (!achouCab || !setor) continue;
      const u = unidade(String(l[col.med] ?? ""), titulo(c0));
      const bruto = col.est >= 0 ? l[col.est] : "";
      const qtd = numero(bruto);
      const obsTxt = [col.obs >= 0 ? String(l[col.obs] ?? "").trim() : "", qtd === null && String(bruto).trim() ? `Planilha: ${String(bruto).trim()}` : ""].filter(Boolean).join(" · ");
      const chave = setor + "|" + norm(u.nome);
      if (vistos.has(chave)) { ignorados++; continue; }
      vistos.add(chave);
      itens.push({
        setor, nome: u.nome, un: u.un, qtd: qtd ?? 0, min: (col.nec >= 0 ? numero(l[col.nec]) : null) ?? 0,
        cons: ["Descartáveis", "Limpeza", "Quarto"].includes(setor) || CONS.test(u.nome), obs: obsTxt || null,
      });
    }
    if (itens.length > melhor.length) { melhor = itens; ign = ignorados; }
  }
  return { itens: melhor, setores: Array.from(new Set(melhor.map((i) => i.setor))), ignorados: ign };
}
