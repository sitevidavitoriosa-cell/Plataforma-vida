export type Perfil = "admin" | "coordenacao" | "financeiro" | "estoque" | "decisoes" | "saude" | "visitante";
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
  saude: { nome: "Saúde", desc: "Ficha de saúde dos encontristas" },
  visitante: { nome: "Visitante", desc: "Só consulta (edições e estoque)" },
};

const ESCREVE: Record<Perfil, string[] | "*"> = {
  admin: "*",
  coordenacao: ["edicoes", "estoque", "financeiro", "decisoes", "encontristas"],
  financeiro: ["financeiro"],
  estoque: ["estoque"],
  decisoes: ["decisoes"],
  saude: ["saude"],
  visitante: [],
};
const VE: Record<string, Perfil[]> = {
  financeiro: ["admin", "coordenacao", "financeiro"],
  decisoes: ["admin", "coordenacao", "decisoes"],
  encontristas: ["admin", "coordenacao", "decisoes", "saude"],
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

/** Dados de saúde dos encontristas: espelham as regras do banco. */
export const podeVerSaude = (a: Acesso | null) => !!a && ["admin", "coordenacao", "saude"].includes(a.perfil);
/** Dados espirituais (batismo, igreja, célula…). */
export const podeVerEspiritual = (a: Acesso | null) => !!a && ["admin", "coordenacao", "decisoes"].includes(a.perfil);
