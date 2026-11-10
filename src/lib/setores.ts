import { podeSecretaria, podeVerSaude, type Acesso } from "./perm";

export type EntradaSetor = { id: string; nome: string; grupo: "geral" | "setor" };

/** Equipes do site: só Saúde e Secretaria 1. O material fica em Estoque (lista mãe e retirada por edição). */
export function entradasSetores(a: Acesso | null, _setoresDosItens: string[] = []): EntradaSetor[] {
  const l: EntradaSetor[] = [];
  if (podeVerSaude(a)) l.push({ id: "saude", nome: "Saúde", grupo: "geral" });
  if (podeSecretaria(a)) l.push({ id: "secretaria", nome: "Secretaria 1", grupo: "geral" });
  return l;
}
export const hrefSetor = (id: string) => `/setores?aba=${encodeURIComponent(id)}`;
