"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, SUPABASE_URL, CHAVE_PUBLICA } from "@/lib/supabase";
import { useAviso } from "@/components/provedores";
import { Botao, Campo } from "@/components/ui";

const ERROS: Record<string, string> = {
  codigo_invalido: "Código incorreto. Confira com quem te convidou.",
  codigo_vencido: "Esse código venceu. Peça um novo ao administrador.",
  bloqueado: "Muitas tentativas. Peça um novo código ao administrador.",
  senha_curta: "Escolha uma senha com pelo menos 6 caracteres.",
};

export default function Ativar() {
  const [passo, setPasso] = useState<"email" | "dados" | "nao">("email");
  const [email, setEmail] = useState("");
  const [quem, setQuem] = useState<{ nome: string; ativado: boolean } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [envio, setEnvio] = useState(false);
  const aviso = useAviso();
  const router = useRouter();

  async function procurar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { aviso("Informe um e-mail válido."); return; }
    setEnvio(true);
    const { data, error } = await supabase.rpc("quem_e", { p_email: email });
    setEnvio(false);
    if (error) { aviso("Não foi possível verificar. Confira a conexão."); return; }
    if (!data) { setPasso("nao"); return; }
    setQuem(data as typeof quem); setPasso("dados");
  }

  async function ativar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) { aviso("Digite o código que você recebeu."); return; }
    if (senha.length < 6) { aviso(ERROS.senha_curta); return; }
    if (senha !== senha2) { aviso("As duas senhas não são iguais."); return; }
    setEnvio(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/ativar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: CHAVE_PUBLICA },
        body: JSON.stringify({ email, codigo, senha }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { aviso(ERROS[j.erro] || "Não foi possível ativar. Tente de novo."); setEnvio(false); return; }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
      setEnvio(false);
      if (error) { aviso("Acesso ativado. Agora entre com a sua senha."); router.replace("/entrar"); return; }
      router.replace("/");
    } catch {
      setEnvio(false); aviso("Sem conexão. Tente de novo.");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-marca text-2xl font-extrabold text-white">V</div>
          <b className="text-lg">Vida Vitoriosa</b>
        </div>

        {passo === "email" && (
          <form onSubmit={procurar} className="flex flex-col gap-4">
            <div>
              <h1 className="m-0 text-[28px] font-extrabold">Ativar meu acesso</h1>
              <p className="mb-0 mt-1.5 text-suave">Digite o e-mail que o administrador cadastrou para você. Serve também para criar uma nova senha.</p>
            </div>
            <Campo rotulo="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
            <Botao type="submit" bloco disabled={envio}>{envio ? "Procurando…" : "Continuar"}</Botao>
            <Link href="/entrar" className="text-center text-[15px] font-bold text-suave">Voltar para entrar</Link>
          </form>
        )}

        {passo === "nao" && (
          <div className="flex flex-col gap-4">
            <h1 className="m-0 text-[28px] font-extrabold">Não encontramos esse e-mail</h1>
            <p className="m-0 text-suave">Só entra quem foi convidado. Peça a um administrador para cadastrar <b>{email}</b>, e ele vai te enviar um código.</p>
            <Botao v="sec" bloco onClick={() => setPasso("email")}>Tentar outro e-mail</Botao>
            <Link href="/entrar" className="text-center text-[15px] font-bold text-suave">Voltar para entrar</Link>
          </div>
        )}

        {passo === "dados" && quem && (
          <form onSubmit={ativar} className="flex flex-col gap-4">
            <div className="rounded-2xl bg-marca-clara p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-marca-esc">Encontramos você</div>
              <div className="text-lg font-extrabold">{quem.nome}</div>
            </div>
            <Campo rotulo="Código do convite" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} autoComplete="one-time-code" autoCapitalize="characters" placeholder="Ex.: 9F3A1C7B" dica="O administrador te envia esse código (por WhatsApp, por exemplo)." />
            <Campo rotulo="Nova senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} dica="Pelo menos 6 caracteres." />
            <Campo rotulo="Repita a senha" type="password" autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} />
            <Botao type="submit" bloco disabled={envio}>{envio ? "Ativando…" : "Ativar e entrar"}</Botao>
            <button type="button" onClick={() => setPasso("email")} className="text-center text-[15px] font-bold text-suave">Usar outro e-mail</button>
          </form>
        )}
      </div>
    </div>
  );
}
