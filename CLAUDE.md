# Vida Vitoriosa – Plataforma de Gestão

Site em `index.html` (JS puro), hospedado na Vercel. Banco e login: Supabase (projeto `qlnutqoekuwyndooaedp`).
Migrações em `supabase/migrations/` (já aplicadas, em ordem). Mudanças no banco = nova migração numerada.

## Acesso
- Perfis: admin, coordenacao, financeiro, estoque, decisoes, visitante.
- Equipes (Saúde, Secretaria 1…) ligam pessoas a setores do estoque (`equipes.setores`).
- Convite: admin cadastra a pessoa (e-mail) -> a pessoa cria senha -> "Ativar meu acesso" (`ativar_meu_acesso()`).
- Link público de Decisões: só pelas funções `link_info` e `registrar_decisao` (sem login).

## Regras
- Português claro; interface simples no celular, completa no desktop.
- Nunca colocar chaves secretas no código; só a chave publicável do Supabase.
