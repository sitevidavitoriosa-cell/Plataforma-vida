"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { dmy, fmtN, num, type Edicao, type Envio } from "@/lib/tipos";
import { podeEscrever } from "@/lib/perm";
import { CORES, CORES_TIPO, ESCOLHAS, NOMES_COR, TIPOS, bolinha, descricaoEd, escolhaDe, nomeAuto } from "@/lib/cores";
import { useAuth, useAviso, useEdicao } from "@/components/provedores";
import { Botao, Campo, Carregando, Cartao, Icone, Janela, Selo, Titulo, Vazio } from "@/components/ui";

const ROTULO = { planejada: "Planejada", aberta: "Aberta", fechada: "Fechada" } as const;
const TOM = { planejada: "aviso", aberta: "ok", fechada: "neutro" } as const;

export default function Edicoes() {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const ctx = useEdicao();
  const eds = { dados: ctx.carregou ? ctx.eds : null, recarregar: ctx.recarregar };
  const envios = useLista<Envio>("envios");
  const [form, setForm] = useState<Edicao | "nova" | null>(null);
  const pode = podeEscrever(acesso, "edicoes");

  if (!eds.dados || !envios.dados) return <Carregando />;
  const o = { aberta: 0, planejada: 1, fechada: 2 };
  const lista = eds.dados.slice().sort((a, b) => o[a.status] - o[b.status] || (b.data_ini ?? "").localeCompare(a.data_ini ?? ""));

  async function mudarStatus(e: Edicao, status: Edicao["status"]) {
    const { error } = await supabase.from("edicoes").update({ status }).eq("id", e.id);
    if (error) aviso(msgErro(error)); else aviso(`${e.nome}: ${ROTULO[status].toLowerCase()}.`);
    eds.recarregar();
  }

  return (
    <div>
      <Titulo direita={pode ? <Botao onClick={() => setForm("nova")} className="!min-h-11"><Icone n="mais1" tam={18} />Nova</Botao> : undefined}>Edições</Titulo>
      {lista.length === 0 && <Vazio>Nenhuma edição cadastrada ainda.</Vazio>}
      <div className="flex flex-col gap-3">
        {lista.map((e) => {
          const nItens = envios.dados!.filter((x) => x.edicao_id === e.id).length;
          return (
            <Cartao key={e.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div><b className="flex items-center gap-2 text-lg"><span className="h-3 w-3 rounded-full" style={{ background: bolinha(e) }} />{e.nome}</b><div className="text-sm text-suave">{descricaoEd(e)} · {dmy(e.data_ini)}{e.data_fim ? ` a ${dmy(e.data_fim)}` : ""}{e.local ? ` · ${e.local}` : ""}</div></div>
                <Selo tom={TOM[e.status]}>{ROTULO[e.status]}</Selo>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span><b className="text-lg">{fmtN(e.enc)}</b> <span className="text-suave">encontristas</span></span>
                <span><b className="text-lg">{nItens}</b> <span className="text-suave">itens enviados</span></span>
                {e.resp && <span className="text-suave">Responsável: <b className="text-texto">{e.resp}</b></span>}
              </div>
              {pode && (
                <div className="flex flex-wrap gap-2">
                  {e.status === "planejada" && <Botao v="suave" className="!min-h-11" onClick={() => mudarStatus(e, "aberta")}>Abrir edição</Botao>}
                  {e.status === "aberta" && <Botao v="suave" className="!min-h-11" onClick={() => mudarStatus(e, "fechada")}>Encerrar edição</Botao>}
                  {e.status === "fechada" && <Botao v="sec" className="!min-h-11" onClick={() => mudarStatus(e, "aberta")}>Reabrir</Botao>}
                  <Botao v="sec" className="!min-h-11" onClick={() => setForm(e)}><Icone n="lapis" tam={16} />Editar</Botao>
                </div>
              )}
              {e.status === "fechada" && <LimpezaLgpd ed={e} admin={acesso?.perfil === "admin"} onFeito={eds.recarregar} />}
            </Cartao>
          );
        })}
      </div>
      {form && <FormEdicao ed={form === "nova" ? null : form} onFechar={() => setForm(null)} onSalvo={() => { eds.recarregar(); setForm(null); }} />}
    </div>
  );
}

/** LGPD: depois do retiro, o administrador apaga os dados sensíveis da edição (saúde, telefone, e-mail, endereço, CEP). Nome, rede e perfil espiritual ficam para os relatórios. */
function LimpezaLgpd({ ed, admin, onFeito }: { ed: Edicao; admin: boolean; onFeito: () => void }) {
  const aviso = useAviso();
  const [confirma, setConfirma] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  if (ed.dados_limpos_em) return <p className="m-0 rounded-2xl bg-fundo px-3 py-2 text-sm text-suave">Dados sensíveis apagados em {new Date(ed.dados_limpos_em).toLocaleDateString("pt-BR")}.</p>;
  if (!admin) return null;
  const velha = !!ed.data_fim && (Date.now() - new Date(ed.data_fim + "T12:00:00").getTime()) / 86400000 > 90;
  async function limpar() {
    if (!confirma) { setConfirma(true); return; }
    setOcupado(true);
    const { error } = await supabase.rpc("limpar_dados_sensiveis", { p_edicao: ed.id });
    setOcupado(false); setConfirma(false);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Dados sensíveis apagados. Os links dos quartos e das decisões foram desligados."); onFeito();
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-borda p-3">
      {velha && <p className="m-0 text-sm font-bold text-alerta">Esta edição terminou há mais de 90 dias. Apague os dados sensíveis.</p>}
      <p className="m-0 text-sm text-suave">Apaga saúde, contatos de emergência, telefone, e-mail, endereço e CEP dos encontristas desta edição. Nomes, rede e perfil espiritual ficam para os relatórios. Não dá para desfazer.</p>
      <Botao v="sec" onClick={limpar} disabled={ocupado} className={`!min-h-11 ${confirma ? "!border-alerta !bg-alerta !text-white" : "!text-alerta"}`}>{ocupado ? "Apagando…" : confirma ? "Confirmar: apagar para sempre" : "Apagar dados sensíveis (LGPD)"}</Botao>
    </div>
  );
}

function FormEdicao({ ed, onFechar, onSalvo }: { ed: Edicao | null; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const [f, setF] = useState({ nome: ed?.nome ?? nomeAuto("Roxa"), ini: ed?.data_ini ?? "", fim: ed?.data_fim ?? "", local: ed?.local ?? "", resp: ed?.resp ?? "", enc: String(ed?.enc ?? 0), esc: ed ? escolhaDe(ed) : "Roxa", junto: !!ed?.rede2, rede2: ed?.rede2 ?? "" });
  const [del, setDel] = useState(false);
  const [nomeManual, setNomeManual] = useState(!!ed);
  const mudar = (p: Partial<typeof f>) => { const n = { ...f, ...p }; if (!nomeManual) n.nome = nomeAuto(n.esc, n.junto && NOMES_COR.includes(n.esc) ? n.rede2 || null : null); setF(n); };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim()) { aviso("Dê um nome para a edição."); return; }
    if (!f.ini || !f.fim) { aviso("Informe o início e o fim do retiro."); return; }
    if (f.fim < f.ini) { aviso("O fim não pode ser antes do início."); return; }
    const enc = num(f.enc || "0");
    if (!isFinite(enc) || enc < 0) { aviso("Número de encontristas inválido."); return; }
    const ehRede = NOMES_COR.includes(f.esc);
    if (ehRede && f.junto && (!f.rede2 || f.rede2 === f.esc)) { aviso("Escolha a outra rede."); return; }
    const d = { tipo: ehRede ? "rede" : f.esc, cor: ehRede ? f.esc : null, rede2: ehRede && f.junto ? f.rede2 : null, nome: f.nome.trim(), data_ini: f.ini, data_fim: f.fim, local: f.local.trim() || null, resp: f.resp.trim() || null, enc: Math.round(enc) };
    const r = ed ? await supabase.from("edicoes").update(d).eq("id", ed.id) : await supabase.from("edicoes").insert(d);
    if (r.error) { aviso(msgErro(r.error)); return; }
    aviso(ed ? "Edição atualizada." : `${d.nome} criada como planejada.`); onSalvo();
  }
  async function excluir() {
    if (!ed) return;
    const { error } = await supabase.from("edicoes").delete().eq("id", ed.id);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Edição excluída."); onSalvo();
  }

  return (
    <Janela titulo={ed ? "Editar edição" : "Nova edição"} onFechar={onFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-3.5">
        <Campo rotulo="Nome (preenchido sozinho)" value={f.nome} onChange={(e) => { setNomeManual(true); setF({ ...f, nome: e.target.value }); }} placeholder="Vida Roxa" />
        <div><div className="mb-1.5 text-sm font-bold">Edição</div><div className="flex flex-wrap gap-2">
          {ESCOLHAS.map((k) => <button key={k} type="button" onClick={() => mudar({ esc: k, rede2: k === f.rede2 ? "" : f.rede2 })} className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-bold ${f.esc === k ? "border-texto bg-marca-clara" : "border-borda bg-white"}`}>{(CORES[k] ?? CORES_TIPO[k]) && <span className="h-4 w-4 rounded-full border border-borda" style={{ background: (CORES[k] ?? CORES_TIPO[k]).hex }} />}Vida {TIPOS[k] ?? k}</button>)}
        </div></div>
        {NOMES_COR.includes(f.esc) && (
          <div className="flex flex-col gap-2">
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-borda bg-white px-4">
              <input type="checkbox" checked={f.junto} onChange={(e) => mudar({ junto: e.target.checked })} className="h-5 w-5" />
              <span className="font-bold">É junto com outra rede?</span>
            </label>
            {f.junto && <div className="flex flex-wrap gap-2">{NOMES_COR.filter((n) => n !== f.esc).map((n) => <button key={n} type="button" onClick={() => mudar({ rede2: n })} className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-bold ${f.rede2 === n ? "border-texto bg-marca-clara" : "border-borda"}`}><span className="h-4 w-4 rounded-full border border-borda" style={{ background: CORES[n].hex }} />{n}</button>)}</div>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Início" type="date" value={f.ini} onChange={(e) => setF({ ...f, ini: e.target.value })} />
          <Campo rotulo="Fim" type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
        </div>
        <Campo rotulo="Quantidade de encontristas" inputMode="numeric" value={f.enc} onChange={(e) => setF({ ...f, enc: e.target.value })} dica="Entra nos relatórios, como o material por encontrista." />
        <Campo rotulo="Local" value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} />
        <Campo rotulo="Responsável" value={f.resp} onChange={(e) => setF({ ...f, resp: e.target.value })} />
        <Botao type="submit" bloco>Salvar</Botao>
        {ed && !del && <Botao v="sec" bloco className="!text-alerta" onClick={() => setDel(true)}><Icone n="lixo" tam={18} />Excluir edição</Botao>}
        {ed && del && <Botao v="perigo" bloco onClick={excluir}>Confirmar: excluir e apagar enviados e decisões dela</Botao>}
      </form>
    </Janela>
  );
}
