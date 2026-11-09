// Perfil espiritual de um grupo de encontristas (batismo, célula, igreja, rede).
// "Não/Sem" inclui quem deixou a pergunta em branco na inscrição.
export type EspLinha = { batizado: boolean | null; rede: string | null; igreja: string | null; em_celula: boolean | null } | null | undefined;
export type Perfil = { total: number; bat: number; nbat: number; cel: number; scel: number; igr: number; sigr: number; comRede: number; srede: number };
export const perfilDe = (lista: EspLinha[]): Perfil => {
  const total = lista.length;
  const bat = lista.filter((x) => x?.batizado === true).length;
  const cel = lista.filter((x) => x?.em_celula === true).length;
  const igr = lista.filter((x) => !!x?.igreja).length;
  const srede = lista.filter((x) => !x?.rede || x.rede === "Sem rede").length;
  return { total, bat, nbat: total - bat, cel, scel: total - cel, igr, sigr: total - igr, comRede: total - srede, srede };
};
export const pc = (n: number, t: number) => Math.round((n / Math.max(1, t)) * 100);

/** Frases curtas que ajudam a pensar o apelo e a ministração (só descrevem os números). */
export function leituraRapida(p: Perfil): string[] {
  if (!p.total) return [];
  const f: string[] = [];
  const b = pc(p.bat, p.total), c = pc(p.cel, p.total), i = pc(p.igr, p.total);
  f.push(b >= 75 ? `${b}% já são batizados: o foco pode ser consagração e discipulado.` : b >= 40 ? `${b}% são batizados e ${100 - b}% ainda não: há espaço para um apelo de batismo.` : `Só ${b}% são batizados: o apelo de batismo ganha peso nesta edição.`);
  f.push(c >= 60 ? `${c}% participam de célula: boa base para o acompanhamento depois do encontro.` : `${100 - c}% não participam de célula: oportunidade de conectar essas pessoas a uma célula.`);
  f.push(i >= 80 ? `${i}% dizem frequentar uma igreja: o público já tem vínculo com igreja.` : `${100 - i}% não têm igreja informada: vale pensar em acolhimento e encaminhamento.`);
  return f;
}
