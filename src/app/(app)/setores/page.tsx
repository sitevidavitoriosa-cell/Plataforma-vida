"use client";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { entradasSetores } from "@/lib/setores";
import { useAuth } from "@/components/provedores";
import { Saude } from "@/components/saude";
import { Secretaria } from "@/components/secretaria";
import { Titulo, Vazio } from "@/components/ui";

export default function Setores() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}

function Conteudo() {
  const { acesso } = useAuth();
  const params = useSearchParams();
  const abas = useMemo(() => entradasSetores(acesso), [acesso]);
  const pedido = params.get("aba");
  const atual = abas.find((a) => a.id === pedido) ?? abas[0];

  if (!atual) return <Vazio>Você ainda não está em nenhuma equipe.</Vazio>;
  return (
    <div>
      <Titulo>{atual.nome}</Titulo>
      {atual.id === "saude" && <Saude />}
      {atual.id === "secretaria" && <Secretaria />}
    </div>
  );
}
