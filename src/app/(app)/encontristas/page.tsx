"use client";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { norm, type Edicao } from "@/lib/tipos";
import { podeVerFicha } from "@/lib/perm";
import { lerArquivo, type ItemImport } from "@/lib/importar";
import { ContatoLinha } from "@/components/contato";
import { DashboardEncontristas } from "@/components/dashboardEnc";
import { useAuth, useAviso, useEdicao } from "@/components/provedores";
import { Botao, Campo, Carregando, Cartao, Chip, Icone, Janela, Selo, Seletor, Titulo, Vazio } from "@/components/ui";

type Saude = { tem_necessidade: boolean; necessidade: string | null; contatos: string[]; observacao: string | null };
type Espiritual = { batizado: boolean | null; igreja: string | null; em_celula: boolean | null; celula: string | null; lider_celula: string | null; discipulado: string | null; rede: string | null };
type Enc = {
  id: string; edicao_id: string; cod: string; nome: string; email: string | null; fone: string | null; endereco: string | null;
  bairro: string | null; municipio: string | null; cep: string | null; sexo: string | null; idade: number | null;
  estado_civil: string | null; categoria: string | null; status: string | null; cancelada: boolean;
  encontrista_saude: Saude | Saude[] | null; encontrista_espiritual: Espiritual | Espiritual[] | null;
};
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const SEL = "*, encontrista_saude(*), encontrista_espiritual(*)";

export default function Encontristas() {
  const { acesso } = useAuth();
  const { eds, ed } = useEdicao();
  const lista = useLista<Enc>("encontristas", SEL, "nome");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Encontrista");
  const [soSaude, setSoSaude] = useState(false);
  const [bat, setBat] = useState<"" | "sim" | "nao">("");
  const [rede, setRede] = useState("");
  const [ficha, setFicha] = useState<Enc | null>(null);
  const [importando, setImportando] = useState(false);
  const verSaude = podeVerFicha(acesso), verEsp = podeVerFicha(acesso);

  const edicaoId = ed?.id ?? "";

  const base = useMemo(() => (lista.dados ?? []).filter((e) => e.edicao_id === edicaoId && !e.cancelada), [lista.dados, edicaoId]);
  const cats = useMemo(() => Array.from(new Set(base.map((e) => (e.categoria ?? "").trim()).filter(Boolean))).sort(), [base]);
  const redes = useMemo(() => Array.from(new Set(base.map((e) => um(e.encontrista_espiritual)?.rede ?? "").filter(Boolean))).sort(), [base]);

  const vis = base.filter((e) => {
    if (cat && (e.categoria ?? "").trim() !== cat) return false;
    if (q && !norm(e.nome + " " + (e.cod ?? "")).includes(norm(q))) return false;
    if (soSaude && !um(e.encontrista_saude)?.tem_necessidade) return false;
    const esp = um(e.encontrista_espiritual);
    if (bat === "sim" && esp?.batizado !== true) return false;
    if (bat === "nao" && esp?.batizado !== false) return false;
    if (rede && esp?.rede !== rede) return false;
    return true;
  });

  if (!lista.dados) return <Carregando />;
  const nNec = base.filter((e) => (!cat || (e.categoria ?? "").trim() === cat) && um(e.encontrista_saude)?.tem_necessidade).length;

  return (
    <div>
      <Titulo direita={podeVerFicha(acesso) ? <Botao onClick={() => setImportando(true)} className="!min-h-11">Importar planilha</Botao> : undefined}>Encontristas</Titulo>
      {verEsp && <DashboardEncontristas base={base} />}
      <div className="flex flex-col gap-3 pb-4">
        <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-borda bg-white px-3">
          <Icone n="busca" tam={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou código" aria-label="Buscar encontrista" className="min-w-0 flex-1 bg-transparent text-base outline-none" />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip ativo={cat === ""} onClick={() => setCat("")}>Todos</Chip>
          {cats.map((c) => <Chip key={c} ativo={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {verSaude && <Chip ativo={soSaude} onClick={() => setSoSaude(!soSaude)}>Com necessidade de saúde ({nNec})</Chip>}
          {verEsp && <>
            <Chip ativo={bat === "sim"} onClick={() => setBat(bat === "sim" ? "" : "sim")}>Batizado</Chip>
            <Chip ativo={bat === "nao"} onClick={() => setBat(bat === "nao" ? "" : "nao")}>Não batizado</Chip>
            {redes.map((r) => <Chip key={r} ativo={rede === r} onClick={() => setRede(rede === r ? "" : r)}>{r}</Chip>)}
          </>}
        </div>
        <div className="text-sm text-suave">{vis.length} {vis.length === 1 ? "pessoa" : "pessoas"}</div>
      </div>

      {base.length === 0 && <Vazio>Nenhum encontrista nesta edição ainda.{podeVerFicha(acesso) ? " Use “Importar planilha”." : ""}</Vazio>}
      <Cartao className="overflow-hidden">
        {vis.map((e) => {
          const s = um(e.encontrista_saude);
          return (
            <button key={e.id} type="button" onClick={() => setFicha(e)} className="flex min-h-16 w-full items-center gap-3 border-b border-borda px-4 py-2.5 text-left last:border-b-0">
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[15px]">{e.nome}</b>
                <span className="text-xs text-suave">{[e.categoria?.trim(), e.idade ? e.idade + " anos" : "", e.bairro].filter(Boolean).join(" · ")}</span>
              </div>
              {verSaude && s?.tem_necessidade && <Selo tom="alerta">Saúde</Selo>}
            </button>
          );
        })}
      </Cartao>

      {ficha && <Ficha e={ficha} verSaude={verSaude} verEsp={verEsp} onFechar={() => setFicha(null)} onSalvo={lista.recarregar} />}
      {importando && edicaoId && <Importar edicaoId={edicaoId} edicaoNome={ed?.nome ?? ""} onFechar={() => setImportando(false)} onFeito={lista.recarregar} />}
    </div>
  );
}

function Linha({ r, v }: { r: string; v?: string | number | null }) {
  if (v == null || v === "") return null;
  return <div className="flex justify-between gap-4 py-1.5 text-[15px]"><span className="text-suave">{r}</span><span className="text-right font-bold">{v}</span></div>;
}
const sn = (b: boolean | null | undefined) => (b == null ? "" : b ? "Sim" : "Não");

function Ficha({ e, verSaude, verEsp, onFechar, onSalvo }: { e: Enc; verSaude: boolean; verEsp: boolean; onFechar: () => void; onSalvo: () => void }) {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const s = um(e.encontrista_saude), esp = um(e.encontrista_espiritual);
  const [obs, setObs] = useState(s?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const podeObs = verSaude;

  async function salvarObs() {
    setSalvando(true);
    const { error } = await supabase.rpc("salvar_obs_saude", { p_id: e.id, p_obs: obs });
    setSalvando(false);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Observação salva."); onSalvo();
  }

  return (
    <Janela titulo={e.nome} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {e.categoria && <Selo tom="ok">{e.categoria.trim()}</Selo>}
          {e.status && e.status !== "Ok" && <Selo tom="aviso">{e.status}</Selo>}
          <span className="text-xs text-suave">Inscrição {e.cod}</span>
        </div>

        <Cartao className="px-4 py-2">
          <Linha r="Idade" v={e.idade ? e.idade + " anos" : ""} /><Linha r="Sexo" v={e.sexo} /><Linha r="Estado civil" v={e.estado_civil} />
          <Linha r="WhatsApp" v={e.fone} /><Linha r="E-mail" v={e.email} />
          <Linha r="Endereço" v={e.endereco} /><Linha r="Bairro" v={e.bairro} /><Linha r="Município" v={e.municipio} />
        </Cartao>

        {verSaude && (
          <Cartao className={"p-4 " + (s?.tem_necessidade ? "!border-[#E7B8AB] !bg-alerta-clara" : "")}>
            <b className="text-base">Saúde</b>
            <p className="my-1.5 whitespace-pre-wrap text-[15px]">{s?.tem_necessidade ? s.necessidade : "Sem necessidade informada."}</p>
            {!!s?.contatos.length && <>
              <div className="mt-2 text-[13px] font-bold text-suave">Contatos de emergência</div>
              {s.contatos.map((c, i) => <ContatoLinha key={i} texto={c} />)}
            </>}
            {podeObs && (
              <div className="mt-3 flex flex-col gap-2">
                <Campo rotulo="Observação da equipe de Saúde" value={obs} onChange={(x) => setObs(x.target.value)} placeholder="Ex.: remédio conferido, aviso para a cozinha" />
                <Botao v="suave" onClick={salvarObs} disabled={salvando || obs === (s?.observacao ?? "")}>Salvar observação</Botao>
              </div>
            )}
            {!podeObs && s?.observacao && <p className="mt-2 text-sm text-suave">Obs.: {s.observacao}</p>}
          </Cartao>
        )}

        {verEsp && esp && (
          <Cartao className="px-4 py-2">
            <b className="block py-1.5 text-base">Vida espiritual</b>
            <Linha r="Batizado" v={sn(esp.batizado)} /><Linha r="Igreja" v={esp.igreja} />
            <Linha r="Participa de célula" v={sn(esp.em_celula)} /><Linha r="Célula" v={esp.celula} />
            <Linha r="Líder de célula" v={esp.lider_celula} /><Linha r="Discipulado" v={esp.discipulado} /><Linha r="Rede" v={esp.rede} />
          </Cartao>
        )}
      </div>
    </Janela>
  );
}

function Importar({ edicaoId, edicaoNome, onFechar, onFeito }: { edicaoId: string; edicaoNome: string; onFechar: () => void; onFeito: () => void }) {
  const aviso = useAviso();
  const [itens, setItens] = useState<ItemImport[] | null>(null);
  const [info, setInfo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function escolher(f: File | undefined) {
    if (!f) return;
    setErro(""); setItens(null); setInfo("Lendo…");
    try {
      const r = await lerArquivo(f);
      setItens(r.itens);
      const partes: string[] = [];
      if (r.faltando.length) partes.push(`Esta planilha não tem: ${r.faltando.join(", ")}. Tudo bem: ela será importada mesmo assim, e o que não veio fica como está no cadastro (nada é apagado).`);
      if (r.semCodigo) partes.push("Sem a coluna do código, a pessoa é reconhecida pelo e-mail ou pelo nome ao reimportar.");
      setInfo(partes.join(" "));
    } catch (x) { setInfo(""); setErro(x instanceof Error ? x.message : "Não consegui ler o arquivo."); }
  }

  async function enviar() {
    if (!itens) return;
    setEnviando(true);
    const { data, error } = await supabase.rpc("importar_encontristas", { p_edicao: edicaoId, p_itens: itens });
    setEnviando(false);
    if (error) { setErro(msgErro(error)); return; }
    const r = data as { novos: number; atualizados: number };
    aviso(`${r.novos} novos, ${r.atualizados} atualizados. Os crachás já estão prontos em Secretaria 1 › Crachás.`);
    onFeito(); onFechar();
  }

  const cont = (f: (i: ItemImport) => boolean) => itens?.filter(f).length ?? 0;
  return (
    <Janela titulo={`Importar para ${edicaoNome}`} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[15px] text-suave">Envie o arquivo .xlsx ou .csv exportado da plataforma de inscrição. Quem já existe é atualizado pelo código da inscrição; ninguém é duplicado.</p>
        <input type="file" accept=".xlsx,.csv" aria-label="Arquivo da planilha" onChange={(e) => escolher(e.target.files?.[0])} className="min-h-12 rounded-2xl border border-borda bg-white p-3 text-sm" />
        {info && <p className="m-0 text-sm font-bold text-aviso">{info}</p>}
        {erro && <p role="alert" className="m-0 text-sm font-bold text-alerta">{erro}</p>}
        {itens && (
          <Cartao className="p-4 text-[15px]">
            <b>{itens.length} inscrições encontradas</b>
            <div className="mt-1 text-suave">
              {cont((i) => !i.categoria || i.categoria === "Encontrista")} encontristas · {cont((i) => !!i.cancelada)} canceladas<br />
              {cont((i) => !!i.tem_necessidade)} com necessidade de saúde · {cont((i) => i.batizado === true)} batizados
            </div>
          </Cartao>
        )}
        <Botao bloco onClick={enviar} disabled={!itens || !itens.length || enviando}>{enviando ? "Importando…" : "Importar"}</Botao>
      </div>
    </Janela>
  );
}
