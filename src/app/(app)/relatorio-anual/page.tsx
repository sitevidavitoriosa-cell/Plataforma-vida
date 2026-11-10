"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TODAS, useEdicao } from "@/components/provedores";
import { Carregando } from "@/components/ui";

/** O relatório anual agora fica em "Todas as edições" (Relatório). Este endereço antigo só leva para lá. */
export default function RelatorioAnualAntigo() {
  const { trocar, podeTodas } = useEdicao();
  const router = useRouter();
  useEffect(() => { if (podeTodas) trocar(TODAS); router.replace("/relatorio"); }, [podeTodas, trocar, router]);
  return <Carregando />;
}
