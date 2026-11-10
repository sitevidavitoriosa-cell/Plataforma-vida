"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { TODAS, useAuth, useEdicao } from "./provedores";
import { temaDe, bolinha, descricaoEd } from "@/lib/cores";
import { Carregando, Icone, Janela, Botao, cx } from "./ui";
import { PERFIS, podeVer } from "@/lib/perm";
import { entradasSetores, hrefSetor, type EntradaSetor } from "@/lib/setores";

const ITENS = [
  { href: "/", modulo: "inicio", rotulo: "Painel", icone: "inicio" },
  { href: "/estoque", modulo: "estoque", rotulo: "Estoque", icone: "estoque" },
  { href: "/setores", modulo: "setores", rotulo: "Equipes", icone: "pessoas" },
  { href: "/edicoes", modulo: "edicoes", rotulo: "Edições", icone: "edicoes" },
  { href: "/encontristas", modulo: "encontristas", rotulo: "Encontristas", icone: "pessoas" },
  { href: "/financeiro", modulo: "financeiro", rotulo: "Financeiro", icone: "financeiro" },
  { href: "/decisoes", modulo: "decisoes", rotulo: "Decisões", icone: "decisoes" },
  { href: "/organizacional", modulo: "organizacional", rotulo: "Organizacional", icone: "pasta" },
  { href: "/pessoas", modulo: "pessoas", rotulo: "Pessoas", icone: "pessoas" },
];

function useEntradasSetores(): EntradaSetor[] {
  const { acesso } = useAuth();
  return entradasSetores(acesso);
}

function ListaSetores(p: { entradas: EntradaSetor[]; onEscolher?: () => void }) {
  return <Suspense fallback={null}><ListaSetoresInterna {...p} /></Suspense>;
}
function ListaSetoresInterna({ entradas, onEscolher }: { entradas: EntradaSetor[]; onEscolher?: () => void }) {
  const aba = useSearchParams().get("aba"), caminho = usePathname();
  const params = aba ?? (caminho === "/setores" ? entradas[0]?.id : null);
  return (
    <div className="flex flex-col">
      {entradas.map((e) => (
        <div key={e.id}>
          <Link href={hrefSetor(e.id)} onClick={onEscolher} className={cx("flex min-h-10 items-center rounded-xl px-3 text-[14px] font-bold", params === e.id ? "bg-marca-clara text-marca-esc" : "text-suave hover:bg-fundo")}>{e.nome}</Link>
        </div>
      ))}
    </div>
  );
}

function SeletorEdicao() {
  const { eds, ed, todas, podeTodas, trocar } = useEdicao();
  const [aberto, setAberto] = useState(false);
  if (!ed && !todas) return null;
  const c = { hex: temaDe(ed).detalhe };
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="flex min-h-10 items-center gap-2 rounded-full border border-borda bg-white px-3.5 text-sm font-bold">
        {todas ? <span className="h-3 w-3 rounded-full bg-[conic-gradient(#7c4dcc,#1f6feb,#f2b705,#e8590c,#d62828,#2f9e44,#7c4dcc)]" /> : <span className="h-3 w-3 rounded-full" style={{ background: c.hex }} />}
        {todas ? "Todas as edições" : ed!.nome}<span className="text-suave">▾</span>
      </button>
      {aberto && (
        <Janela titulo="Trocar de edição" onFechar={() => setAberto(false)}>
          <div className="flex flex-col gap-2">
            {podeTodas && (
              <button type="button" onClick={() => { trocar(TODAS); setAberto(false); }}
                className={cx("flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left", todas ? "border-marca bg-marca-clara" : "border-borda bg-white")}>
                <span className="h-4 w-4 rounded-full border border-borda bg-[conic-gradient(#7c4dcc,#1f6feb,#f2b705,#e8590c,#d62828,#2f9e44,#7c4dcc)]" />
                <span className="flex-1"><b className="block">Todas as edições</b><span className="text-xs text-suave">Lista mãe do estoque e relatório anual</span></span>
              </button>
            )}
            {eds.map((e) => (
              <button key={e.id} type="button" onClick={() => { trocar(e.id); setAberto(false); }}
                className={cx("flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left", !todas && ed && e.id === ed.id ? "border-marca bg-marca-clara" : "border-borda bg-white")}>
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

/** Páginas que entendem "Todas as edições"; nas demais, pede para escolher uma edição. */
const PAGINAS_TODAS = ["/", "/estoque", "/relatorio", "/relatorio-anual", "/edicoes", "/pessoas", "/organizacional"];
function EscolhaEdicao() {
  const { eds, trocar } = useEdicao();
  return (
    <div className="flex flex-col gap-3 pt-6">
      <h1 className="m-0 text-2xl font-extrabold">Escolha uma edição</h1>
      <p className="m-0 text-suave">Esta página mostra os dados de uma edição por vez. “Todas as edições” serve para o estoque (lista mãe), o relatório anual e o painel.</p>
      {eds.map((e) => (
        <button key={e.id} type="button" onClick={() => trocar(e.id)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-borda bg-white px-4 text-left">
          <span className="h-4 w-4 rounded-full border border-borda" style={{ background: bolinha(e) }} />
          <span className="flex-1"><b className="block">{e.nome}</b><span className="text-xs text-suave">{descricaoEd(e)}</span></span>
        </button>
      ))}
    </div>
  );
}

export function Protegido({ children }: { children: React.ReactNode }) {
  const { carregando, sessao, acesso, sair } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [setoresAbertos, setSetoresAbertos] = useState(false);
  const [folhaSetores, setFolhaSetores] = useState(false);
  const entradas = useEntradasSetores();
  const { todas, ed } = useEdicao();

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
    <div className="min-h-dvh md:pl-64 print:pl-0">
      {/* barra lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 hidden print:!hidden w-64 flex-col border-r border-borda bg-white p-4 md:flex">
        <div className="flex items-center gap-3 px-2 pb-6 pt-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-marca text-xl font-extrabold text-white">V</div>
          <div className="leading-tight"><b>Vida Vitoriosa</b><div className="text-xs text-suave">Plataforma de gestão</div></div>
        </div>
        <div className="mb-4 px-1"><SeletorEdicao /></div>
        <nav className="flex flex-col gap-1">
          {itens.map((i) => i.modulo === "setores" ? (
            <div key={i.href}>
              <button type="button" onClick={() => setSetoresAbertos((v) => !v)} className={cx("flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-bold", ativo(i.href) ? "border-l-4 border-detalhe bg-marca-clara text-marca-esc" : "text-suave hover:bg-fundo")}>
                <Icone n={i.icone} /><span className="flex-1">{i.rotulo}</span><span className={cx("transition", (setoresAbertos || ativo(i.href)) && "rotate-180")}><Icone n="seta" tam={16} /></span>
              </button>
              {(setoresAbertos || ativo(i.href)) && <div className="ml-5 mt-1 max-h-[45vh] overflow-y-auto border-l border-borda pl-2"><ListaSetores entradas={entradas} /></div>}
            </div>
          ) : (
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
      <header className="sticky top-0 z-30 print:hidden flex items-center justify-between border-b border-borda bg-fundo/95 px-4 py-2.5 backdrop-blur md:hidden">
        <SeletorEdicao />
        <button type="button" aria-label="Menu da conta" onClick={() => setMenu(true)} className="grid h-11 w-11 place-items-center rounded-full border border-borda bg-white font-extrabold text-marca-esc">
          {acesso.nome.trim().charAt(0).toUpperCase()}
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl print:max-w-none px-4 pb-32 md:px-8 md:pb-12">{ed?.status === "fechada" && !["/edicoes", "/pessoas", "/organizacional"].includes(path) && <div className="mt-3 rounded-2xl bg-fundo px-4 py-3 text-sm font-bold text-suave print:hidden">Edição fechada: os dados ficam só para consulta. Para mexer de novo, reabra em Edições.</div>}
        {todas && !PAGINAS_TODAS.includes(path) ? <EscolhaEdicao /> : children}</main>

      {/* menu de baixo, fixo (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 print:hidden flex border-t border-borda bg-white px-1.5 pt-1.5 md:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)" }}>
        {(principais.length > 5 ? principais.slice(0, 4) : principais).map((i) => i.modulo === "setores" ? (
          <button key={i.href} type="button" onClick={() => setFolhaSetores(true)} className={cx("flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl", ativo(i.href) ? "text-marca" : "text-suave")}>
            <Icone n={i.icone} tam={24} /><span className="text-[11px] font-bold">{i.rotulo}</span>
          </button>
        ) : (
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

      {folhaSetores && (
        <Janela titulo="Equipes" onFechar={() => setFolhaSetores(false)}>
          {entradas.length === 0 ? <p className="m-0 text-suave">Você ainda não está em nenhuma equipe.</p> : <ListaSetores entradas={entradas} onEscolher={() => setFolhaSetores(false)} />}
        </Janela>
      )}

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
