"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/provedores";
import { Estoque } from "@/components/estoque";
import { Saude } from "@/components/saude";
import { Secretaria } from "@/components/secretaria";
import { Chip, Titulo, Vazio } from "@/components/ui";
import { podeSecretaria, podeVerEstoque, podeVerSaude, setoresDaEquipe } from "@/lib/perm";

export default function Setores() {
  const { acesso } = useAuth();
  const abas = useMemo(() => {
    const l: { id: string; nome: string }[] = [];
    if (podeVerEstoque(acesso)) l.push({ id: "estoque", nome: "Estoque" });
    if (podeVerSaude(acesso)) l.push({ id: "saude", nome: "Saúde" });
    if (podeSecretaria(acesso)) l.push({ id: "secretaria", nome: "Secretaria 1" });
    const especiais = ["Secretaria 1", "Saúde"];
    Array.from(new Set(setoresDaEquipe(acesso))).filter((s) => !especiais.includes(s)).forEach((s) => l.push({ id: "setor:" + s, nome: s }));
    return l;
  }, [acesso]);
  const [aba, setAba] = useState("");
  useEffect(() => { try { setAba(localStorage.getItem("vv-aba-setor") ?? ""); } catch {} }, []);
  const atual = abas.find((a) => a.id === aba) ?? abas[0];
  const escolher = (id: string) => { setAba(id); try { localStorage.setItem("vv-aba-setor", id); } catch {} };

  if (!atual) return <Vazio>Você ainda não está em nenhum setor.</Vazio>;
  return (
    <div>
      <Titulo>Setores</Titulo>
      <div className="flex gap-2 overflow-x-auto pb-3">
        {abas.map((a) => <Chip key={a.id} ativo={atual.id === a.id} onClick={() => escolher(a.id)}>{a.nome}</Chip>)}
      </div>
      {atual.id === "estoque" && <Estoque />}
      {atual.id === "saude" && <Saude />}
      {atual.id === "secretaria" && <Secretaria />}
      {atual.id.startsWith("setor:") && <Estoque key={atual.id} setor={atual.id.slice(6)} />}
    </div>
  );
}
