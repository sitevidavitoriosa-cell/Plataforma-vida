"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dmy } from "@/lib/tipos";
import { PERFIS, podeSecretaria, podeVer, podeVerFicha, podeVerSaude } from "@/lib/perm";
import { bolinha, descricaoEd } from "@/lib/cores";
import { useAuth, useEdicao } from "@/components/provedores";
import { Carregando, Cartao, Selo, Vazio } from "@/components/ui";

const STATUS = { planejada: "Planejada", aberta: "Aberta", fechada: "Fechada" } as const;
const TOM = { planejada: "aviso", aberta: "ok", fechada: "neutro" } as const;

/** Painel enxuto: onde estou (edição ou todas) e atalhos para o que a pessoa realmente usa. Os números dos encontristas ficam em “Encontristas”. */
export default function Painel() {
  const { acesso } = useAuth();
  const { ed, eds, todas, carregou, trocar } = useEdicao();
  const router = useRouter();
  const soSecretaria = acesso?.perfil === "secretaria1";
  useEffect(() => { if (soSecretaria) router.replace("/setores?aba=secretaria"); }, [soSecretaria, router]);
  if (soSecretaria) return <Carregando />;
  if (!acesso || !carregou) return <Carregando />;

  const atalhos: { href: string; t: string; d: string }[] = [];
  if (todas) {
    if (podeVer(acesso, "estoque")) atalhos.push({ href: "/estoque", t: "Estoque (lista mãe)", d: "Itens consumíveis e não consumíveis, compras e saldo de todas as edições." });
    if (acesso.perfil === "admin") atalhos.push({ href: "/relatorio", t: "Relatório anual", d: "Comparativo das edições do ano: redes, inscrições e perfil espiritual." });
  } else if (ed) {
    if (podeVerFicha(acesso)) atalhos.push({ href: "/encontristas", t: "Encontristas", d: "Números da edição, lista, ficha e importação da planilha." });
    if (podeVerSaude(acesso)) atalhos.push({ href: "/setores?aba=saude", t: "Saúde", d: "Quem precisa de atenção, quarto e contatos de emergência." });
    if (podeSecretaria(acesso)) atalhos.push({ href: "/setores?aba=secretaria", t: "Secretaria 1", d: "Crachás, quartos e material do setor." });
    if (podeVer(acesso, "estoque")) atalhos.push({ href: "/estoque", t: "Estoque da edição", d: "O que sai da lista mãe para esta edição e o balanço na volta." });
    if (podeVer(acesso, "decisoes")) atalhos.push({ href: "/decisoes", t: "Decisões", d: "Registro e lista de decisões." });
    if (podeVer(acesso, "financeiro")) atalhos.push({ href: "/financeiro", t: "Financeiro", d: "Entradas, saídas e comprovantes." });
    atalhos.push({ href: "/relatorio", t: "Relatório geral", d: "Materiais, pessoas e decisões. Imprime, PDF, Excel e apresentação." });
  }

  return (
    <div className="flex flex-col gap-4 pt-5">
      <div>
        <p className="m-0 text-sm font-bold text-suave">{PERFIS[acesso.perfil]?.nome}</p>
        <h1 className="m-0 text-[28px] font-extrabold leading-tight">Olá, {acesso.nome.split(" ")[0]}</h1>
      </div>

      {todas ? (
        <Cartao className="flex flex-col gap-1 border-t-4 !border-t-detalhe p-5">
          <div className="text-xs font-extrabold uppercase tracking-wide text-marca">Visão geral</div>
          <div className="text-2xl font-extrabold">Todas as edições</div>
          <div className="text-sm text-suave">{eds.length} {eds.length === 1 ? "edição cadastrada" : "edições cadastradas"}. Toque numa edição para entrar nela.</div>
        </Cartao>
      ) : ed ? (
        <Cartao className="flex flex-col gap-1 border-t-4 !border-t-detalhe p-5">
          <div className="flex items-center justify-between gap-2"><div className="text-xs font-extrabold uppercase tracking-wide text-marca">{descricaoEd(ed)}</div><Selo tom={TOM[ed.status]}>{STATUS[ed.status]}</Selo></div>
          <div className="text-2xl font-extrabold">{ed.nome}</div>
          <div className="text-sm text-suave">{dmy(ed.data_ini)}{ed.data_fim ? ` a ${dmy(ed.data_fim)}` : ""}{ed.local ? ` · ${ed.local}` : ""}</div>
        </Cartao>
      ) : <Vazio>Nenhuma edição cadastrada ainda. Crie em “Edições”.</Vazio>}

      {atalhos.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {atalhos.map((a) => (
            <Link key={a.href + a.t} href={a.href} className="flex items-center justify-between gap-3 rounded-3xl border border-borda bg-white p-4">
              <div><b className="block text-base">{a.t}</b><span className="text-sm text-suave">{a.d}</span></div>
              <span className="text-xl font-extrabold text-marca">→</span>
            </Link>
          ))}
        </div>
      )}

      {todas && eds.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="px-1 pt-1 text-[13px] font-extrabold uppercase tracking-wide text-suave">Edições</div>
          {eds.map((e) => (
            <button key={e.id} type="button" onClick={() => trocar(e.id)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-borda bg-white px-4 text-left">
              <span className="h-4 w-4 rounded-full border border-borda" style={{ background: bolinha(e) }} />
              <span className="flex-1"><b className="block">{e.nome}</b><span className="text-xs text-suave">{descricaoEd(e)} · {dmy(e.data_ini)}</span></span>
              <Selo tom={TOM[e.status]}>{STATUS[e.status]}</Selo>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
