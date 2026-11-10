/** Cópia local (neste aparelho) para usar sem internet. Tudo com prazo: passou de 5 dias, some. */
const PRAZO = 5 * 24 * 3600 * 1000;
export const PREFIXO_SAUDE = "vv-saude-";
export type Guardado<T> = { quando: number; dados: T };

export function guardar<T>(chave: string, dados: T) {
  try { localStorage.setItem(chave, JSON.stringify({ quando: Date.now(), dados } satisfies Guardado<T>)); } catch {}
}
export function ler<T>(chave: string): Guardado<T> | null {
  try {
    const t = localStorage.getItem(chave); if (!t) return null;
    const g = JSON.parse(t) as Guardado<T>;
    if (!g || typeof g.quando !== "number" || Date.now() - g.quando > PRAZO) { localStorage.removeItem(chave); return null; }
    return g;
  } catch { return null; }
}
export function apagar(chave: string) { try { localStorage.removeItem(chave); } catch {} }
/** Ao sair da conta: apaga tudo que foi guardado para uso offline. */
export function apagarTudoOffline() {
  try { Object.keys(localStorage).filter((k) => k.startsWith("vv-saude-") || k.startsWith("vv-q-") || k === "vv-off-acesso" || k === "vv-off-eds").forEach((k) => localStorage.removeItem(k)); } catch {}
}
export const quandoTxt = (t: number) => new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
export const semRede = (msg?: string) => (typeof navigator !== "undefined" && !navigator.onLine) || /failed to fetch|networkerror|load failed|network request failed/i.test(msg ?? "");
