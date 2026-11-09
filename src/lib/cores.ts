// Cores das redes. Cada edição tem a cor da sua rede; o site inteiro usa essa cor como destaque.
export const CORES: Record<string, { hex: string; esc: string; clara: string }> = {
  Roxa: { hex: "#6b4fbb", esc: "#4a3590", clara: "#f0ecfa" },
  Azul: { hex: "#2f6fdb", esc: "#1f4fa8", clara: "#e6eefb" },
  Amarela: { hex: "#c78f00", esc: "#8a5f00", clara: "#fff4d6" },
  Laranja: { hex: "#e8772e", esc: "#a8501a", clara: "#ffeedf" },
  Vermelha: { hex: "#d8543a", esc: "#9e3420", clara: "#fdebe6" },
  Verde: { hex: "#2e9e6b", esc: "#1e7a50", clara: "#e3f5ec" },
  Branca: { hex: "#6b6b66", esc: "#3f3f3b", clara: "#f1f1ef" },
};
export const NOMES_COR = Object.keys(CORES);
export const TIPOS: Record<string, string> = { base: "Base", kids: "Kids", beone: "BeOne" };
export const corDe = (nome?: string | null) => CORES[nome ?? ""] ?? CORES.Roxa;

export type Tema = { marca: string; esc: string; clara: string; detalhe: string; fundo: string };
type EdLike = { tipo?: string | null; cor?: string | null; rede2?: string | null };
const AZUL = { marca: "#16294d", esc: "#0e1c38", clara: "#e8edf7", fundo: "#fafaf9" };
const CINZA: Tema = { marca: "#5a5a56", esc: "#3a3a37", clara: "#efefed", detalhe: "#9a9a95", fundo: "#f4f4f3" };

/** Visual do site: Base azul/amarelo, Kids azul/roxo, BeOne preto e branco, redes na cor delas (Branca = cinza). */
export function temaDe(e?: EdLike | null): Tema {
  if (!e) return { ...AZUL, detalhe: "#f2b705" };
  if (e.tipo === "beone") return { marca: "#111111", esc: "#000000", clara: "#efefef", detalhe: "#111111", fundo: "#ffffff" };
  if (e.tipo === "kids") return { ...AZUL, detalhe: "#7c4dcc" };
  if (e.tipo === "base") return { ...AZUL, detalhe: "#f2b705" };
  if (e.cor === "Branca") return CINZA;
  const c = corDe(e.cor);
  return { marca: c.hex, esc: c.esc, clara: c.clara, detalhe: c.hex, fundo: "#fafaf9" };
}
/** Escolha única do formulário: uma rede ou Base/Kids/BeOne. */
export const ESCOLHAS = [...NOMES_COR, "base", "kids", "beone"];
export const escolhaDe = (e: EdLike) => (e.tipo === "rede" || !e.tipo ? e.cor ?? "Roxa" : e.tipo);
/** Nome sugerido: Vida Roxa, Vida Base, Vida Branca e Roxa… */
export const nomeAuto = (escolha: string, rede2?: string | null) => `Vida ${TIPOS[escolha] ?? escolha}${rede2 ? ` e ${rede2}` : ""}`;
export const descricaoEd = (e: EdLike) => (e.tipo === "rede" || !e.tipo ? `Rede ${e.cor}${e.rede2 ? ` e ${e.rede2}` : ""}` : `Vida ${TIPOS[e.tipo]}`);
/** Cor da bolinha da edição. */
export const bolinha = (e: EdLike) => (e.tipo === "rede" || !e.tipo ? corDe(e.cor).hex : temaDe(e).marca);
