"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro } from "@/lib/dados";
import { norm } from "@/lib/tipos";
import { ContatoLinha } from "@/components/contato";
import { useAviso, useEdicao } from "@/components/provedores";
import { Botao, Carregando, Cartao, Chip, Icone, Janela, Selo, Vazio } from "@/components/ui";

type Linha = { id: string; nome: string; idade: number | null; categoria: string | null; necessidade: string | null; contatos: string[] | null; observacao: string | null };
const TAGS: Record<string, RegExp> = {
  Medicação: /medic|rem[eé]dio|insulin|press[aã]o|diabet|asma|epilep|convuls|hormon|tarja|comprimid|uso cont/i,
  Alimentar: /alerg|alimen|intoler|lactose|gl[uú]ten|vegetar|dieta|cel[ií]ac|amendoim|camar/i,
  Locomoção: /cadeira|locomo|mobilid|muleta|bengala|andar|joelho|cirurg|fratura|coluna/i,
};
const tagsDe = (t: string | null) => Object.entries(TAGS).filter(([, r]) => r.test(t ?? "")).map(([k]) => k);

export function Saude() {
  const { ed } = useEdicao();
  const aviso = useAviso();
  const [dados, setDados] = useState<Linha[] | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [aberta, setAberta] = useState<Linha | null>(null);

  const carregar = useCallback(async () => {
    if (!ed) return;
    const { data, error } = await supabase.rpc("saude_lista", { p_edicao: ed.id });
    if (error) { aviso(msgErro(error)); setDados([]); return; }
    setDados((data as Linha[]) ?? []);
  }, [ed, aviso]);
  useEffect(() => { setDados(null); carregar(); }, [carregar]);

  const vis = useMemo(() => (dados ?? []).filter((l) => (!tag || tagsDe(l.necessidade).includes(tag)) && (!q || norm(l.nome + " " + (l.necessidade ?? "")).includes(norm(q)))), [dados, q, tag]);
  if (!ed) return <Vazio>Crie uma edição primeiro.</Vazio>;
  if (!dados) return <Carregando />;

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-suave">{dados.length} {dados.length === 1 ? "pessoa com necessidade" : "pessoas com necessidade"} em {ed.nome}. Aqui aparece só o que é de saúde.</p>
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-borda bg-white px-3">
        <Icone n="busca" tam={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome ou remédio" aria-label="Buscar" className="min-w-0 flex-1 bg-transparent outline-none" />
      </label>
      <div className="flex gap-2 overflow-x-auto">
        <Chip ativo={!tag} onClick={() => setTag("")}>Todos</Chip>
        {Object.keys(TAGS).map((t) => <Chip key={t} ativo={tag === t} onClick={() => setTag(tag === t ? "" : t)}>{t}</Chip>)}
      </div>
      {vis.length === 0 && <Vazio>Ninguém encontrado.</Vazio>}
      {vis.map((l) => (
        <button key={l.id} type="button" onClick={() => setAberta(l)} className="text-left">
          <Cartao className="flex flex-col gap-1.5 p-4">
            <div className="flex items-center justify-between gap-2"><b className="text-base">{l.nome}</b><span className="text-sm text-suave">{l.idade ? `${l.idade} anos` : ""}</span></div>
            <p className="m-0 text-sm">{l.necessidade}</p>
            <div className="flex flex-wrap gap-1.5">{tagsDe(l.necessidade).map((t) => <Selo key={t} tom="aviso">{t}</Selo>)}{l.observacao && <Selo tom="ok">com observação</Selo>}</div>
          </Cartao>
        </button>
      ))}
      {aberta && <Detalhe l={aberta} onFechar={() => setAberta(null)} onSalvo={() => { setAberta(null); carregar(); }} />}
    </div>
  );
}

function Detalhe({ l, onFechar, onSalvo }: { l: Linha; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const [obs, setObs] = useState(l.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    setSalvando(true);
    const { error } = await supabase.rpc("salvar_obs_saude", { p_id: l.id, p_obs: obs });
    setSalvando(false);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Observação salva."); onSalvo();
  }
  return (
    <Janela titulo={l.nome} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <div><div className="text-xs font-bold uppercase text-suave">Necessidade</div><p className="m-0">{l.necessidade}</p></div>
        {l.contatos && l.contatos.length > 0 && <div><div className="text-xs font-bold uppercase text-suave">Contato de emergência</div>{l.contatos.map((c, i) => <ContatoLinha key={i} texto={c} />)}</div>}
        <label className="flex flex-col gap-1.5 text-sm font-bold">Observação da equipe de saúde
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className="rounded-2xl border border-borda bg-white p-3 text-base font-normal outline-none focus:border-marca" placeholder="Ex.: medicação guardada com a enfermeira" />
        </label>
        <Botao onClick={salvar} disabled={salvando || obs === (l.observacao ?? "")} bloco>Salvar observação</Botao>
      </div>
    </Janela>
  );
}
