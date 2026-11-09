"use client";
import { useAuth } from "@/components/provedores";
import { Estoque } from "@/components/estoque";
import { Titulo, Vazio } from "@/components/ui";
import { podeVerEstoque } from "@/lib/perm";

/** Estoque geral: dedicado a quem guarda e administra o material (paiol). As equipes só veem o que receberam, em Equipes. */
export default function PaginaEstoque() {
  const { acesso } = useAuth();
  if (!podeVerEstoque(acesso)) return <Vazio>O estoque geral é só para quem administra o material. Seu material está em Equipes.</Vazio>;
  return (<div><Titulo>Estoque</Titulo><Estoque /></div>);
}
