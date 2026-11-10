"use client";
import { useEffect } from "react";

const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");

export function Icone({ n, tam = 22 }: { n: string; tam?: number }) {
  const P: Record<string, React.ReactNode> = {
    inicio: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
    estoque: <path d="M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8" />,
    edicoes: <path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4" />,
    financeiro: <path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-3v3" />,
    decisoes: <path d="M5 12l5 5 9-10" />,
    pessoas: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.7.7 2.8 2.4 3 5.2" /></>,
    mais: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
    busca: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    mais1: <path d="M12 5v14M5 12h14" />,
    sair: <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />,
    seta: <path d="M6 9l6 6 6-6" />,
    copiar: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
    lapis: <path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />,
    lixo: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
    chave: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>,
    pasta: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    arquivo: <path d="M6 3h8l5 5v13H6zM14 3v5h5" />,
    baixar: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
    imprimir: <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z" />,
    compartilhar: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
    mover: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 14h7M13 11l3 3-3 3" />,
    globo: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
    cadeado: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    mais_v: <><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></>,
    grade: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
    lista: <path d="M4 6h16M4 12h16M4 18h16" />,
    mais_grande: <path d="M12 5v14M5 12h14" />,
    relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
    copia: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></>,
    subir: <path d="M12 20V9M7 13l5-5 5 5M5 4h14" />,
    nova_pasta: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v6M9 14h6" />,
    pasta_up: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 17v-6M9.5 13.5L12 11l2.5 2.5" />,
    restaurar: <path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" />,
    estrela: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
    alerta: <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />,
  };
  return (
    <svg aria-hidden="true" width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {P[n] ?? null}
    </svg>
  );
}

type BotaoProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { v?: "primario" | "sec" | "perigo" | "suave"; bloco?: boolean };
export function Botao({ v = "primario", bloco, className, ...r }: BotaoProps) {
  const base = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-extrabold transition active:scale-[.98] disabled:opacity-50";
  const cor = { primario: "bg-marca text-white", sec: "border border-borda bg-white text-texto", perigo: "bg-alerta text-white", suave: "bg-marca-clara text-marca-esc" }[v];
  return <button type="button" {...r} className={cx(base, cor, bloco && "w-full", className)} />;
}

export function Cartao({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl border border-borda bg-cartao", className)}>{children}</div>;
}

export function Chip({ ativo, children, ...r }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return (
    <button type="button" {...r} className={cx("inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[15px] font-extrabold", ativo ? "bg-marca text-white" : "border border-borda bg-white text-suave")}>
      {children}
    </button>
  );
}

export function Selo({ tom = "neutro", children }: { tom?: "ok" | "alerta" | "aviso" | "neutro"; children: React.ReactNode }) {
  const c = { ok: "bg-marca-clara text-marca-esc", alerta: "bg-alerta-clara text-[#8e2e18]", aviso: "bg-aviso-clara text-aviso", neutro: "bg-[#ecebe6] text-suave" }[tom];
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold", c)}>{children}</span>;
}

export function Campo({ rotulo, dica, className, ...r }: React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-suave">{rotulo}</span>
      <input {...r} className={cx("min-h-12 rounded-2xl border border-borda bg-white px-4 text-texto outline-none focus:border-marca", className)} />
      {dica && <span className="text-xs text-suave">{dica}</span>}
    </label>
  );
}

export function Seletor({ rotulo, children, ...r }: React.SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-suave">{rotulo}</span>
      <select {...r} className="min-h-12 rounded-2xl border border-borda bg-white px-3 text-texto outline-none focus:border-marca">{children}</select>
    </label>
  );
}

export function Janela({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", k);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = o; };
  }, [onFechar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-fundo sm:rounded-[28px]">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="m-0 text-xl font-extrabold">{titulo}</h2>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="h-11 w-11 rounded-full border border-borda bg-white text-xl font-bold text-suave">×</button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>{children}</div>
      </div>
    </div>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-[15px] text-suave">{children}</div>;
}

export function Carregando() {
  return <div className="px-4 py-12 text-center text-[15px] text-suave">Carregando…</div>;
}

export function Titulo({ children, direita }: { children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3 pt-5">
      <h1 className="m-0 text-[28px] font-extrabold leading-tight">{children}</h1>
      {direita}
    </div>
  );
}

/** Campo numérico com − e + e digitação. */
export function Passo({ valor, onMudar, desativado, grande }: { valor: number; onMudar: (v: number) => void; desativado?: boolean; grande?: boolean }) {
  const b = grande ? "h-14 w-14 text-[28px] rounded-2xl" : "h-11 w-11 text-[22px] rounded-xl";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="Diminuir" disabled={desativado} onClick={() => onMudar(Math.max(0, valor - 1))} className={cx(b, "border border-borda bg-fundo font-bold text-texto", valor <= 0 && "opacity-40")}>−</button>
      <input
        key={valor}
        aria-label="Quantidade"
        inputMode="decimal"
        disabled={desativado}
        defaultValue={String(valor).replace(".", ",")}
        onBlur={(e) => {
          const t = e.target.value.trim().replace(",", ".");
          const v = t === "" ? 0 : Number(t);
          if (!isFinite(v) || v < 0) { e.target.value = String(valor); return; }
          if (v !== valor) onMudar(v);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cx("rounded-xl border border-transparent bg-transparent text-center font-extrabold outline-none focus:border-marca", grande ? "w-16 text-[30px]" : "w-12 text-xl")}
      />
      <button type="button" aria-label="Aumentar" disabled={desativado} onClick={() => onMudar(valor + 1)} className={cx(b, "bg-marca font-bold text-white")}>+</button>
    </div>
  );
}
export { cx };
