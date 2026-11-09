// Leitura da planilha de inscrições (xlsx ou csv) e conversão para o formato da função
// `importar_encontristas`. Tudo roda no navegador; nada sai daqui até o usuário confirmar.
import { norm } from "./tipos";

export type ItemImport = {
  cod: string; nome: string; email?: string; fone?: string; endereco?: string; bairro?: string;
  municipio?: string; cep?: string; sexo?: string; idade?: number | null; estado_civil?: string;
  categoria?: string; status?: string; cancelada?: boolean; data_inscricao?: string | null;
  tem_necessidade?: boolean; necessidade?: string; contatos?: string[];
  batizado?: boolean | null; igreja?: string; em_celula?: boolean | null; celula?: string;
  lider_celula?: string; discipulado?: string; rede?: string;
};

// `faltando`: colunas que não vieram na planilha (não bloqueia; o que não veio não é alterado no cadastro).
export type ResultadoLeitura = { itens: ItemImport[]; ignoradas: number; semSaude: boolean; faltando: string[]; semCodigo: boolean };

const txt = (v: unknown) => (v == null ? "" : v instanceof Date ? v.toISOString() : String(v)).replace(/\s+/g, " ").trim();

// descobre a coluna pelo começo do título (já sem acento/pontuação), aceitando variações
function indice(cab: string[], ...pistas: string[]) {
  const n = cab.map((c) => norm(c).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim());
  for (const p of pistas) { const i = n.findIndex((c) => c === p); if (i >= 0) return i; }
  for (const p of pistas) {
    const i = n.findIndex((c) => c.startsWith(p));
    if (i >= 0) return i;
  }
  return -1;
}

const NEGA = new Set(["", "nao", "n", "nenhuma", "nenhum", "nada", "nao tem", "nao tenho", "sem", "-", "0", "x", "xx", "xxx", "xxxx", "xxxxx"]);
const semValor = (s: string) => NEGA.has(norm(s).replace(/[^a-z0-9 ]/g, "").trim());
const simNao = (s: string): boolean | null => {
  const n = norm(s).replace(/[^a-z ]/g, "").trim();
  if (n.startsWith("sim")) return true;
  if (n === "nao" || n.startsWith("nao")) return false;
  return null;
};
const MUNICIPIOS: Record<string, string> = { "nova iguacu": "Nova Iguaçu", rj: "Rio de Janeiro", "rio de janeiro": "Rio de Janeiro", mesquita: "Mesquita", nilopolis: "Nilópolis" };
const padroniza = (m: string) => {
  const s = txt(m);
  if (MUNICIPIOS[norm(s)]) return MUNICIPIOS[norm(s)];
  return s ? s.toLowerCase().replace(/(^|\s)(\S)/g, (_x, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos)\b/g, (x) => x.toLowerCase()) : "";
};

// Aceita data do Excel (Date ou número serial) e texto como 09/11/2026 14:30 ou 2026-11-09.
function lerData(v: unknown): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString();
  const t = String(v ?? "").trim();
  if (!t) return null;
  const br = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\D+(\d{1,2}):(\d{2}))?/);
  if (br) {
    const ano = Number(br[3]) < 100 ? 2000 + Number(br[3]) : Number(br[3]);
    const d = new Date(ano, Number(br[2]) - 1, Number(br[1]), Number(br[4] ?? 12), Number(br[5] ?? 0));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function converter(todas: unknown[][]): ResultadoLeitura {
  // o cabeçalho pode não estar na 1ª linha (títulos acima): procura a linha que tem a coluna "Nome"
  let h = todas.slice(0, 15).findIndex((l) => indice(l.map(txt), "nome completo", "nome") >= 0);
  if (h < 0) h = 0;
  const linhas = todas.slice(h);
  if (linhas.length < 2) return { itens: [], ignoradas: 0, semSaude: true, faltando: [], semCodigo: false };
  const cab = linhas[0].map(txt);
  const c = {
    nome: indice(cab, "nome completo", "nome"), email: indice(cab, "email", "e mail"), cod: indice(cab, "codigo da inscricao", "codigo inscricao", "cod inscricao", "codigo"),
    status: indice(cab, "status"), canc: indice(cab, "cancelada"),
    data: indice(cab, "data da inscri", "data de inscri", "data inscri", "inscrito em", "data do cadastro", "data de cadastro", "data da compra", "data do pedido", "criado em"),
    cat: indice(cab, "categoria"), rede: indice(cab, "qual a rede", "qual e a rede", "rede"),
    cel: indice(cab, "voce participa de celula"), sexo: indice(cab, "sexo"), bairro: indice(cab, "bairro"),
    bat: indice(cab, "voce ja e batizado", "voce e batizado", "batizado"), mun: indice(cab, "municipio", "cidade"),
    end: indice(cab, "endereco"), saude: indice(cab, "voce tem alguma necessidade"), civil: indice(cab, "estado civil"),
    c1: indice(cab, "1 coloque"), c2: indice(cab, "2 coloque"), c3: indice(cab, "3 coloque"),
    disc: indice(cab, "voce faz discipulado"), lider: indice(cab, "qual e o nome e telefone do a seu sua lider", "qual e o nome e telefone do a seu/sua lider"),
    celnome: indice(cab, "nome da celula"), igreja: indice(cab, "voce faz parte de alguma igreja"),
    cep: indice(cab, "cep"), idade: indice(cab, "qual a sua idade", "idade"), fone: indice(cab, "telefone de contato", "telefone", "celular", "whatsapp"),
  };
  if (c.nome < 0) throw new Error("Não achei a coluna “Nome” nesta planilha. Confira se a primeira linha tem os títulos das colunas.");
  const tem = (i: number) => i >= 0;
  const g = (l: unknown[], i: number) => (i < 0 ? "" : txt(l[i]));
  const itens: ItemImport[] = [];
  const vistos = new Set<string>();
  let ignoradas = 0;
  for (const l of linhas.slice(1)) {
    const nome = g(l, c.nome);
    // sem coluna de código: usa o e-mail ou o próprio nome como chave (reimportar atualiza a mesma pessoa)
    const cod = tem(c.cod) ? g(l, c.cod) : (tem(c.email) && g(l, c.email) ? g(l, c.email).toLowerCase() : norm(nome).replace(/\s+/g, " "));
    if (!cod || !nome || vistos.has(cod)) { ignoradas++; continue; }
    vistos.add(cod);
    const it: ItemImport = { cod, nome };
    if (tem(c.email)) it.email = g(l, c.email).toLowerCase();
    if (tem(c.fone)) it.fone = g(l, c.fone).replace(/\D/g, "");
    if (tem(c.end)) it.endereco = g(l, c.end);
    if (tem(c.bairro)) it.bairro = g(l, c.bairro);
    if (tem(c.mun)) it.municipio = padroniza(g(l, c.mun));
    if (tem(c.cep)) it.cep = g(l, c.cep).replace(/\D/g, "");
    if (tem(c.sexo)) it.sexo = padroniza(g(l, c.sexo));
    if (tem(c.idade)) { const n = parseInt(g(l, c.idade).replace(/\D/g, ""), 10); it.idade = isFinite(n) ? n : null; }
    if (tem(c.civil)) it.estado_civil = g(l, c.civil);
    if (tem(c.cat)) it.categoria = g(l, c.cat);
    if (tem(c.status)) it.status = g(l, c.status);
    if (tem(c.canc)) it.cancelada = simNao(g(l, c.canc)) === true;
    if (tem(c.data)) it.data_inscricao = lerData(l[c.data]);
    if (tem(c.saude)) { const nec = g(l, c.saude); it.tem_necessidade = !semValor(nec); it.necessidade = semValor(nec) ? "" : nec; }
    if (tem(c.c1) || tem(c.c2) || tem(c.c3)) it.contatos = [g(l, c.c1), g(l, c.c2), g(l, c.c3)].filter((x) => !semValor(x));
    if (tem(c.bat)) it.batizado = simNao(g(l, c.bat));
    if (tem(c.igreja)) { const x = g(l, c.igreja); it.igreja = semValor(x) ? "" : x; }
    if (tem(c.cel)) it.em_celula = simNao(g(l, c.cel));
    if (tem(c.celnome)) { const x = g(l, c.celnome); it.celula = semValor(x) ? "" : x; }
    if (tem(c.lider)) { const x = g(l, c.lider); it.lider_celula = semValor(x) ? "" : x; }
    if (tem(c.disc)) { const x = g(l, c.disc); it.discipulado = semValor(x) ? "" : x; }
    if (tem(c.rede)) { const x = g(l, c.rede); it.rede = norm(x).startsWith("ainda nao") ? "Sem rede" : x; }
    itens.push(it);
  }
  const faltando = ([["código da inscrição", c.cod], ["categoria", c.cat], ["sexo", c.sexo], ["data da inscrição", c.data], ["necessidade de saúde", c.saude], ["batizado", c.bat], ["célula", c.cel], ["igreja", c.igreja], ["rede", c.rede]] as [string, number][])
    .filter(([, i]) => i < 0).map(([n]) => n);
  return { itens, ignoradas, semSaude: c.saude < 0, faltando, semCodigo: c.cod < 0 };
}

function csv(texto: string, sep: string): string[][] {
  const out: string[][] = []; let l: string[] = [], cur = "", asp = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (asp) {
      if (ch === '"') { if (texto[i + 1] === '"') { cur += '"'; i++; } else asp = false; } else cur += ch;
    } else if (ch === '"') asp = true;
    else if (ch === sep) { l.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && texto[i + 1] === "\n") i++; l.push(cur); cur = ""; if (l.some((x) => x !== "")) out.push(l); l = []; }
    else cur += ch;
  }
  if (cur !== "" || l.length) { l.push(cur); out.push(l); }
  return out;
}

export async function lerArquivo(f: File): Promise<ResultadoLeitura> {
  if (/\.xlsx$/i.test(f.name)) {
    const { default: lerTodas } = await import("read-excel-file/browser");
    const abas = await lerTodas(f);
    // usa a aba com mais linhas (a base completa); as demais costumam ser listas de trabalho filtradas
    const aba = abas.slice().sort((a, b) => b.data.length - a.data.length)[0];
    return converter(aba.data as unknown[][]);
  }
  if (/\.csv$/i.test(f.name)) {
    const buf = await f.arrayBuffer();
    let t: string;
    try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { t = new TextDecoder("latin1").decode(buf); }
    t = t.replace(/^﻿/, "");
    const prim = t.split(/\r?\n/, 1)[0] ?? "";
    const sep = prim.split(";").length > prim.split(",").length ? ";" : ",";
    return converter(csv(t, sep));
  }
  throw new Error("Envie um arquivo .xlsx ou .csv.");
}
