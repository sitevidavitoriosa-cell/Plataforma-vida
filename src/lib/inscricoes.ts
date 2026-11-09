// Contagem de inscrições ao longo do tempo (usa a "Data da inscrição" da planilha).
export type PontoDia = { chave: string; data: Date; n: number };
export type PontoMes = { chave: string; rotulo: string; n: number };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dd = (n: number) => String(n).padStart(2, "0");

export function resumoInscricoes(datas: (string | null | undefined)[]) {
  const dias = new Map<string, PontoDia>();
  const meses = new Map<string, PontoMes>();
  let semData = 0;
  for (const s of datas) {
    const d = s ? new Date(s) : null;
    if (!d || isNaN(d.getTime())) { semData++; continue; }
    const kd = `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
    const dia = dias.get(kd) ?? { chave: kd, data: new Date(d.getFullYear(), d.getMonth(), d.getDate()), n: 0 };
    dia.n++; dias.set(kd, dia);
    const km = `${d.getFullYear()}-${dd(d.getMonth() + 1)}`;
    const mes = meses.get(km) ?? { chave: km, rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, n: 0 };
    mes.n++; meses.set(km, mes);
  }
  const listaDias = Array.from(dias.values()).sort((a, b) => a.chave.localeCompare(b.chave));
  const listaMeses = Array.from(meses.values()).sort((a, b) => a.chave.localeCompare(b.chave));
  const pico = listaDias.reduce<PontoDia | null>((m, x) => (!m || x.n > m.n ? x : m), null);
  const mesTop = listaMeses.reduce<PontoMes | null>((m, x) => (!m || x.n > m.n ? x : m), null);
  const mesTopNome = mesTop ? `${MESES_LONGOS[Number(mesTop.chave.slice(5)) - 1]} de ${mesTop.chave.slice(0, 4)}` : "";
  return { dias: listaDias, meses: listaMeses, pico, mesTop, mesTopNome, semData, comData: listaDias.reduce((s, x) => s + x.n, 0) };
}
export const fmtDia = (d: Date) => `${dd(d.getDate())}/${dd(d.getMonth() + 1)}`;
