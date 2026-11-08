// Edge Function "ativar": cria/atualiza a conta de quem foi convidado, validando e-mail + código de convite.
// (Já publicada no Supabase; este arquivo é a cópia do repositório.)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return resp({ erro: 'metodo' }, 405);

  let b: { email?: string; codigo?: string; senha?: string };
  try { b = await req.json(); } catch { return resp({ erro: 'pedido_invalido' }, 400); }
  const email = String(b.email ?? '').trim().toLowerCase();
  const codigo = String(b.codigo ?? '').trim().toUpperCase();
  const senha = String(b.senha ?? '');
  if (!email.includes('@') || !codigo) return resp({ erro: 'dados_incompletos' }, 400);
  if (senha.length < 6) return resp({ erro: 'senha_curta' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: p } = await admin.from('pessoas').select('*').ilike('email', email).eq('ativo', true).maybeSingle();
  if (!p || !p.codigo) return resp({ erro: 'codigo_invalido' }, 400);
  if (p.tentativas >= 5) return resp({ erro: 'bloqueado' }, 429);
  if (p.codigo !== codigo) {
    await admin.from('pessoas').update({ tentativas: p.tentativas + 1 }).eq('id', p.id);
    return resp({ erro: 'codigo_invalido' }, 400);
  }
  if (p.codigo_expira && new Date(p.codigo_expira) < new Date()) return resp({ erro: 'codigo_vencido' }, 400);

  let uid: string | null = p.user_id;
  if (uid) {
    const { error } = await admin.auth.admin.updateUserById(uid, { password: senha, email_confirm: true });
    if (error) return resp({ erro: 'falha_conta' }, 500);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error || !data?.user) {
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const u = lista?.users?.find((x) => (x.email ?? '').toLowerCase() === email);
      if (!u) return resp({ erro: 'falha_conta' }, 500);
      const r = await admin.auth.admin.updateUserById(u.id, { password: senha, email_confirm: true });
      if (r.error) return resp({ erro: 'falha_conta' }, 500);
      uid = u.id;
    } else {
      uid = data.user.id;
    }
  }

  const { error: e2 } = await admin.from('pessoas').update({ user_id: uid, codigo: null, codigo_expira: null, tentativas: 0 }).eq('id', p.id);
  if (e2) return resp({ erro: 'falha_vinculo' }, 500);
  return resp({ ok: true, nome: p.nome });
});
