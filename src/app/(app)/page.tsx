"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLista } from "@/lib/dados";
import { dmy, fmtN, type Envio, type Item } from "@/lib/tipos";
import { PERFIS, podeVerEstoque, podeVerFicha } from "@/lib/perm";
import { descricaoEd } from "@/lib/cores";
import { useAuth, useEdicao } from "@/components/provedores";
import { Carregando, Cartao, Janela, Selo, Vazio } from "@/components/ui";

type Esp = { batizado: boolean | null; rede: string | null; igreja: string | null; em_celula: boolean | null; celula: string | null; lider_celula: string | null };
type Enc = { id: string; edicao_id: string; nome: string; idade: number | null; categoria: string | null; cancelada: boolean; encontrista_saude: { tem_necessidade: boolean } | { tem_necessidade: boolean }[] | null; encontrista_espiritual: Esp | Esp[] | null };
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export default function Painel() {
  const { acesso } = useAuth();
  const { ed, carregou } = useEdicao();
  const itens = useLista<Item>("itens", "*", "nome");
  const envios = useLista<Envio>("envios");
  const router = useRouter();
  const soSecretaria = acesso?.perfil === "secretaria1";
  useEffect(() => { if (soSecretaria) router.replace("/setores?aba=secretaria"); }, [soSecretaria, router]);
  if (soSecretaria) return <Carregando />;
  if (!acesso || !carregou || !itens.dados || !envios.dados) return <Carregando />;

  const falta = itens.dados.filter((i) => i.min > 0 && i.qtd < i.min).sort((a, b) => a.qtd / a.min - b.qtd / b.min);
  const nEnv = ed ? envios.dados.filter((x) => x.edicao_id === ed.id).length : 0;

  return (
    <div className="flex flex-col gap-4 pt-5">
      <div>
        <p className="m-0 text-sm font-bold text-suave">{PERFIS[acesso.perfil]?.nome}</p>
        <h1 className="m-0 text-[28px] font-extrabold leading-tight">Olá, {acesso.nome.split(" ")[0]}</h1>
      </div>

      {ed ? (
        <Cartao className="flex flex-col gap-1 border-t-4 !border-t-detalhe p-5">
          <div className="text-xs font-extrabold uppercase tracking-wide text-marca">{descricaoEd(ed)}</div>
          <div className="text-2xl font-extrabold">{ed.nome}</div>
          <div className="text-sm text-suave">{dmy(ed.data_ini)}{ed.data_fim ? ` a ${dmy(ed.data_fim)}` : ""}{ed.local ? ` · ${ed.local}` : ""}</div>
        </Cartao>
      ) : <Vazio>Nenhuma edição cadastrada ainda. Crie em “Edições”.</Vazio>}

      {ed && podeVerFicha(acesso) && <KpisEncontristas edicaoId={ed.id} nItens={nEnv} nFalta={falta.length} />}

      <Link href="/relatorio" className="flex items-center justify-between gap-3 rounded-3xl border border-borda bg-white p-4">
        <div><b className="block text-base">Relatório geral</b><span className="text-sm text-suave">Materiais por setor, pessoas e decisões. Imprime, salva em PDF ou baixa em Excel.</span></div>
        <span className="text-xl font-extrabold text-marca">→</span>
      </Link>

      {podeVerEstoque(acesso) && <Cartao className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pb-2 pt-4"><b className="text-base">Precisa de atenção</b>{falta.length > 0 && <Selo tom="alerta">{falta.length}</Selo>}</div>
        {falta.length === 0 && <Vazio>Nada abaixo do mínimo.</Vazio>}
        {falta.slice(0, 6).map((i) => (
          <Link key={i.id} href="/estoque" className="flex items-center justify-between gap-3 border-t border-borda px-4 py-3">
            <div className="min-w-0"><b className="block truncate text-[15px]">{i.nome}</b><span className="text-xs text-suave">{i.setor}</span></div>
            <div className="text-right leading-tight"><b className="text-lg text-alerta">{fmtN(i.qtd)}</b><div className="text-xs text-suave">mín. {fmtN(i.min)}</div></div>
          </Link>
        ))}
        {falta.length > 6 && <Link href="/estoque" className="block border-t border-borda px-4 py-3 text-center text-sm font-bold text-marca">Ver todos os {falta.length}</Link>}
      </Cartao>}
    </div>
  );
}

function KpisEncontristas({ edicaoId, nItens, nFalta }: { edicaoId: string; nItens: number; nFalta: number }) {
  const lista = useLista<Enc>("encontristas", "id, edicao_id, nome, idade, categoria, cancelada, encontrista_saude(tem_necessidade), encontrista_espiritual(batizado, rede, igreja, em_celula, celula, lider_celula)", "nome");
  const [rede, setRede] = useState<string | null>(null);
  if (!lista.dados) return <Carregando />;
  const todos = lista.dados.filter((e) => e.edicao_id === edicaoId && !e.cancelada);
  const encs = todos.filter((e) => (e.categoria ?? "").trim() === "Encontrista");
  const equipe = todos.length - encs.length;
  const saude = todos.filter((e) => um(e.encontrista_saude)?.tem_necessidade).length;
  const bat = encs.filter((e) => um(e.encontrista_espiritual)?.batizado === true).length;
  const redes = new Map<string, number>();
  encs.forEach((e) => { const r = um(e.encontrista_espiritual)?.rede || "Sem rede"; redes.set(r, (redes.get(r) ?? 0) + 1); });
  const max = Math.max(1, ...redes.values());
  const daRede = rede ? encs.filter((e) => (um(e.encontrista_espiritual)?.rede || "Sem rede") === rede) : [];
  const kpis = [
    { t: "Encontristas", v: encs.length, href: "/encontristas" },
    { t: "Equipe", v: equipe, href: "/encontristas" },
    { t: "Com necessidade de saúde", v: saude, href: "/setores" },
    { t: "Itens em falta", v: nFalta, href: "/estoque" },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.t} href={k.href} className="rounded-3xl border border-borda bg-white p-4">
            <div className="text-[28px] font-extrabold leading-none">{fmtN(k.v)}</div><div className="mt-1.5 text-sm text-suave">{k.t}</div>
          </Link>
        ))}
      </div>
      <Cartao className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between"><b>Redes dos encontristas</b><span className="text-sm text-suave">{bat} batizados · {nItens} itens enviados</span></div>
        {redes.size === 0 && <Vazio>Importe a planilha em “Encontristas”.</Vazio>}
        {Array.from(redes.entries()).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
          <button key={r} type="button" onClick={() => setRede(r)} aria-label={`Ver encontristas da rede ${r}`} className="flex min-h-9 items-center gap-3 rounded-xl text-left text-sm hover:bg-fundo"><span className="w-24 shrink-0 font-bold">{r}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fundo"><div className="h-full rounded-full bg-marca" style={{ width: `${(n / max) * 100}%` }} /></div><b className="w-8 text-right">{n}</b><span className="text-suave">›</span></button>
        ))}
        {redes.size > 0 && <p className="m-0 text-xs text-suave">Toque numa rede para ver quem é, a célula, se é batizado e a igreja.</p>}
      </Cartao>
      {rede && (
        <Janela titulo={`Rede ${rede} · ${daRede.length}`} onFechar={() => setRede(null)}>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2 text-sm">
              <Selo tom="ok">{daRede.filter((e) => um(e.encontrista_espiritual)?.batizado === true).length} batizados</Selo>
              <Selo tom="neutro">{daRede.filter((e) => um(e.encontrista_espiritual)?.em_celula === true).length} em célula</Selo>
              <Selo tom="neutro">{daRede.filter((e) => um(e.encontrista_espiritual)?.igreja).length} com igreja</Selo>
            </div>
            {daRede.map((e) => {
              const x = um(e.encontrista_espiritual);
              return (
                <div key={e.id} className="flex flex-col gap-1 rounded-2xl border border-borda p-3">
                  <div className="flex items-center justify-between gap-2"><b>{e.nome}</b>{x?.batizado === true ? <Selo tom="ok">Batizado</Selo> : x?.batizado === false ? <Selo tom="aviso">Não batizado</Selo> : <Selo tom="neutro">Batismo ?</Selo>}</div>
                  <span className="text-xs text-suave">{e.idade ? e.idade + " anos · " : ""}Rede {x?.rede || "não informada"}</span>
                  <span className="text-sm">{x?.em_celula ? `Célula: ${x.celula || "sim"}${x.lider_celula ? " · líder " + x.lider_celula : ""}` : x?.em_celula === false ? "Não tem célula" : "Célula não informada"}</span>
                  <span className="text-sm">{x?.igreja ? `Igreja: ${x.igreja}` : "Sem igreja informada"}</span>
                </div>
              );
            })}
          </div>
        </Janela>
      )}
    </>
  );
}
