"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { dmy, fmtN, num, type Edicao, type Envio } from "@/lib/tipos";
import { podeEscrever } from "@/lib/perm";
import { CORES, NOMES_COR, TIPOS, corDe } from "@/lib/cores";
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
                <div><b className="flex items-center gap-2 text-lg"><span className="h-3 w-3 rounded-full" style={{ background: corDe(e.cor).hex }} />{e.nome}</b><div className="text-sm text-suave">Vida {TIPOS[e.tipo]} · rede {e.cor} · {dmy(e.data_ini)}{e.data_fim ? ` a ${dmy(e.data_fim)}` : ""}{e.local ? ` · ${e.local}` : ""}</div></div>
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
            </Cartao>
          );
        })}
      </div>
      {form && <FormEdicao ed={form === "nova" ? null : form} onFechar={() => setForm(null)} onSalvo={() => { eds.recarregar(); setForm(null); }} />}
    </div>
  );
}

function FormEdicao({ ed, onFechar, onSalvo }: { ed: Edicao | null; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const [f, setF] = useState({ nome: ed?.nome ?? "", ini: ed?.data_ini ?? "", fim: ed?.data_fim ?? "", local: ed?.local ?? "", resp: ed?.resp ?? "", enc: String(ed?.enc ?? 0), tipo: ed?.tipo ?? "base", cor: ed?.cor ?? "Roxa" });
  const [del, setDel] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim()) { aviso("Dê um nome para a edição."); return; }
    if (!f.ini || !f.fim) { aviso("Informe o início e o fim do retiro."); return; }
    if (f.fim < f.ini) { aviso("O fim não pode ser antes do início."); return; }
    const enc = num(f.enc || "0");
    if (!isFinite(enc) || enc < 0) { aviso("Número de encontristas inválido."); return; }
    const d = { tipo: f.tipo, cor: f.cor, nome: f.nome.trim(), data_ini: f.ini, data_fim: f.fim, local: f.local.trim() || null, resp: f.resp.trim() || null, enc: Math.round(enc) };
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
        <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder={`Ex.: Vida ${TIPOS[f.tipo]} 14`} />
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(TIPOS).map(([k, v]) => <button key={k} type="button" onClick={() => setF({ ...f, tipo: k as Edicao["tipo"] })} className={`min-h-12 rounded-2xl border font-extrabold ${f.tipo === k ? "border-marca bg-marca-clara text-marca-esc" : "border-borda bg-white text-suave"}`}>Vida {v}</button>)}
        </div>
        <div><div className="mb-1.5 text-sm font-bold">Cor da rede</div><div className="flex flex-wrap gap-2">
          {NOMES_COR.map((n) => <button key={n} type="button" onClick={() => setF({ ...f, cor: n })} aria-label={n} className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-bold ${f.cor === n ? "border-texto" : "border-borda"}`}><span className="h-4 w-4 rounded-full border border-borda" style={{ background: CORES[n].hex }} />{n}</button>)}
        </div></div>
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
