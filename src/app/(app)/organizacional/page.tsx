"use client";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { msgErro, useLista } from "@/lib/dados";
import { norm } from "@/lib/tipos";
import { podeEscrever } from "@/lib/perm";
import { useAuth, useAviso } from "@/components/provedores";
import { Botao, Campo, Carregando, Cartao, Icone, Janela, Titulo, Vazio } from "@/components/ui";

type Area = { id: string; nome: string };
type Arq = { id: string; area_id: string; nome: string; caminho: string; tamanho: number; tipo: string | null; criado_em: string };
const BUCKET = "organizacional";
const LIMITE = 50 * 1024 * 1024;
const tam = (b: number) => (b >= 1048576 ? `${(b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const ext = (n: string) => (n.includes(".") ? n.split(".").pop()!.toUpperCase().slice(0, 4) : "ARQ");
const seguro = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);

/** Organizacional = o "drive" do Vida Vitoriosa: uma pasta por área, com manuais, roteiros e demais arquivos. */
export default function Organizacional() {
  const { acesso } = useAuth();
  const aviso = useAviso();
  const areas = useLista<Area>("org_areas", "*", "nome");
  const arqs = useLista<Arq>("org_arquivos", "*", "criado_em");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [nova, setNova] = useState(false);
  const [nome, setNome] = useState("");
  const [renomear, setRenomear] = useState(false);
  const [confirmaArea, setConfirmaArea] = useState(false);
  const [confirmaArq, setConfirmaArq] = useState<string | null>(null);
  const [subindo, setSubindo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const pode = podeEscrever(acesso, "organizacional");

  const lista = areas.dados, arquivos = arqs.dados;
  const area = useMemo(() => lista?.find((a) => a.id === areaId) ?? null, [lista, areaId]);
  if (!lista || !arquivos) return <Carregando />;
  const doArea = (id: string) => arquivos.filter((x) => x.area_id === id);
  const nq = norm(q);

  async function criarArea() {
    const n = nome.trim();
    if (!n) { aviso("Digite o nome da área."); return; }
    const { error } = await supabase.from("org_areas").insert({ nome: n });
    if (error) { aviso(error.code === "23505" ? "Já existe uma área com esse nome." : msgErro(error)); return; }
    setNova(false); setNome(""); areas.recarregar(); aviso("Área criada.");
  }
  async function salvarNome() {
    const n = nome.trim();
    if (!area || !n) return;
    const { error } = await supabase.from("org_areas").update({ nome: n }).eq("id", area.id);
    if (error) { aviso(error.code === "23505" ? "Já existe uma área com esse nome." : msgErro(error)); return; }
    setRenomear(false); areas.recarregar(); aviso("Nome alterado.");
  }
  async function apagarArea() {
    if (!area) return;
    if (!confirmaArea) { setConfirmaArea(true); return; }
    const itens = doArea(area.id);
    if (itens.length) await supabase.storage.from(BUCKET).remove(itens.map((x) => x.caminho));
    const { error } = await supabase.from("org_areas").delete().eq("id", area.id);
    setConfirmaArea(false);
    if (error) { aviso(msgErro(error)); return; }
    setAreaId(null); areas.recarregar(); arqs.recarregar(); aviso("Área apagada com os arquivos.");
  }
  async function subir(fs: File[]) {
    if (!area || fs.length === 0) return;
    setSubindo(true);
    let ok = 0;
    for (const f of fs) {
      if (f.size > LIMITE) { aviso(`“${f.name}” passa de 50 MB e não foi enviado.`); continue; }
      const caminho = `${area.id}/${crypto.randomUUID()}-${seguro(f.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(caminho, f, { contentType: f.type || undefined });
      if (up.error) { aviso(`Não consegui enviar “${f.name}”.`); continue; }
      const { error } = await supabase.from("org_arquivos").insert({ area_id: area.id, nome: f.name, caminho, tamanho: f.size, tipo: f.type || null, criado_por: acesso?.id ?? null });
      if (error) { await supabase.storage.from(BUCKET).remove([caminho]); aviso(msgErro(error)); continue; }
      ok++;
    }
    setSubindo(false);
    if (ok) aviso(ok === 1 ? "Arquivo enviado." : `${ok} arquivos enviados.`);
    arqs.recarregar();
  }
  async function abrir(a: Arq) {
    const w = window.open("", "_blank");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.caminho, 300);
    if (error || !data) { w?.close(); aviso("Não consegui abrir o arquivo."); return; }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  }
  async function apagarArq(a: Arq) {
    if (confirmaArq !== a.id) { setConfirmaArq(a.id); return; }
    await supabase.storage.from(BUCKET).remove([a.caminho]);
    const { error } = await supabase.from("org_arquivos").delete().eq("id", a.id);
    setConfirmaArq(null);
    if (error) aviso(msgErro(error)); else aviso("Arquivo apagado.");
    arqs.recarregar();
  }

  /* ---------- dentro de uma área ---------- */
  if (area) {
    const fs = doArea(area.id).filter((x) => !nq || norm(x.nome).includes(nq)).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    return (
      <div>
        <button type="button" onClick={() => { setAreaId(null); setQ(""); setConfirmaArea(false); }} className="mt-4 min-h-11 font-bold text-marca">← Todas as áreas</button>
        <Titulo direita={pode ? (
          <>
            <input ref={entrada} type="file" multiple hidden onChange={(e) => { subir(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            <Botao onClick={() => entrada.current?.click()} disabled={subindo} className="!min-h-11">{subindo ? "Enviando…" : "Enviar arquivos"}</Botao>
          </>
        ) : undefined}>{area.nome}</Titulo>
        <div className="flex flex-col gap-3 pb-4">
          <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-borda bg-white px-3">
            <Icone n="busca" tam={20} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar arquivo nesta área" aria-label="Buscar arquivo" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          {fs.length === 0 && <Vazio>{doArea(area.id).length === 0 ? (pode ? "Nenhum arquivo ainda. Toque em “Enviar arquivos” para subir manuais, roteiros e outros documentos." : "Nenhum arquivo nesta área ainda.") : "Nada encontrado."}</Vazio>}
          <Cartao className="overflow-hidden">
            {fs.map((a) => (
              <div key={a.id} className="flex min-h-16 items-center gap-3 border-b border-borda px-3 py-2 last:border-b-0">
                <button type="button" onClick={() => abrir(a)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marca-clara text-[11px] font-extrabold text-marca-esc">{ext(a.nome)}</span>
                  <span className="min-w-0"><b className="block truncate text-[15px]">{a.nome}</b><span className="text-xs text-suave">{tam(a.tamanho)} · {new Date(a.criado_em).toLocaleDateString("pt-BR")}</span></span>
                </button>
                <button type="button" onClick={() => abrir(a)} aria-label={`Abrir ${a.nome}`} className="grid h-10 w-10 shrink-0 place-items-center text-suave"><Icone n="baixar" tam={20} /></button>
                {pode && <button type="button" onClick={() => apagarArq(a)} aria-label={`Apagar ${a.nome}`} className={confirmaArq === a.id ? "rounded-xl bg-alerta px-3 py-2 text-sm font-bold text-white" : "grid h-10 w-10 shrink-0 place-items-center text-suave"}>{confirmaArq === a.id ? "Apagar?" : <Icone n="lixo" tam={18} />}</button>}
              </div>
            ))}
          </Cartao>
          {pode && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Botao v="sec" onClick={() => { setNome(area.nome); setRenomear(true); }} className="!min-h-11"><Icone n="lapis" tam={18} />Renomear área</Botao>
              <Botao v="sec" onClick={apagarArea} className={`!min-h-11 ${confirmaArea ? "!border-alerta !bg-alerta !text-white" : "!text-alerta"}`}><Icone n="lixo" tam={18} />{confirmaArea ? `Confirmar: apagar com ${doArea(area.id).length} arquivo(s)` : "Apagar área"}</Botao>
            </div>
          )}
        </div>
        {renomear && (
          <Janela titulo="Renomear área" onFechar={() => setRenomear(false)}>
            <div className="flex flex-col gap-3"><Campo rotulo="Nome da área" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /><Botao onClick={salvarNome} bloco>Salvar</Botao></div>
          </Janela>
        )}
      </div>
    );
  }

  /* ---------- todas as áreas ---------- */
  const achados = nq ? arquivos.filter((x) => norm(x.nome).includes(nq)) : [];
  const visiveis = lista.filter((a) => !nq || norm(a.nome).includes(nq) || achados.some((x) => x.area_id === a.id));
  return (
    <div>
      <Titulo direita={pode ? <Botao onClick={() => { setNome(""); setNova(true); }} className="!min-h-11">Nova área</Botao> : undefined}>Organizacional</Titulo>
      <div className="flex flex-col gap-3 pb-4">
        <p className="m-0 text-sm text-suave">As áreas do Vida Vitoriosa. Cada área é uma pasta com manuais, roteiros e as informações dela. As equipes continuam no menu principal.</p>
        <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-borda bg-white px-3">
          <Icone n="busca" tam={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar área ou arquivo" aria-label="Buscar" className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        {visiveis.length === 0 && <Vazio>{lista.length === 0 ? "Nenhuma área ainda. Toque em “Nova área”." : "Nada encontrado."}</Vazio>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {visiveis.map((a) => {
            const n = doArea(a.id).length, c = nq ? achados.filter((x) => x.area_id === a.id).length : 0;
            return (
              <button key={a.id} type="button" onClick={() => setAreaId(a.id)} className="flex min-h-28 flex-col justify-between rounded-3xl border border-borda bg-white p-4 text-left">
                <span className="text-marca"><Icone n="pasta" tam={30} /></span>
                <span><b className="block leading-tight">{a.nome}</b><span className="text-xs text-suave">{n} {n === 1 ? "arquivo" : "arquivos"}{c > 0 ? ` · ${c} na busca` : ""}</span></span>
              </button>
            );
          })}
        </div>
      </div>
      {nova && (
        <Janela titulo="Nova área" onFechar={() => setNova(false)}>
          <div className="flex flex-col gap-3"><Campo rotulo="Nome da área" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Louvor" autoFocus /><Botao onClick={criarArea} bloco>Criar área</Botao></div>
        </Janela>
      )}
    </div>
  );
}
