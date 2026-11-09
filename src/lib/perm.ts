export type Perfil = "admin" | "coordenacao" | "financeiro" | "estoque" | "decisoes" | "saude" | "visitante";
export type Acesso = {
  id: string; nome: string; email: string; perfil: Perfil;
  equipes: { nome: string; setores: string[] }[];
};

export const PERFIS: Record<Perfil, { nome: string; desc: string }> = {
  admin: { nome: "Administrador", desc: "Tudo, inclusive pessoas e equipes" },
  coordenacao: { nome: "Coordenação", desc: "Edições, estoque, financeiro e decisões (sem a ficha dos encontristas)" },
  financeiro: { nome: "Financeiro", desc: "Lançamentos e relatórios do caixa" },
  estoque: { nome: "Estoque", desc: "Estoque de todos os setores" },
  decisoes: { nome: "Decisões", desc: "Encontristas e registro de decisões" },
  saude: { nome: "Saúde", desc: "Só dados de saúde dos encontristas" },
  visitante: { nome: "Visitante", desc: "Só consulta (edições e estoque)" },
};

const ESCREVE: Record<Perfil, string[] | "*"> = {
  admin: "*",
  coordenacao: ["edicoes", "estoque", "financeiro", "decisoes"],
  financeiro: ["financeiro"],
  estoque: ["estoque"],
  decisoes: ["decisoes"],
  saude: ["saude"],
  visitante: [],
};
const VE: Record<string, Perfil[]> = {
  financeiro: ["admin", "coordenacao", "financeiro"],
  decisoes: ["admin", "coordenacao", "decisoes"],
  encontristas: ["admin"],
  pessoas: ["admin"],
};

export const setoresDaEquipe = (a: Acesso | null) => (a ? a.equipes.flatMap((e) => e.setores) : []);

export function podeVer(a: Acesso | null, modulo: string): boolean {
  if (!a) return false;
  if (modulo === "setores") return ["admin", "coordenacao", "estoque", "saude"].includes(a.perfil) || setoresDaEquipe(a).length > 0;
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

/** Ficha completa (planilha de encontristas): só administrador. */
export const podeVerFicha = (a: Acesso | null) => !!a && a.perfil === "admin";
/** Lista de saúde (somente dados de saúde): administrador e equipe de Saúde. */
export const podeVerSaude = (a: Acesso | null) => !!a && ["admin", "saude"].includes(a.perfil);
/** Secretaria 1 (crachás e quartos): administrador ou quem está na equipe com esse setor. */
export const podeSecretaria = (a: Acesso | null) => !!a && (a.perfil === "admin" || setoresDaEquipe(a).includes("Secretaria 1"));
/** Estoque (geral e por setor). */
export const podeVerEstoque = (a: Acesso | null) => !!a && ["admin", "coordenacao", "estoque", "visitante", "financeiro", "decisoes"].includes(a.perfil);
