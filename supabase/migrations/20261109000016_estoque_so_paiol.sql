-- Estoque geral: só administrador e perfil Estoque (e o admin de edição, nas edições dele, para enviar/conferir material).
-- Coordenação, financeiro, decisões e visitante não acessam o estoque; servo de equipe vê só o material do próprio setor.
create or replace function public.pode_setor(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin','estoque'])
  or exists (
    select 1 from public.pessoas p
    join public.equipe_membros m on m.pessoa_id = p.id
    join public.equipes e on e.id = m.equipe_id
    where p.user_id = (select auth.uid()) and p.ativo and s = any(e.setores))
$$;

create or replace function public.eh_paiol(p_edicao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin','estoque'])
      or (public.eh_admin_edicao() and public.pode_edicao(p_edicao))
$$;

create or replace function public.ve_todo_estoque() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin','estoque','admin_edicao'])
$$;
