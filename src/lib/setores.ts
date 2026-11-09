import { podeSecretaria, podeVerEstoque, podeVerSaude, setoresDaEquipe, type Acesso } from "./perm";

export type EntradaSetor = { id: string; nome: string; grupo: "geral" | "setor" };
const ESPECIAIS = ["Secretaria 1", "Saúde"];

/** Abas/subdivisões de Setores que a pessoa pode ver: Estoque geral, Saúde, Secretaria 1 e cada setor do estoque. */
export function entradasSetores(a: Acesso | null, setoresDosItens: string[]): EntradaSetor[] {
  const l: EntradaSetor[] = [];
  if (podeVerEstoque(a)) l.push({ id: "estoque", nome: "Estoque geral", grupo: "geral" });
  if (podeVerSaude(a)) l.push({ id: "saude", nome: "Saúde", grupo: "geral" });
  if (podeSecretaria(a)) l.push({ id: "secretaria", nome: "Secretaria 1", grupo: "geral" });
  const visiveis = podeVerEstoque(a) ? setoresDosItens : [];
  Array.from(new Set([...visiveis, ...setoresDaEquipe(a)]))
    .filter((s) => !ESPECIAIS.includes(s))
    .sort((x, y) => x.localeCompare(y))
    .forEach((s) => l.push({ id: "setor:" + s, nome: s, grupo: "setor" }));
  return l;
}
export const hrefSetor = (id: string) => `/setores?aba=${encodeURIComponent(id)}`;
