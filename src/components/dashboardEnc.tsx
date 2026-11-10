"use client";
import { useState } from "react";
import { fmtN } from "@/lib/tipos";
import { corDaRede } from "@/components/graficos";
import { Cartao, Janela, Selo, Vazio } from "@/components/ui";

type Esp = { batizado: boolean | null; rede: string | null; igreja: string | null; em_celula: boolean | null; celula: string | null; lider_celula: string | null };
export type EncDash = { id: string; nome: string; idade: number | null; categoria: string | null; encontrista_saude: { tem_necessidade: boolean } | { tem_necessidade: boolean }[] | null; encontrista_espiritual: Esp | Esp[] | null };
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** Números da edição para quem vê a ficha: totais, perfil espiritual e redes. Tudo clicável (abre quem é). */
export function DashboardEncontristas({ base }: { base: EncDash[] }) {
  const [grupo, setGrupo] = useState<string | null>(null);
  const [rede, setRede] = useState<string | null>(null);
  const encs = base.filter((e) => (e.categoria ?? "").trim() === "Encontrista");
  const equipe = base.length - encs.length;
  const saude = base.filter((e) => um(e.encontrista_saude)?.tem_necessidade).length;
  const esp = (e: EncDash) => um(e.encontrista_espiritual);
  const pct = (n: number) => Math.round((n / Math.max(1, encs.length)) * 100);
  const celulaTxt = (e: EncDash) => { const x = esp(e); return x?.em_celula ? `Célula: ${x.celula || "sim"}${x.lider_celula ? " · líder " + x.lider_celula : ""}` : x?.em_celula === false ? "Não tem célula" : "Célula não informada"; };
  const grupos: { k: string; t: string; pessoas: EncDash[]; linha: (e: EncDash) => string }[] = [
    { k: "bat", t: "Batizados", pessoas: encs.filter((e) => esp(e)?.batizado === true), linha: (e) => `Rede ${esp(e)?.rede || "não informada"}` },
    { k: "nbat", t: "Não batizados", pessoas: encs.filter((e) => esp(e)?.batizado !== true), linha: (e) => (esp(e)?.batizado === false ? "Não é batizado" : "Batismo não informado") },
    { k: "cel", t: "Em célula", pessoas: encs.filter((e) => esp(e)?.em_celula === true), linha: celulaTxt },
    { k: "scel", t: "Sem célula", pessoas: encs.filter((e) => esp(e)?.em_celula !== true), linha: celulaTxt },
    { k: "igr", t: "Com igreja", pessoas: encs.filter((e) => esp(e)?.igreja), linha: (e) => `Igreja: ${esp(e)?.igreja}` },
    { k: "sigr", t: "Sem igreja", pessoas: encs.filter((e) => !esp(e)?.igreja), linha: () => "Sem igreja informada" },
    { k: "srede", t: "Sem rede", pessoas: encs.filter((e) => (esp(e)?.rede || "Sem rede") === "Sem rede"), linha: () => "Sem rede informada" },
  ];
  const redes = new Map<string, number>();
  encs.forEach((e) => { const r = esp(e)?.rede || "Sem rede"; redes.set(r, (redes.get(r) ?? 0) + 1); });
  const fatias = Array.from(redes.entries()).sort((a, b) => b[1] - a[1]);
  const aberto = grupos.find((g) => g.k === grupo) ?? null;
  const daRede = rede ? encs.filter((e) => (esp(e)?.rede || "Sem rede") === rede) : [];
  const kpis = [{ t: "Encontristas", v: encs.length }, { t: "Equipe", v: equipe }, { t: "Com necessidade de saúde", v: saude }];

  if (base.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.t} className="rounded-3xl border border-borda bg-white p-4">
            <div className="text-[28px] font-extrabold leading-none">{fmtN(k.v)}</div><div className="mt-1.5 text-sm text-suave">{k.t}</div>
          </div>
        ))}
      </div>
      <Cartao className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        {grupos.map((g) => (
          <button key={g.k} type="button" onClick={() => setGrupo(g.k)} aria-label={`Ver quem são: ${g.t}`} className="flex flex-col items-start rounded-2xl p-2 text-left hover:bg-fundo">
            <span className="text-[22px] font-extrabold leading-none">{g.pessoas.length}<span className="ml-1 text-sm font-bold text-suave">{pct(g.pessoas.length)}%</span></span>
            <span className="mt-1 text-sm text-suave">{g.t} ›</span>
          </button>
        ))}
      </Cartao>
      {fatias.length > 0 && (
        <Cartao className="flex flex-col gap-2 p-4">
          <b>Redes dos encontristas</b>
          <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
            {fatias.map(([nome, n]) => (
              <button key={nome} type="button" onClick={() => setRede(nome)} aria-label={`Ver encontristas da rede ${nome}`} className="flex min-w-0 flex-col items-start rounded-xl px-2 py-1.5 text-left hover:bg-fundo">
                <span className="flex w-full items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corDaRede(nome) }} /><span className="truncate text-sm font-bold">{nome}</span></span>
                <span className="pl-4 text-sm"><b>{n}</b> <span className="text-xs text-suave">{pct(n)}%</span></span>
              </button>
            ))}
          </div>
        </Cartao>
      )}
      {aberto && (
        <Janela titulo={`${aberto.t} · ${aberto.pessoas.length}`} onFechar={() => setGrupo(null)}>
          <div className="flex flex-col gap-2">
            {aberto.pessoas.length === 0 && <Vazio>Ninguém neste grupo.</Vazio>}
            {aberto.pessoas.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((e) => (
              <div key={e.id} className="flex flex-col rounded-2xl border border-borda px-3 py-2"><b>{e.nome}</b><span className="text-sm text-suave">{aberto.linha(e)}</span></div>
            ))}
          </div>
        </Janela>
      )}
      {rede && (
        <Janela titulo={`Rede ${rede} · ${daRede.length}`} onFechar={() => setRede(null)}>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2 text-sm">
              <Selo tom="ok">{daRede.filter((e) => esp(e)?.batizado === true).length} batizados</Selo>
              <Selo tom="neutro">{daRede.filter((e) => esp(e)?.em_celula === true).length} em célula</Selo>
              <Selo tom="neutro">{daRede.filter((e) => esp(e)?.igreja).length} com igreja</Selo>
            </div>
            {daRede.map((e) => {
              const x = esp(e);
              return (
                <div key={e.id} className="flex flex-col gap-1 rounded-2xl border border-borda p-3">
                  <div className="flex items-center justify-between gap-2"><b>{e.nome}</b>{x?.batizado === true ? <Selo tom="ok">Batizado</Selo> : x?.batizado === false ? <Selo tom="aviso">Não batizado</Selo> : <Selo tom="neutro">Batismo ?</Selo>}</div>
                  <span className="text-xs text-suave">{e.idade ? e.idade + " anos" : ""}</span>
                  <span className="text-sm">{celulaTxt(e)}</span>
                  <span className="text-sm">{x?.igreja ? `Igreja: ${x.igreja}` : "Sem igreja informada"}</span>
                </div>
              );
            })}
          </div>
        </Janela>
      )}
    </div>
  );
}
