"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { entradasSetores, hrefSetor } from "@/lib/setores";
import Link from "next/link";
import { useAuth } from "@/components/provedores";
import { Estoque } from "@/components/estoque";
import { Saude } from "@/components/saude";
import { Secretaria } from "@/components/secretaria";
import { Titulo, Vazio } from "@/components/ui";

export default function Setores() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}

function Conteudo() {
  const { acesso } = useAuth();
  const params = useSearchParams();
  const [setoresItens, setSetoresItens] = useState<string[]>([]);
  useEffect(() => { supabase.from("itens").select("setor").then(({ data }) => setSetoresItens(Array.from(new Set(((data as { setor: string }[] | null) ?? []).map((x) => x.setor))))); }, []);
  const abas = useMemo(() => entradasSetores(acesso, setoresItens), [acesso, setoresItens]);
  const pedido = params.get("aba");
  const atual = abas.find((a) => a.id === pedido) ?? abas[0];

  if (!atual) return <Vazio>Você ainda não está em nenhuma equipe.</Vazio>;
  return (
    <div>
      <Titulo>{atual.nome}</Titulo>
      <div className="flex gap-2 overflow-x-auto pb-3">
        {abas.map((a) => <Link key={a.id} href={hrefSetor(a.id)} replace className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[15px] font-extrabold ${atual.id === a.id ? "bg-marca text-white" : "border border-borda bg-white text-suave"}`}>{a.nome}</Link>)}
      </div>
      {atual.id === "saude" && <Saude />}
      {atual.id === "secretaria" && <Secretaria />}
      {atual.id.startsWith("setor:") && <Estoque key={atual.id} setor={atual.id.slice(6)} />}
    </div>
  );
}
