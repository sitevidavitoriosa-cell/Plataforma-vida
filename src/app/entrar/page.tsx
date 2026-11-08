"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth, useAviso } from "@/components/provedores";
import { Botao, Campo } from "@/components/ui";

export default function Entrar() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [envio, setEnvio] = useState(false);
  const { sessao, carregando } = useAuth();
  const aviso = useAviso();
  const router = useRouter();

  useEffect(() => { if (!carregando && sessao) router.replace("/"); }, [carregando, sessao, router]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@") || !senha) { aviso("Informe o e-mail e a senha."); return; }
    setEnvio(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    setEnvio(false);
    if (error) aviso(error.message.includes("Invalid login") ? "E-mail ou senha incorretos." : "Não foi possível entrar. Tente de novo.");
    else router.replace("/");
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <section className="hidden bg-marca p-12 text-white md:flex md:flex-col md:justify-end">
        <div className="mb-6 grid h-16 w-16 place-items-center rounded-3xl bg-white/15 text-3xl font-extrabold">V</div>
        <h2 className="m-0 max-w-sm text-4xl font-extrabold leading-tight">Vida Vitoriosa</h2>
        <p className="mt-2 max-w-sm text-lg text-white/80">Estoque, edições, financeiro e decisões num só lugar.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={entrar} className="flex w-full max-w-sm flex-col gap-4">
          <div className="mb-2 flex items-center gap-3 md:hidden">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-marca text-2xl font-extrabold text-white">V</div>
            <b className="text-lg">Vida Vitoriosa</b>
          </div>
          <div>
            <h1 className="m-0 text-[30px] font-extrabold">Entrar</h1>
            <p className="mb-0 mt-1.5 text-suave">Equipe e coordenação entram pelo mesmo lugar.</p>
          </div>
          <Campo rotulo="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
          <Campo rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Botao type="submit" bloco disabled={envio}>{envio ? "Entrando…" : "Entrar"}</Botao>
          <div className="flex justify-between text-[15px] font-bold">
            <Link href="/ativar" className="text-marca">Ativar meu acesso</Link>
            <Link href="/ativar" className="text-suave">Esqueci a senha</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
