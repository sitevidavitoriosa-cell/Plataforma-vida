"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { assinar, baixarArquivo, buscarBlob, CSS_IMPRESSAO, dataBr, htmlDe, imprimirHtml, podeImprimir, ROTULO_TIPO, tam, tipoDe, type ArqPrev } from "@/lib/drive";
import { Icone } from "@/components/ui";

type Conteudo = { tipo: "url"; url: string } | { tipo: "pdf"; url: string } | { tipo: "html"; html: string } | { tipo: "erro"; msg: string } | { tipo: "semprevia" };

/** Janela de pré-visualização (imagem, PDF, vídeo, áudio, texto, Word, planilha), com baixar, imprimir e passar para o próximo. */
export function Previa({ arquivo, lista, onTrocar, onFechar, extra }: {
  arquivo: ArqPrev; lista?: ArqPrev[]; onTrocar?: (a: ArqPrev) => void; onFechar: () => void; extra?: React.ReactNode;
}) {
  const t = tipoDe(arquivo);
  const [c, setC] = useState<Conteudo | null>(null);
  const [msg, setMsg] = useState("");
  const pdfRef = useRef<HTMLIFrameElement>(null);
  const blobUrl = useRef<string | null>(null);
  const idx = lista ? lista.findIndex((x) => x.id === arquivo.id) : -1;
  const ant = lista && idx > 0 ? lista[idx - 1] : null;
  const prox = lista && idx >= 0 && idx < lista.length - 1 ? lista[idx + 1] : null;

  useEffect(() => {
    let vivo = true;
    setC(null); setMsg("");
    (async () => {
      try {
        if (t === "imagem" || t === "video" || t === "audio") { const u = await assinar(arquivo.caminho); if (vivo) setC(u ? { tipo: "url", url: u } : { tipo: "erro", msg: "Não consegui abrir o arquivo." }); return; }
        if (t === "slides" || t === "zip" || t === "outro") { if (vivo) setC({ tipo: "semprevia" }); return; }
        const b = await buscarBlob(arquivo.caminho);
        if (!vivo) return;
        if (!b) { setC({ tipo: "erro", msg: "Não consegui abrir o arquivo." }); return; }
        if (t === "pdf") { blobUrl.current = URL.createObjectURL(new Blob([b], { type: "application/pdf" })); setC({ tipo: "pdf", url: blobUrl.current }); return; }
        const html = await htmlDe(arquivo, b);
        if (vivo) setC({ tipo: "html", html });
      } catch { if (vivo) setC({ tipo: "erro", msg: "Não consegui mostrar este arquivo. Baixe para abrir." }); }
    })();
    return () => { vivo = false; if (blobUrl.current) { URL.revokeObjectURL(blobUrl.current); blobUrl.current = null; } };
  }, [arquivo, t]);

  useEffect(() => {
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowRight" && prox && onTrocar) onTrocar(prox);
      if (e.key === "ArrowLeft" && ant && onTrocar) onTrocar(ant);
    };
    document.addEventListener("keydown", k);
    return () => { document.body.style.overflow = o; document.removeEventListener("keydown", k); };
  }, [onFechar, onTrocar, prox, ant]);

  const baixar = useCallback(async () => { setMsg(""); if (!(await baixarArquivo(arquivo))) setMsg("Não consegui baixar agora."); }, [arquivo]);
  async function imprimir() {
    setMsg("");
    if (t === "pdf") { pdfRef.current?.contentWindow?.focus(); pdfRef.current?.contentWindow?.print(); return; }
    if (t === "imagem") {
      const b = await buscarBlob(arquivo.caminho);
      if (!b) { setMsg("Não consegui preparar a impressão."); return; }
      const u = URL.createObjectURL(b);
      imprimirHtml(`<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:10mm}body{margin:0;text-align:center}img{max-width:100%;max-height:100vh}</style></head><body><img src="${u}"></body></html>`);
      setTimeout(() => URL.revokeObjectURL(u), 120000);
      return;
    }
    if (c?.tipo === "html") imprimirHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${arquivo.nome.replace(/</g, "")}</title><style>${CSS_IMPRESSAO}</style></head><body>${c.html}</body></html>`);
  }
  const pode = podeImprimir(t) && (t === "imagem" || c?.tipo === "pdf" || c?.tipo === "html");

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/80" role="dialog" aria-modal="true" aria-label={`Pré-visualização de ${arquivo.nome}`}>
      <div className="flex flex-wrap items-center gap-2 bg-[#111827] px-3 py-2 text-white">
        <button type="button" onClick={onFechar} aria-label="Fechar" className="mr-auto grid h-11 w-11 place-items-center rounded-full text-2xl font-bold hover:bg-white/10 sm:mr-0">×</button>
        <div className="order-last min-w-0 basis-full leading-tight sm:order-none sm:basis-0 sm:flex-1">
          <b className="block truncate text-[15px]">{arquivo.nome}</b>
          <span className="text-xs text-white/70">{ROTULO_TIPO[t]} · {tam(arquivo.tamanho)} · {dataBr(arquivo.criado_em)}{lista && idx >= 0 && lista.length > 1 ? ` · ${idx + 1} de ${lista.length}` : ""}</span>
        </div>
        {onTrocar && ant && <button type="button" onClick={() => onTrocar(ant)} aria-label="Arquivo anterior" className="h-11 w-11 rounded-full text-xl font-bold hover:bg-white/10">‹</button>}
        {onTrocar && prox && <button type="button" onClick={() => onTrocar(prox)} aria-label="Próximo arquivo" className="h-11 w-11 rounded-full text-xl font-bold hover:bg-white/10">›</button>}
        {extra}
        {pode && <button type="button" onClick={imprimir} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold hover:bg-white/10"><Icone n="imprimir" tam={20} />Imprimir</button>}
        <button type="button" onClick={baixar} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-extrabold text-[#111827]"><Icone n="baixar" tam={20} />Baixar</button>
      </div>
      {msg && <div className="bg-alerta px-4 py-1.5 text-center text-sm font-bold text-white">{msg}</div>}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
        {!c && <p className="m-0 text-white">Abrindo…</p>}
        {c?.tipo === "erro" && <p className="m-0 rounded-2xl bg-white p-5 font-bold">{c.msg}</p>}
        {c?.tipo === "semprevia" && (
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center">
            <span className="text-marca"><Icone n="arquivo" tam={44} /></span>
            <b>Este tipo de arquivo não tem pré-visualização aqui.</b>
            <span className="text-sm text-suave">Toque em Baixar para abrir no seu aparelho.</span>
          </div>
        )}
        {c?.tipo === "url" && t === "imagem" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.url} alt={arquivo.nome} className="max-h-full max-w-full rounded-lg bg-white object-contain" />}
        {c?.tipo === "url" && t === "video" && <video src={c.url} controls playsInline className="max-h-full max-w-full rounded-lg bg-black" />}
        {c?.tipo === "url" && t === "audio" && <audio src={c.url} controls className="w-full max-w-xl" />}
        {c?.tipo === "pdf" && <iframe ref={pdfRef} src={c.url} title={arquivo.nome} className="h-full w-full max-w-5xl rounded-lg bg-white" />}
        {c?.tipo === "html" && <iframe sandbox="" title={arquivo.nome} className="h-full w-full max-w-5xl rounded-lg bg-white" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>${CSS_IMPRESSAO}body{margin:16px}</style></head><body>${c.html}</body></html>`} />}
      </div>
    </div>
  );
}
