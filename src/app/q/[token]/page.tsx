"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ContatoLinha } from "@/components/contato";

type P = {
  id: string; nome: string; idade: number | null; sexo: string | null; estado_civil: string | null; bairro: string | null; municipio: string | null;
  batizado: boolean | null; igreja: string | null; em_celula: boolean | null; celula: string | null; lider_celula: string | null; discipulado: string | null; rede: string | null;
  tem_necessidade: boolean; necessidade: string | null; obs_saude: string | null; contatos: string[];
};
type Q = { id: string; nome: string; sexo: string; capacidade: number; anjos: string[]; pessoas: P[] };
type Info = { ok: boolean; edicao?: string; quartos?: Q[] };

const sn = (v: boolean | null) => (v === null || v === undefined ? "Não informado" : v ? "Sim" : "Não");

/** Página pública (sem login), link único da edição: card de cada quarto com os encontristas e o perfil de cada um. Usada pelos anjos, pela Secretaria e pela equipe de Saúde. */
export default function Quarto() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aberto, setAberto] = useState<{ p: P; quarto: string } | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    supabase.rpc("quartos_edicao_info", { p_token: token }).then(({ data, error }) => { if (error) setFalhou(true); else setInfo(data as Info); });
  }, [token]);

  const casca = (c: React.ReactNode) => (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-marca font-extrabold text-white">V</div>
        <div className="leading-tight"><b>Quartos</b><div className="text-xs text-suave">{info?.edicao ?? "Vida Vitoriosa"}</div></div></div>
      {c}
    </div>
  );

  if (falhou && !info) return casca(<p className="text-suave">Não consegui abrir agora. Verifique a internet e recarregue a página.</p>);
  if (!info) return casca(<p className="text-suave">Carregando…</p>);
  if (!info.ok) return casca(<div className="rounded-3xl border border-borda bg-white p-5"><b className="block text-lg">Link indisponível</b><p className="mb-0 text-suave">Este link foi desligado ou trocado. Peça o novo link à Secretaria.</p></div>);

  const quartos = (info.quartos ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  const nq = busca.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const limpa = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (aberto) {
    const p = aberto.p;
    const Linha = ({ r, v }: { r: string; v?: string | null }) => <div className="flex justify-between gap-4 border-b border-borda py-2 text-sm last:border-0"><span className="text-suave">{r}</span><b className="text-right">{v || "Não informado"}</b></div>;
    return casca(
      <>
        <button type="button" onClick={() => setAberto(null)} className="mb-3 min-h-11 font-bold text-marca">← Voltar aos quartos</button>
        <div className="rounded-3xl border border-borda bg-white p-5">
          <h1 className="m-0 text-2xl font-extrabold">{p.nome}</h1>
          <p className="mb-0 mt-1 text-sm font-bold text-marca">{aberto.quarto}</p>
          <p className="mb-0 mt-1 text-sm text-suave">{[p.idade ? p.idade + " anos" : "", p.estado_civil, p.bairro || p.municipio].filter(Boolean).join(" · ")}</p>
        </div>
        <h2 className="mb-1 mt-5 text-base font-extrabold">Vida espiritual</h2>
        <div className="rounded-3xl border border-borda bg-white px-5 py-2">
          <Linha r="Batizado" v={sn(p.batizado)} />
          <Linha r="Igreja / denominação" v={p.igreja} />
          <Linha r="Tem célula" v={sn(p.em_celula)} />
          {(p.celula || p.lider_celula) && <Linha r="Célula" v={[p.celula, p.lider_celula && "líder " + p.lider_celula].filter(Boolean).join(" · ")} />}
          <Linha r="Discipulado" v={p.discipulado} />
          <Linha r="Rede" v={p.rede} />
        </div>
        <h2 className="mb-1 mt-5 text-base font-extrabold">Saúde</h2>
        <div className="rounded-3xl border bg-white px-5 py-2" style={{ borderColor: p.tem_necessidade ? "#d97706" : undefined }}>
          <Linha r="Toma remédio / necessidade" v={p.tem_necessidade ? "Sim" : "Não"} />
          {p.necessidade && <Linha r="Qual" v={p.necessidade} />}
          {p.obs_saude && <Linha r="Observação" v={p.obs_saude} />}
        </div>
        {p.contatos.length > 0 && (
          <>
            <h2 className="mb-1 mt-5 text-base font-extrabold">Contatos de emergência</h2>
            <div className="rounded-3xl border border-borda bg-white px-5 py-2">{p.contatos.map((c, i) => <ContatoLinha key={i} texto={c} className="border-b border-borda py-2 last:border-0" />)}</div>
          </>
        )}
      </>
    );
  }

  const visiveis = quartos
    .map((q) => ({ q, pessoas: nq ? q.pessoas.filter((p) => limpa(p.nome).includes(nq)) : q.pessoas }))
    .filter((x) => !nq || x.pessoas.length > 0 || limpa(x.q.nome).includes(nq));
  return casca(
    <>
      <p className="mb-3 mt-0 text-sm text-suave">{quartos.length} quarto{quartos.length === 1 ? "" : "s"}. Procure um nome para saber em que quarto a pessoa está e toque nele para ver o perfil. Informação reservada: não compartilhe este link.</p>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou quarto" aria-label="Buscar" className="mb-4 min-h-12 w-full rounded-2xl border border-borda bg-white px-4 outline-none focus:border-marca" />
      {quartos.length === 0 && <p className="text-suave">Ainda não há quartos criados.</p>}
      {quartos.length > 0 && visiveis.length === 0 && <p className="text-suave">Ninguém encontrado.</p>}
      <div className="flex flex-col gap-4">
        {visiveis.map(({ q, pessoas }) => (
          <section key={q.id} className="rounded-3xl border border-borda bg-white p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="leading-tight"><b className="text-lg">{q.nome}</b><div className="text-xs text-suave">{q.sexo}{q.anjos.length ? ` · ${q.anjos.length > 1 ? "Anjos" : "Anjo"}: ${q.anjos.join(", ")}` : ""}</div></div>
              <span className="rounded-full bg-fundo px-2.5 py-1 text-xs font-bold text-suave">{q.pessoas.length}/{q.capacidade}</span>
            </div>
            {pessoas.length === 0 && <p className="m-0 text-sm text-suave">Ninguém neste quarto.</p>}
            <div className="grid grid-cols-2 gap-2.5">
              {pessoas.map((p) => (
                <button key={p.id} type="button" onClick={() => setAberto({ p, quarto: q.nome })} className="flex min-h-24 flex-col justify-between rounded-2xl border border-borda bg-white p-3 text-left">
                  <div><b className="block leading-tight">{p.nome}</b><span className="text-xs text-suave">{p.idade ? p.idade + " anos" : ""}</span></div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-bold">
                    <span className={"rounded-full px-2 py-0.5 " + (p.batizado ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>{p.batizado ? "Batizado" : p.batizado === false ? "Não batizado" : "Batismo ?"}</span>
                    {p.tem_necessidade && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Saúde</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
