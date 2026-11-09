// Leitura da planilha de inscrições (xlsx ou csv) e conversão para o formato da função
// `importar_encontristas`. Tudo roda no navegador; nada sai daqui até o usuário confirmar.
import { norm } from "./tipos";

export type ItemImport = {
  cod: string; nome: string; email?: string; fone?: string; endereco?: string; bairro?: string;
  municipio?: string; cep?: string; sexo?: string; idade?: number | null; estado_civil?: string;
  categoria?: string; status?: string; cancelada: boolean; data_inscricao?: string | null;
  tem_necessidade: boolean; necessidade?: string; contatos: string[];
  batizado: boolean | null; igreja?: string; em_celula: boolean | null; celula?: string;
  lider_celula?: string; discipulado?: string; rede?: string;
};

export type ResultadoLeitura = { itens: ItemImport[]; ignoradas: number; semSaude: boolean };

const txt = (v: unknown) => (v == null ? "" : v instanceof Date ? v.toISOString() : String(v)).replace(/\s+/g, " ").trim();

// descobre a coluna pelo começo do título (já sem acento/pontuação), aceitando variações
function indice(cab: string[], ...pistas: string[]) {
  const n = cab.map((c) => norm(c).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim());
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

export function converter(linhas: unknown[][]): ResultadoLeitura {
  if (linhas.length < 2) return { itens: [], ignoradas: 0, semSaude: true };
  const cab = linhas[0].map(txt);
  const c = {
    nome: indice(cab, "nome"), email: indice(cab, "email"), cod: indice(cab, "codigo da inscricao"),
    status: indice(cab, "status"), canc: indice(cab, "cancelada"), data: indice(cab, "data da inscricao"),
    cat: indice(cab, "categoria"), rede: indice(cab, "qual a rede", "qual e a rede"),
    cel: indice(cab, "voce participa de celula"), sexo: indice(cab, "sexo"), bairro: indice(cab, "bairro"),
    bat: indice(cab, "voce ja e batizado", "voce e batizado"), mun: indice(cab, "municipio"),
    end: indice(cab, "endereco"), saude: indice(cab, "voce tem alguma necessidade"), civil: indice(cab, "estado civil"),
    c1: indice(cab, "1 coloque"), c2: indice(cab, "2 coloque"), c3: indice(cab, "3 coloque"),
    disc: indice(cab, "voce faz discipulado"), lider: indice(cab, "qual e o nome e telefone do a seu sua lider", "qual e o nome e telefone do a seu/sua lider"),
    celnome: indice(cab, "nome da celula"), igreja: indice(cab, "voce faz parte de alguma igreja"),
    cep: indice(cab, "cep"), idade: indice(cab, "qual a sua idade"), fone: indice(cab, "telefone de contato"),
  };
  if (c.cod < 0 || c.nome < 0) throw new Error("Não achei as colunas “Nome” e “Código da inscrição”. Esta planilha é da inscrição?");
  const g = (l: unknown[], i: number) => (i < 0 ? "" : txt(l[i]));
  const itens: ItemImport[] = [];
  let ignoradas = 0;
  for (const l of linhas.slice(1)) {
    const cod = g(l, c.cod), nome = g(l, c.nome);
    if (!cod || !nome) { ignoradas++; continue; }
    const necessidade = g(l, c.saude);
    const idadeN = parseInt(g(l, c.idade).replace(/\D/g, ""), 10);
    const lider = g(l, c.lider), disc = g(l, c.disc), celNome = g(l, c.celnome), igreja = g(l, c.igreja);
    const rede = g(l, c.rede);
    const d = l[c.data];
    itens.push({
      cod, nome, email: g(l, c.email).toLowerCase(), fone: g(l, c.fone).replace(/\D/g, ""),
      endereco: g(l, c.end), bairro: g(l, c.bairro), municipio: padroniza(g(l, c.mun)),
      cep: g(l, c.cep).replace(/\D/g, ""), sexo: padroniza(g(l, c.sexo)),
      idade: isFinite(idadeN) ? idadeN : null, estado_civil: g(l, c.civil),
      categoria: g(l, c.cat), status: g(l, c.status), cancelada: simNao(g(l, c.canc)) === true,
      data_inscricao: d instanceof Date ? d.toISOString() : null,
      tem_necessidade: !semValor(necessidade), necessidade: semValor(necessidade) ? "" : necessidade,
      contatos: [g(l, c.c1), g(l, c.c2), g(l, c.c3)].filter((x) => !semValor(x)),
      batizado: simNao(g(l, c.bat)), igreja: semValor(igreja) ? "" : igreja,
      em_celula: simNao(g(l, c.cel)), celula: semValor(celNome) ? "" : celNome,
      lider_celula: semValor(lider) ? "" : lider, discipulado: semValor(disc) ? "" : disc,
      rede: norm(rede).startsWith("ainda nao") ? "Sem rede" : rede,
    });
  }
  return { itens, ignoradas, semSaude: c.saude < 0 };
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
