"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { norm } from "@/lib/tipos";
import { useAviso } from "@/components/provedores";
import { Carregando, Chip, Icone, Janela, Vazio } from "@/components/ui";

type Reg = { id: number; quando: string; quem: string; tabela: string; acao: string; rotulo: string | null; detalhe: string | null };
const TABELAS: Record<string, string> = {
  pessoas: "Pessoas", pessoa_edicoes: "Acesso a edições", equipes: "Equipes", equipe_membros: "Membros de equipe", edicoes: "Edições", lancamentos: "Financeiro",
  quartos: "Quartos", itens: "Estoque (itens)", org_areas: "Organizacional (áreas)", org_arquivos: "Organizacional (arquivos)", decisoes_cfg: "Decisões (botões)", decisoes: "Decisões",
  registro_links: "Link de decisões", quartos_link_edicao: "Link dos quartos", encontristas: "Encontristas", encontrista_saude: "Saúde", encontrista_espiritual: "Perfil espiritual",
};
const ACOES: Record<string, string> = { INSERT: "criou", UPDATE: "alterou", DELETE: "apagou", LIMPEZA_LGPD: "apagou dados sensíveis" };

/** Registro de atividades (só administrador): quem criou, alterou ou apagou o quê. Não mostra o conteúdo de dados de saúde. */
export function RegistroAtividades({ onFechar }: { onFechar: () => void }) {
  const aviso = useAviso();
  const [dados, setDados] = useState<Reg[] | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("");
  useEffect(() => {
    supabase.from("auditoria").select("id,quando,quem,tabela,acao,rotulo,detalhe").order("id", { ascending: false }).limit(500)
      .then(({ data, error }) => { if (error) { aviso(msgErro(error)); setDados([]); } else setDados((data as Reg[]) ?? []); });
  }, [aviso]);
  const tabelas = useMemo(() => Array.from(new Set((dados ?? []).map((r) => r.tabela))).sort(), [dados]);
  const vis = (dados ?? []).filter((r) => (!tab || r.tabela === tab) && (!q || norm([r.quem, r.rotulo, r.detalhe, TABELAS[r.tabela]].filter(Boolean).join(" ")).includes(norm(q))));
  return (
    <Janela titulo="Registro de atividades" onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-suave">As últimas 500 ações no sistema. Ninguém consegue editar ou apagar este registro. O conteúdo de dados de saúde nunca é gravado aqui, só que houve alteração.</p>
        <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-borda bg-white px-3"><Icone n="busca" tam={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa, tabela ou nome" aria-label="Buscar" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          <Chip ativo={!tab} onClick={() => setTab("")}>Tudo</Chip>
          {tabelas.map((t) => <Chip key={t} ativo={tab === t} onClick={() => setTab(tab === t ? "" : t)}>{TABELAS[t] ?? t}</Chip>)}
        </div>
        {!dados ? <Carregando /> : vis.length === 0 ? <Vazio>Nada registrado ainda.</Vazio> : (
          <div className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-white">
            {vis.map((r) => (
              <div key={r.id} className="flex flex-col gap-0.5 px-3 py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-2"><b>{r.quem}</b><span className="shrink-0 text-xs text-suave">{new Date(r.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div>
                <span>{ACOES[r.acao] ?? r.acao} · {TABELAS[r.tabela] ?? r.tabela}{r.rotulo ? ` · ${r.rotulo}` : ""}</span>
                {r.detalhe && <span className="text-xs text-suave">{r.detalhe}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Janela>
  );
}
