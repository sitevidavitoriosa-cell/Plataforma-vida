"use client";
import Link from "next/link";
import { useLista } from "@/lib/dados";
import { dmy, fmtN, type Edicao, type Envio, type Item } from "@/lib/tipos";
import { PERFIS, podeVer } from "@/lib/perm";
import { useAuth } from "@/components/provedores";
import { Carregando, Cartao, Icone, Selo, Vazio } from "@/components/ui";

export default function Inicio() {
  const { acesso } = useAuth();
  const itens = useLista<Item>("itens", "*", "nome");
  const eds = useLista<Edicao>("edicoes", "*", "data_ini");
  const envios = useLista<Envio>("envios");
  if (!acesso || !itens.dados || !eds.dados || !envios.dados) return <Carregando />;

  const atual = eds.dados.find((e) => e.status === "aberta") ?? eds.dados.filter((e) => e.status === "planejada").sort((a, b) => (a.data_ini ?? "").localeCompare(b.data_ini ?? ""))[0] ?? null;
  const falta = itens.dados.filter((i) => i.min > 0 && i.qtd < i.min).sort((a, b) => a.qtd / a.min - b.qtd / b.min);
  const env = atual ? envios.dados.filter((x) => x.edicao_id === atual.id) : [];
  const atalhos = [
    { href: "/estoque", t: "Estoque", d: `${itens.dados.length} itens`, i: "estoque", m: "estoque" },
    { href: "/edicoes", t: "Edições", d: `${eds.dados.length} cadastradas`, i: "edicoes", m: "edicoes" },
    { href: "/financeiro", t: "Financeiro", d: "Caixa e lançamentos", i: "financeiro", m: "financeiro" },
    { href: "/decisoes", t: "Decisões", d: "Encontristas e registro", i: "decisoes", m: "decisoes" },
  ].filter((a) => a.m === "estoque" || a.m === "edicoes" || podeVer(acesso, a.m));

  return (
    <div className="flex flex-col gap-4 pt-5">
      <div>
        <p className="m-0 text-sm font-bold text-suave">{PERFIS[acesso.perfil]?.nome}</p>
        <h1 className="m-0 text-[28px] font-extrabold leading-tight">Olá, {acesso.nome.split(" ")[0]}</h1>
      </div>

      {atual ? (
        <Cartao className="flex flex-col gap-3 bg-marca p-5 !border-marca text-white">
          <div className="flex items-start justify-between"><div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-white/70">{atual.status === "aberta" ? "Edição em andamento" : "Próxima edição"}</div>
            <div className="text-2xl font-extrabold">{atual.nome}</div>
            <div className="text-sm text-white/80">{dmy(atual.data_ini)}{atual.data_fim ? ` a ${dmy(atual.data_fim)}` : ""}</div></div>
          </div>
          <div className="flex gap-6 text-sm">
            <span><b className="text-xl">{fmtN(atual.enc)}</b><br />encontristas</span>
            <span><b className="text-xl">{env.length}</b><br />itens enviados</span>
          </div>
        </Cartao>
      ) : <Vazio>Nenhuma edição aberta ou planejada.</Vazio>}

      <div className="grid grid-cols-2 gap-3">
        {atalhos.map((a) => (
          <Link key={a.href} href={a.href} className="flex flex-col gap-1.5 rounded-3xl border border-borda bg-white p-4">
            <span className="text-marca"><Icone n={a.i} tam={26} /></span>
            <b className="text-base">{a.t}</b><span className="text-sm text-suave">{a.d}</span>
          </Link>
        ))}
      </div>

      <Cartao className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pb-2 pt-4"><b className="text-base">Itens em falta</b>{falta.length > 0 && <Selo tom="alerta">{falta.length}</Selo>}</div>
        {falta.length === 0 && <Vazio>Nada abaixo do mínimo. 🎉</Vazio>}
        {falta.slice(0, 6).map((i) => (
          <Link key={i.id} href="/estoque" className="flex items-center justify-between gap-3 border-t border-borda px-4 py-3">
            <div className="min-w-0"><b className="block truncate text-[15px]">{i.nome}</b><span className="text-xs text-suave">{i.setor}</span></div>
            <div className="text-right leading-tight"><b className="text-lg text-alerta">{fmtN(i.qtd)}</b><div className="text-xs text-suave">mín. {fmtN(i.min)}</div></div>
          </Link>
        ))}
        {falta.length > 6 && <Link href="/estoque" className="block border-t border-borda px-4 py-3 text-center text-sm font-bold text-marca">Ver todos os {falta.length}</Link>}
      </Cartao>
    </div>
  );
}
