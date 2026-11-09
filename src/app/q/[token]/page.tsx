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
type Info = { ok: boolean; quarto?: string; sexo?: string; anjos?: string[]; edicao?: string; pessoas?: P[] };

const sn = (v: boolean | null) => (v === null || v === undefined ? "Não informado" : v ? "Sim" : "Não");

/** Página pública (sem login) para o anjo do quarto: mini cards e perfil de cada encontrista. */
export default function Quarto() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aberto, setAberto] = useState<P | null>(null);

  useEffect(() => {
    supabase.rpc("quarto_info", { p_token: token }).then(({ data, error }) => { if (error) setFalhou(true); else setInfo(data as Info); });
  }, [token]);

  const casca = (c: React.ReactNode) => (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-marca font-extrabold text-white">V</div>
        <div className="leading-tight"><b>{info?.ok ? info.quarto : "Quarto"}</b><div className="text-xs text-suave">{info?.edicao ?? "Vida Vitoriosa"}{info?.ok && info.anjos?.length ? ` · ${info.anjos.length > 1 ? "Anjos" : "Anjo"}: ${info.anjos.join(", ")}` : ""}</div></div></div>
      {c}
    </div>
  );

  if (falhou && !info) return casca(<p className="text-suave">Não consegui abrir agora. Verifique a internet e recarregue a página.</p>);
  if (!info) return casca(<p className="text-suave">Carregando…</p>);
  if (!info.ok) return casca(<div className="rounded-3xl border border-borda bg-white p-5"><b className="block text-lg">Link indisponível</b><p className="mb-0 text-suave">Este link foi desligado ou trocado. Peça um novo à Secretaria.</p></div>);

  const pessoas = info.pessoas ?? [];

  if (aberto) {
    const p = aberto;
    const Linha = ({ r, v }: { r: string; v?: string | null }) => <div className="flex justify-between gap-4 border-b border-borda py-2 text-sm last:border-0"><span className="text-suave">{r}</span><b className="text-right">{v || "Não informado"}</b></div>;
    return casca(
      <>
        <button type="button" onClick={() => setAberto(null)} className="mb-3 min-h-11 font-bold text-marca">← Voltar ao quarto</button>
        <div className="rounded-3xl border border-borda bg-white p-5">
          <h1 className="m-0 text-2xl font-extrabold">{p.nome}</h1>
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

  return casca(
    <>
      <p className="mb-3 mt-0 text-sm text-suave">{pessoas.length} encontrista{pessoas.length === 1 ? "" : "s"} no quarto. Toque em um nome para ver o perfil. Informação reservada: não compartilhe este link.</p>
      {pessoas.length === 0 && <p className="text-suave">Ainda não há ninguém neste quarto.</p>}
      <div className="grid grid-cols-2 gap-2.5">
        {pessoas.map((p) => (
          <button key={p.id} type="button" onClick={() => setAberto(p)} className="flex min-h-28 flex-col justify-between rounded-2xl border border-borda bg-white p-3 text-left">
            <div><b className="block leading-tight">{p.nome}</b><span className="text-xs text-suave">{p.idade ? p.idade + " anos" : ""}</span></div>
            <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-bold">
              <span className={"rounded-full px-2 py-0.5 " + (p.batizado ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>{p.batizado ? "Batizado" : p.batizado === false ? "Não batizado" : "Batismo ?"}</span>
              {p.tem_necessidade && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Saúde</span>}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
