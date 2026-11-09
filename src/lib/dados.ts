"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

/** Lê uma tabela e se atualiza sozinha quando alguém mexe nela (tempo real). */
export function useLista<T>(tabela: string, select = "*", ordem?: string) {
  const [dados, setDados] = useState<T[] | null>(null);
  const [erro, setErro] = useState("");
  const idRef = useRef(Math.random().toString(36).slice(2));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recarregar = useCallback(async () => {
    let q = supabase.from(tabela).select(select);
    if (ordem) q = q.order(ordem);
    const { data, error } = await q;
    if (error) setErro(error.message);
    else { setDados(data as unknown as T[]); setErro(""); }
  }, [tabela, select, ordem]);

  useEffect(() => {
    recarregar();
    const ch = supabase
      .channel(`rt-${tabela}-${idRef.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table: tabela }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(recarregar, 250);
      })
      .subscribe();
    const foco = () => recarregar();
    window.addEventListener("focus", foco);
    return () => { supabase.removeChannel(ch); window.removeEventListener("focus", foco); if (timer.current) clearTimeout(timer.current); };
  }, [recarregar, tabela]);

  return { dados, setDados, erro, recarregar };
}

const MSG: Record<string, string> = {
  sem_permissao: "Você não tem permissão para isso.",
  sem_estoque: "Não há essa quantidade no estoque.",
  balanco_fechado: "O balanço deste item já foi fechado.",
  balanco_informado: "O setor já entregou o balanço deste item. Devolva ao setor antes de mudar o envio.",
  acima_do_enviado: "Não pode ser mais do que foi levado.",
  ja_enviado: "Este balanço já foi enviado ao paiol.",
  ja_conferido: "O paiol já conferiu este item.",
  sem_envio: "Este item não foi enviado para a edição.",
  item_inexistente: "Item não encontrado.",
  quantidade_invalida: "Quantidade inválida.",
};
export function msgErro(e: { message?: string } | null | undefined): string {
  const m = e?.message || "";
  for (const k of Object.keys(MSG)) if (m.includes(k)) return MSG[k];
  if (m.includes("duplicate key")) return "Já existe um registro igual.";
  if (m.includes("row-level security")) return "Você não tem permissão para isso.";
  return "Não foi possível concluir. Confira a conexão e tente de novo.";
}
