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
const AZUL = { marca: "#16294d", esc: "#0e1c38", clara: "#e8edf7", fundo: "#fafaf9" };
/** Tema do site: o tipo da edição decide o visual; rede Branca deixa tudo em cinza e branco. */
export function temaDe(tipo?: string | null, cor?: string | null): Tema {
  if (cor === "Branca") return { marca: "#5a5a56", esc: "#3a3a37", clara: "#efefed", detalhe: "#9a9a95", fundo: "#f4f4f3" };
  if (tipo === "beone") return { marca: "#111111", esc: "#000000", clara: "#efefef", detalhe: "#111111", fundo: "#ffffff" };
  if (tipo === "kids") return { ...AZUL, detalhe: "#7c4dcc" };
  return { ...AZUL, detalhe: "#f2b705" };
}
/** Nome sugerido: sempre o da cor da rede. */
export const nomeAuto = (tipo: string, cor: string) => (tipo === "base" ? `Vida ${cor}` : `Vida ${TIPOS[tipo]} ${cor}`);
