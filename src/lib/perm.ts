export type Perfil = "admin" | "coordenacao" | "financeiro" | "estoque" | "decisoes" | "visitante";
export type Acesso = {
  id: string; nome: string; email: string; perfil: Perfil;
  equipes: { nome: string; setores: string[] }[];
};

export const PERFIS: Record<Perfil, { nome: string; desc: string }> = {
  admin: { nome: "Administrador", desc: "Tudo, inclusive pessoas e equipes" },
  coordenacao: { nome: "Coordenação", desc: "Edições, estoque, financeiro e decisões" },
  financeiro: { nome: "Financeiro", desc: "Lançamentos e relatórios do caixa" },
  estoque: { nome: "Estoque", desc: "Estoque de todos os setores" },
  decisoes: { nome: "Decisões", desc: "Encontristas e registro de decisões" },
  visitante: { nome: "Visitante", desc: "Só consulta (edições e estoque)" },
};

const ESCREVE: Record<Perfil, string[] | "*"> = {
  admin: "*",
  coordenacao: ["edicoes", "estoque", "financeiro", "decisoes"],
  financeiro: ["financeiro"],
  estoque: ["estoque"],
  decisoes: ["decisoes"],
  visitante: [],
};
const VE: Record<string, Perfil[]> = {
  financeiro: ["admin", "coordenacao", "financeiro"],
  decisoes: ["admin", "coordenacao", "decisoes"],
  pessoas: ["admin"],
};

export const setoresDaEquipe = (a: Acesso | null) => (a ? a.equipes.flatMap((e) => e.setores) : []);

export function podeVer(a: Acesso | null, modulo: string): boolean {
  if (!a) return false;
  const l = VE[modulo];
  return !l || l.includes(a.perfil);
}

export function podeEscrever(a: Acesso | null, modulo: string, setor?: string): boolean {
  if (!a) return false;
  const e = ESCREVE[a.perfil];
  if (e === "*" || e.includes(modulo)) return true;
  if (modulo === "estoque" && setor) return setoresDaEquipe(a).includes(setor);
  return false;
}
