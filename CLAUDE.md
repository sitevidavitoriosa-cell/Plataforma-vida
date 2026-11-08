# Vida Vitoriosa – Plataforma de Gestão (versão nova)

Next.js (App Router) + Tailwind + Supabase (projeto `qlnutqoekuwyndooaedp`), hospedado na Vercel.
O site antigo (arquivo único, Firebase) está em `legado/index.html` e serve só de referência de regras e informações.

## Banco
- Migrações em `supabase/migrations/` (já aplicadas, em ordem). Mudança no banco = nova migração numerada.
- Perfis: admin, coordenacao, financeiro, estoque, decisoes, visitante. Equipes ligam pessoas a setores do estoque (`equipes.setores`).
- Regras de acesso (RLS) no próprio banco; o site só esconde o que a pessoa não pode usar.
- Operações de estoque são funções do banco (`definir_envio`, `fechar_balanco`, `definir_estoque`, `copiar_envio`): atômicas e com checagem de permissão.
- Convite: admin cadastra a pessoa -> sistema gera um código -> pessoa abre `/ativar`, digita e-mail + código e cria a senha.
  A Edge Function `ativar` (`supabase/functions/ativar`) cria a conta; não depende de e-mail.
- Link público de Decisões (sem login): só pelas funções `link_info` e `registrar_decisao`.

## Regras
- Português claro; celular em primeiro lugar, completo no computador. Menu de baixo fixo.
- Só a chave publicável do Supabase vai no código (`.env.production`). Nunca chaves secretas.
