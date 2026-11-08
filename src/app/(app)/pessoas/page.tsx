"use client";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import type { Equipe, Item, Pessoa } from "@/lib/tipos";
import { PERFIS, podeVer, type Perfil } from "@/lib/perm";
import { useAuth, useAviso } from "@/components/provedores";
import { Botao, Campo, Carregando, Cartao, Chip, Icone, Janela, Selo, Seletor, Titulo, Vazio, cx } from "@/components/ui";

export default function Pessoas() {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const pessoas = useLista<Pessoa>("pessoas", "*, equipe_membros(equipe_id)", "nome");
  const equipes = useLista<Equipe>("equipes", "*", "nome");
  const itens = useLista<Item>("itens", "setor");
  const [aba, setAba] = useState<"pessoas" | "equipes">("pessoas");
  const [edit, setEdit] = useState<Pessoa | "nova" | null>(null);
  const [eq, setEq] = useState<Equipe | "nova" | null>(null);
  const [convite, setConvite] = useState<{ nome: string; email: string; codigo: string } | null>(null);

  const setores = useMemo(() => Array.from(new Set([...(itens.dados ?? []).map((i) => i.setor), ...(equipes.dados ?? []).flatMap((e) => e.setores)])).sort((a, b) => a.localeCompare(b)), [itens.dados, equipes.dados]);

  if (!podeVer(acesso, "pessoas")) return <Vazio>Só administradores acessam esta área.</Vazio>;
  if (!pessoas.dados || !equipes.dados) return <Carregando />;
  const nomeEq = (id: string) => equipes.dados!.find((e) => e.id === id)?.nome ?? "";

  async function novoCodigo(p: Pessoa) {
    const { data, error } = await supabase.rpc("novo_codigo", { p_pessoa: p.id });
    if (error) { aviso(msgErro(error)); return; }
    pessoas.recarregar(); setConvite({ nome: p.nome, email: p.email, codigo: data as string });
  }

  return (
    <div>
      <Titulo direita={<Botao className="!min-h-11" onClick={() => (aba === "pessoas" ? setEdit("nova") : setEq("nova"))}><Icone n="mais1" tam={18} />{aba === "pessoas" ? "Convidar" : "Nova equipe"}</Botao>}>Pessoas</Titulo>
      <div className="flex gap-2 pb-3">
        <Chip ativo={aba === "pessoas"} onClick={() => setAba("pessoas")}>Pessoas</Chip>
        <Chip ativo={aba === "equipes"} onClick={() => setAba("equipes")}>Equipes</Chip>
      </div>

      {aba === "pessoas" && (
        <div className="flex flex-col gap-2.5">
          {pessoas.dados.length === 0 && <Vazio>Ninguém cadastrado.</Vazio>}
          {pessoas.dados.map((p) => (
            <Cartao key={p.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><b className="text-base">{p.nome}</b><div className="truncate text-sm text-suave">{p.email}</div></div>
                {!p.ativo ? <Selo tom="neutro">Desativado</Selo> : p.user_id ? <Selo tom="ok">Ativo</Selo> : <Selo tom="aviso">Aguardando ativar</Selo>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Selo tom="ok">{PERFIS[p.perfil as Perfil]?.nome ?? p.perfil}</Selo>
                {p.equipe_membros.map((m) => <Selo key={m.equipe_id} tom="neutro">{nomeEq(m.equipe_id)}</Selo>)}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Botao v="sec" className="!min-h-10 !px-3 !text-sm" onClick={() => setEdit(p)}><Icone n="lapis" tam={15} />Editar</Botao>
                <Botao v="sec" className="!min-h-10 !px-3 !text-sm" onClick={() => novoCodigo(p)}><Icone n="chave" tam={15} />{p.user_id ? "Nova senha (código)" : "Ver/gerar código"}</Botao>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      {aba === "equipes" && (
        <div className="flex flex-col gap-2.5">
          <p className="m-0 px-1 text-sm text-suave">Cada equipe cuida do estoque dos seus setores: quem está nela pode registrar e ajustar só esses itens.</p>
          {equipes.dados.map((e) => (
            <Cartao key={e.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between"><b className="text-base">{e.nome}</b>
                <Botao v="sec" className="!min-h-10 !px-3 !text-sm" onClick={() => setEq(e)}><Icone n="lapis" tam={15} />Editar</Botao></div>
              <div className="flex flex-wrap gap-1.5">{e.setores.length ? e.setores.map((s) => <Selo key={s} tom="neutro">{s}</Selo>) : <span className="text-sm text-suave">Sem setores</span>}</div>
              <span className="text-sm text-suave">{pessoas.dados!.filter((p) => p.equipe_membros.some((m) => m.equipe_id === e.id)).length} pessoas</span>
            </Cartao>
          ))}
        </div>
      )}

      {edit && <FormPessoa p={edit === "nova" ? null : edit} equipes={equipes.dados} onFechar={() => setEdit(null)}
        onSalvo={(c) => { pessoas.recarregar(); setEdit(null); if (c) setConvite(c); }} />}
      {eq && <FormEquipe e={eq === "nova" ? null : eq} setores={setores} onFechar={() => setEq(null)} onSalvo={() => { equipes.recarregar(); pessoas.recarregar(); setEq(null); }} />}
      {convite && <Convite c={convite} onFechar={() => setConvite(null)} />}
    </div>
  );
}

function Convite({ c, onFechar }: { c: { nome: string; email: string; codigo: string }; onFechar: () => void }) {
  const aviso = useAviso();
  const url = typeof window !== "undefined" ? window.location.origin + "/ativar" : "";
  const texto = `Olá, ${c.nome.split(" ")[0]}! Seu acesso à plataforma do Vida Vitoriosa está liberado.\n\n1. Abra: ${url}\n2. Digite seu e-mail: ${c.email}\n3. Informe o código: ${c.codigo}\n4. Crie sua senha.\n\nO código vale por 14 dias.`;
  async function copiar() { try { await navigator.clipboard.writeText(texto); aviso("Mensagem copiada. É só colar no WhatsApp."); } catch { aviso("Selecione e copie a mensagem."); } }
  return (
    <Janela titulo="Convite pronto" onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-marca-clara p-4 text-center"><div className="text-xs font-extrabold uppercase text-marca-esc">Código de {c.nome.split(" ")[0]}</div><div className="font-mono text-3xl font-extrabold tracking-widest">{c.codigo}</div></div>
        <pre className="m-0 whitespace-pre-wrap rounded-2xl border border-borda bg-white p-3 font-sans text-sm">{texto}</pre>
        <Botao onClick={copiar} bloco><Icone n="copiar" tam={18} />Copiar mensagem</Botao>
      </div>
    </Janela>
  );
}

function FormPessoa({ p, equipes, onFechar, onSalvo }: { p: Pessoa | null; equipes: Equipe[]; onFechar: () => void; onSalvo: (c?: { nome: string; email: string; codigo: string }) => void }) {
  const aviso = useAviso();
  const [f, setF] = useState({ nome: p?.nome ?? "", email: p?.email ?? "", perfil: (p?.perfil ?? "visitante") as Perfil, ativo: p?.ativo ?? true, telefone: p?.telefone ?? "" });
  const [sel, setSel] = useState<string[]>(p?.equipe_membros.map((m) => m.equipe_id) ?? []);
  const [del, setDel] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const email = f.email.trim().toLowerCase();
    if (!f.nome.trim()) { aviso("Informe o nome."); return; }
    if (!email.includes("@")) { aviso("Informe um e-mail válido."); return; }
    let id = p?.id ?? "";
    let codigo = "";
    if (p) {
      const { error } = await supabase.from("pessoas").update({ nome: f.nome.trim(), perfil: f.perfil, ativo: f.ativo, telefone: f.telefone.trim() || null }).eq("id", p.id);
      if (error) { aviso(msgErro(error)); return; }
    } else {
      const { data, error } = await supabase.from("pessoas").insert({ nome: f.nome.trim(), email, perfil: f.perfil, ativo: true, telefone: f.telefone.trim() || null }).select("id,codigo").single();
      if (error || !data) { aviso(error?.message.includes("pessoas_email_uk") ? "Já existe alguém com esse e-mail." : msgErro(error)); return; }
      id = data.id; codigo = data.codigo ?? "";
    }
    const atuais = p?.equipe_membros.map((m) => m.equipe_id) ?? [];
    const tirar = atuais.filter((x) => !sel.includes(x)), por = sel.filter((x) => !atuais.includes(x));
    if (tirar.length) await supabase.from("equipe_membros").delete().eq("pessoa_id", id).in("equipe_id", tirar);
    if (por.length) await supabase.from("equipe_membros").insert(por.map((equipe_id) => ({ pessoa_id: id, equipe_id })));
    aviso(p ? "Pessoa atualizada." : "Pessoa convidada.");
    onSalvo(!p && codigo ? { nome: f.nome.trim(), email, codigo } : undefined);
  }

  async function remover() {
    if (!p) return;
    const { error } = await supabase.from("pessoas").delete().eq("id", p.id);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Pessoa removida."); onSalvo();
  }

  return (
    <Janela titulo={p ? "Editar pessoa" : "Convidar pessoa"} onFechar={onFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-3.5">
        <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <Campo rotulo="E-mail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} readOnly={!!p} dica={p ? "O e-mail não muda depois do convite." : "Ela vai usar esse e-mail para entrar."} />
        <Campo rotulo="WhatsApp (opcional)" inputMode="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
        <Seletor rotulo="Perfil de acesso" value={f.perfil} onChange={(e) => setF({ ...f, perfil: e.target.value as Perfil })}>
          {(Object.keys(PERFIS) as Perfil[]).map((k) => <option key={k} value={k}>{PERFIS[k].nome} — {PERFIS[k].desc}</option>)}
        </Seletor>
        <div>
          <div className="pb-2 text-[13px] font-bold text-suave">Equipes (cuidam do estoque dos seus setores)</div>
          <div className="flex flex-wrap gap-2">
            {equipes.map((e) => {
              const on = sel.includes(e.id);
              return <button key={e.id} type="button" onClick={() => setSel(on ? sel.filter((x) => x !== e.id) : [...sel, e.id])} className={cx("min-h-11 rounded-full px-4 text-[15px] font-extrabold", on ? "bg-marca text-white" : "border border-borda bg-white text-suave")}>{e.nome}</button>;
            })}
          </div>
        </div>
        {p && (
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-borda bg-white px-4">
            <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} className="h-5 w-5 accent-[#1f6f5c]" />
            <span className="text-[15px] font-bold">Acesso ativo</span>
          </label>
        )}
        <Botao type="submit" bloco>{p ? "Salvar" : "Convidar e gerar código"}</Botao>
        {p && !del && <Botao v="sec" bloco className="!text-alerta" onClick={() => setDel(true)}><Icone n="lixo" tam={18} />Remover pessoa</Botao>}
        {p && del && <Botao v="perigo" bloco onClick={remover}>Confirmar: remover {p.nome}</Botao>}
      </form>
    </Janela>
  );
}

function FormEquipe({ e, setores, onFechar, onSalvo }: { e: Equipe | null; setores: string[]; onFechar: () => void; onSalvo: () => void }) {
  const aviso = useAviso();
  const [nome, setNome] = useState(e?.nome ?? "");
  const [sel, setSel] = useState<string[]>(e?.setores ?? []);
  const [del, setDel] = useState(false);
  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nome.trim()) { aviso("Dê um nome para a equipe."); return; }
    const d = { nome: nome.trim(), setores: sel };
    const r = e ? await supabase.from("equipes").update(d).eq("id", e.id) : await supabase.from("equipes").insert(d);
    if (r.error) { aviso(r.error.message.includes("equipes_nome_key") ? "Já existe uma equipe com esse nome." : msgErro(r.error)); return; }
    aviso("Equipe salva."); onSalvo();
  }
  async function excluir() {
    if (!e) return;
    const { error } = await supabase.from("equipes").delete().eq("id", e.id);
    if (error) { aviso(msgErro(error)); return; }
    aviso("Equipe excluída."); onSalvo();
  }
  return (
    <Janela titulo={e ? "Editar equipe" : "Nova equipe"} onFechar={onFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-3.5">
        <Campo rotulo="Nome da equipe" value={nome} onChange={(x) => setNome(x.target.value)} placeholder="Ex.: Saúde" />
        <div>
          <div className="pb-2 text-[13px] font-bold text-suave">Setores do estoque que a equipe cuida</div>
          <div className="flex flex-wrap gap-2">
            {setores.map((s) => { const on = sel.includes(s); return <button key={s} type="button" onClick={() => setSel(on ? sel.filter((x) => x !== s) : [...sel, s])} className={cx("min-h-11 rounded-full px-4 text-[15px] font-extrabold", on ? "bg-marca text-white" : "border border-borda bg-white text-suave")}>{s}</button>; })}
          </div>
        </div>
        <Botao type="submit" bloco>Salvar</Botao>
        {e && !del && <Botao v="sec" bloco className="!text-alerta" onClick={() => setDel(true)}><Icone n="lixo" tam={18} />Excluir equipe</Botao>}
        {e && del && <Botao v="perigo" bloco onClick={excluir}>Confirmar: excluir {e.nome}</Botao>}
      </form>
    </Janela>
  );
}
