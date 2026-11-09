"use client";
import { CORES } from "@/lib/cores";
import { fmtDia, fmtDiaAno, type PontoDia } from "@/lib/inscricoes";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Cor da rede: Roxa, Azul, Amarela… (Branca = cinza). Sem rede / outros = cinzas claros.
export function corDaRede(rede: string): string {
  const n = semAcento(rede);
  for (const [nome, c] of Object.entries(CORES)) if (n.includes(semAcento(nome).replace(/a$/, ""))) return c.hex;
  if (n.includes("sem rede")) return "#c9c8c2";
  return "#9a9a94";
}

export type Fatia = { nome: string; valor: number; cor: string };

export function Pizza({ fatias, onEscolher, tam = 180 }: { fatias: Fatia[]; onEscolher?: (nome: string) => void; tam?: number }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const r = 50, c = 60;
  let ang = -Math.PI / 2;
  const pt = (a: number) => `${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`;
  return (
    <svg viewBox="0 0 120 120" width={tam} height={tam} role="img" aria-label="Gráfico de pizza das redes" className="shrink-0">
      {total === 0 ? <circle cx={c} cy={c} r={r} fill="#eee" /> : fatias.length === 1 ? (
        <circle cx={c} cy={c} r={r} fill={fatias[0].cor} className={onEscolher ? "cursor-pointer" : ""} onClick={() => onEscolher?.(fatias[0].nome)} />
      ) : fatias.map((f) => {
        const a0 = ang, a1 = ang + (f.valor / total) * Math.PI * 2; ang = a1;
        const d = `M ${c} ${c} L ${pt(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)} Z`;
        return <path key={f.nome} d={d} fill={f.cor} stroke="#fff" strokeWidth="1.2" className={onEscolher ? "cursor-pointer hover:opacity-80" : ""} onClick={() => onEscolher?.(f.nome)}><title>{`${f.nome}: ${f.valor}`}</title></path>;
      })}
      <circle cx={c} cy={c} r="22" fill="#fff" />
      <text x={c} y={c + 1} textAnchor="middle" fontSize="13" fontWeight="800" fill="#1b1b1a">{total}</text>
      <text x={c} y={c + 11} textAnchor="middle" fontSize="6" fill="#76766f">encontristas</text>
    </svg>
  );
}

export function LinhaTempo({ dias, acumulado, cor = "#6b4fbb" }: { dias: PontoDia[]; acumulado: boolean; cor?: string }) {
  if (dias.length === 0) return null;
  // preenche os dias sem inscrição com zero para a linha ser fiel ao tempo
  const todos: { data: Date; n: number }[] = [];
  const mapa = new Map(dias.map((d) => [d.chave, d.n]));
  const ini = dias[0].data, fim = dias[dias.length - 1].data;
  for (let t = new Date(ini); t <= fim; t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) {
    const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    todos.push({ data: t, n: mapa.get(k) ?? 0 });
  }
  let soma = 0;
  const ys = todos.map((p) => (acumulado ? (soma += p.n) : p.n));
  const max = Math.max(1, ...ys);
  const W = 300, H = 130, L = 26, R = 8, T = 8, B = 20;
  const x = (i: number) => (todos.length === 1 ? (L + W - R) / 2 : L + (i / (todos.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const linha = ys.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${linha} L ${x(ys.length - 1).toFixed(1)} ${y(0)} L ${x(0).toFixed(1)} ${y(0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Inscrições ao longo do tempo">
      {[0, 0.5, 1].map((f) => (<g key={f}><line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="#e6e5df" strokeWidth="0.6" /><text x={L - 3} y={y(max * f) + 2.5} textAnchor="end" fontSize="7" fill="#76766f">{Math.round(max * f)}</text></g>))}
      <path d={area} fill={cor} opacity="0.12" />
      <path d={linha} fill="none" stroke={cor} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {todos.length <= 40 && ys.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="1.8" fill={cor}><title>{`${fmtDia(todos[i].data)}: ${v}`}</title></circle>)}
      <text x={L} y={H - 6} fontSize="7.5" fill="#76766f">{fmtDiaAno(todos[0].data)}</text>
      <text x={W - R} y={H - 6} fontSize="7.5" textAnchor="end" fill="#76766f">{fmtDiaAno(todos[todos.length - 1].data)}</text>
    </svg>
  );
}
