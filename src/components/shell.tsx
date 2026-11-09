"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useEdicao } from "./provedores";
import { temaDe, bolinha, descricaoEd } from "@/lib/cores";
import { Carregando, Icone, Janela, Botao, cx } from "./ui";
import { PERFIS, podeVer } from "@/lib/perm";

const ITENS = [
  { href: "/", modulo: "inicio", rotulo: "Painel", icone: "inicio" },
  { href: "/setores", modulo: "setores", rotulo: "Setores", icone: "estoque" },
  { href: "/edicoes", modulo: "edicoes", rotulo: "Edições", icone: "edicoes" },
  { href: "/encontristas", modulo: "encontristas", rotulo: "Encontristas", icone: "pessoas" },
  { href: "/financeiro", modulo: "financeiro", rotulo: "Financeiro", icone: "financeiro" },
  { href: "/decisoes", modulo: "decisoes", rotulo: "Decisões", icone: "decisoes" },
  { href: "/pessoas", modulo: "pessoas", rotulo: "Pessoas", icone: "pessoas" },
];

function SeletorEdicao() {
  const { eds, ed, trocar } = useEdicao();
  const [aberto, setAberto] = useState(false);
  if (!ed) return null;
  const c = { hex: temaDe(ed).detalhe };
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="flex min-h-10 items-center gap-2 rounded-full border border-borda bg-white px-3.5 text-sm font-bold">
        <span className="h-3 w-3 rounded-full" style={{ background: c.hex }} />{ed.nome}<span className="text-suave">▾</span>
      </button>
      {aberto && (
        <Janela titulo="Trocar de edição" onFechar={() => setAberto(false)}>
          <div className="flex flex-col gap-2">
            {eds.map((e) => (
              <button key={e.id} type="button" onClick={() => { trocar(e.id); setAberto(false); }}
                className={cx("flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left", e.id === ed.id ? "border-marca bg-marca-clara" : "border-borda bg-white")}>
                <span className="h-4 w-4 rounded-full border border-borda" style={{ background: bolinha(e) }} />
                <span className="flex-1"><b className="block">{e.nome}</b><span className="text-xs text-suave">{descricaoEd(e)}</span></span>
              </button>
            ))}
          </div>
        </Janela>
      )}
    </>
  );
}

export function Protegido({ children }: { children: React.ReactNode }) {
  const { carregando, sessao, acesso, sair } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);

  useEffect(() => { if (!carregando && !sessao) router.replace("/entrar"); }, [carregando, sessao, router]);

  if (carregando || !sessao) return <Carregando />;
  if (!acesso) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-extrabold">Sem acesso por enquanto</h1>
        <p className="text-suave">O e-mail <b>{sessao.user.email}</b> não está liberado. Peça a um administrador para te convidar.</p>
        <Botao v="sec" onClick={sair}>Sair</Botao>
      </div>
    );
  }

  const itens = ITENS.filter((i) => i.modulo === "inicio" || podeVer(acesso, i.modulo));
  const principais = itens.filter((i) => i.modulo !== "pessoas");
  const ativo = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));

  return (
    <div className="min-h-dvh md:pl-64">
      {/* barra lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-borda bg-white p-4 md:flex">
        <div className="flex items-center gap-3 px-2 pb-6 pt-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-marca text-xl font-extrabold text-white">V</div>
          <div className="leading-tight"><b>Vida Vitoriosa</b><div className="text-xs text-suave">Plataforma de gestão</div></div>
        </div>
        <div className="mb-4 px-1"><SeletorEdicao /></div>
        <nav className="flex flex-col gap-1">
          {itens.map((i) => (
            <Link key={i.href} href={i.href} className={cx("flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-bold", ativo(i.href) ? "border-l-4 border-detalhe bg-marca-clara text-marca-esc" : "text-suave hover:bg-fundo")}>
              <Icone n={i.icone} />{i.rotulo}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-fundo p-3 text-sm">
          <b className="block">{acesso.nome}</b>
          <span className="text-suave">{PERFIS[acesso.perfil]?.nome}{acesso.equipes.length ? " · " + acesso.equipes.map((e) => e.nome).join(", ") : ""}</span>
          <button type="button" onClick={sair} className="mt-2 block text-sm font-bold text-alerta">Sair</button>
        </div>
      </aside>

      {/* topo (celular) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-borda bg-fundo/95 px-4 py-2.5 backdrop-blur md:hidden">
        <SeletorEdicao />
        <button type="button" aria-label="Menu da conta" onClick={() => setMenu(true)} className="grid h-11 w-11 place-items-center rounded-full border border-borda bg-white font-extrabold text-marca-esc">
          {acesso.nome.trim().charAt(0).toUpperCase()}
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-32 md:px-8 md:pb-12">{children}</main>

      {/* menu de baixo, fixo (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-borda bg-white px-1.5 pt-1.5 md:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)" }}>
        {(principais.length > 5 ? principais.slice(0, 4) : principais).map((i) => (
          <Link key={i.href} href={i.href} className={cx("flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl", ativo(i.href) ? "text-marca" : "text-suave")}>
            <Icone n={i.icone} tam={24} /><span className="text-[11px] font-bold">{i.rotulo}</span>
          </Link>
        ))}
        {principais.length > 5 && (
          <button type="button" onClick={() => setMenu(true)} className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-suave">
            <Icone n="mais" tam={24} /><span className="text-[11px] font-bold">Mais</span>
          </button>
        )}
      </nav>

      {menu && (
        <Janela titulo={acesso.nome} onFechar={() => setMenu(false)}>
          <p className="mb-4 mt-0 text-suave">{acesso.email}<br />{PERFIS[acesso.perfil]?.nome}{acesso.equipes.length ? " · " + acesso.equipes.map((e) => e.nome).join(", ") : ""}</p>
          <div className="flex flex-col gap-2.5">
            {principais.length > 5 && principais.slice(4).map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setMenu(false)} className="flex min-h-12 items-center gap-2 rounded-2xl border border-borda bg-white px-4 font-extrabold"><Icone n={i.icone} />{i.rotulo}</Link>
            ))}
            {podeVer(acesso, "pessoas") && <Link href="/pessoas" onClick={() => setMenu(false)} className="flex min-h-12 items-center gap-2 rounded-2xl border border-borda bg-white px-4 font-extrabold"><Icone n="pessoas" />Pessoas e equipes</Link>}
            <Botao v="sec" onClick={sair}><Icone n="sair" tam={18} />Sair</Botao>
          </div>
        </Janela>
      )}
    </div>
  );
}
