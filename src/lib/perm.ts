export type Perfil = "admin" | "coordenacao" | "financeiro" | "estoque" | "decisoes" | "saude" | "visitante" | "admin_edicao";
export type Acesso = {
  id: string; nome: string; email: string; perfil: Perfil;
  equipes: { nome: string; setores: string[] }[];
  edicoes?: string[];
};

export const PERFIS: Record<Perfil, { nome: string; desc: string }> = {
  admin: { nome: "Administrador", desc: "Tudo, inclusive pessoas e equipes" },
  coordenacao: { nome: "Coordenação", desc: "Edições, financeiro e decisões (sem estoque e sem a ficha dos encontristas)" },
  financeiro: { nome: "Financeiro", desc: "Lançamentos e relatórios do caixa" },
  estoque: { nome: "Estoque (paiol)", desc: "Estoque de todos os setores: envia e confere o material" },
  decisoes: { nome: "Decisões", desc: "Encontristas e registro de decisões" },
  saude: { nome: "Saúde", desc: "Só dados de saúde dos encontristas" },
  admin_edicao: { nome: "Admin de edição", desc: "Ficha, saúde, secretaria, decisões, envio de material e relatório só das edições dele" },
  visitante: { nome: "Visitante", desc: "Só consulta (edições). Sem estoque" },
};

const ESCREVE: Record<Perfil, string[] | "*"> = {
  admin: "*",
  coordenacao: ["edicoes", "financeiro", "decisoes"],
  financeiro: ["financeiro"],
  estoque: ["estoque"],
  decisoes: ["decisoes"],
  saude: ["saude"],
  visitante: [],
  admin_edicao: [],
};
const VE: Record<string, Perfil[]> = {
  financeiro: ["admin", "coordenacao", "financeiro"],
  decisoes: ["admin", "coordenacao", "decisoes", "admin_edicao"],
  encontristas: ["admin", "admin_edicao"],
  pessoas: ["admin"],
};

export const setoresDaEquipe = (a: Acesso | null) => (a ? a.equipes.flatMap((e) => e.setores) : []);

export function podeVer(a: Acesso | null, modulo: string): boolean {
  if (!a) return false;
  if (modulo === "estoque") return podeVerEstoque(a);
  if (modulo === "setores") return ["admin", "estoque", "saude", "admin_edicao"].includes(a.perfil) || setoresDaEquipe(a).length > 0;
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
export const podeVerFicha = (a: Acesso | null) => !!a && ["admin", "admin_edicao"].includes(a.perfil);
/** Lista de saúde (somente dados de saúde): administrador e equipe de Saúde. */
export const podeVerSaude = (a: Acesso | null) => !!a && ["admin", "saude", "admin_edicao"].includes(a.perfil);
/** Secretaria 1 (crachás e quartos): administrador ou quem está na equipe com esse setor. */
export const podeSecretaria = (a: Acesso | null) => !!a && (["admin", "admin_edicao"].includes(a.perfil) || setoresDaEquipe(a).includes("Secretaria 1"));
/** Estoque (geral e por setor). */
export const podeVerEstoque = (a: Acesso | null) => !!a && ["admin", "estoque", "admin_edicao"].includes(a.perfil);
/** Paiol: quem guarda o material, registra o envio e confere o balanço (administrador, coordenação, estoque; admin de edição nas edições dele). */
export const ehPaiol = (a: Acesso | null) => !!a && ["admin", "estoque", "admin_edicao"].includes(a.perfil);
/** Enviar material e fechar balanço: quem edita o setor, ou o admin de edição (na edição dele). */
export const podeEnviar = (a: Acesso | null, setor: string) => !!a && (podeEscrever(a, "estoque", setor) || a.perfil === "admin_edicao");
