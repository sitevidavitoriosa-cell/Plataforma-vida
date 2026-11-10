"use client";
import { useAuth, useEdicao } from "@/components/provedores";
import { Estoque } from "@/components/estoque";
import { Titulo, Vazio } from "@/components/ui";
import { podeVerEstoque } from "@/lib/perm";

/** Estoque: “Todas as edições” = lista mãe; dentro de uma edição = retirada e balanço.  dedicado a quem guarda e administra o material (paiol). As equipes só veem o que receberam, em Equipes. */
export default function PaginaEstoque() {
  const { acesso } = useAuth();
  const { ed, todas } = useEdicao();
  if (!podeVerEstoque(acesso)) return <Vazio>O estoque geral é só para quem administra o material. Seu material está em Equipes.</Vazio>;
  return (<div><Titulo>{todas ? "Estoque · lista mãe" : `Estoque · ${ed?.nome ?? ""}`}</Titulo><Estoque /></div>);
}
