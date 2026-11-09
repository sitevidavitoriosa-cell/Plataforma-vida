-- Quem está numa equipe com setor (servo de setor) vê só o material do próprio setor, mesmo sendo "visitante".
create or replace function public.na_equipe_de_setor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pessoas p
    join public.equipe_membros m on m.pessoa_id = p.id
    join public.equipes e on e.id = m.equipe_id
    where p.user_id = (select auth.uid()) and p.ativo and cardinality(e.setores) > 0)
$$;
grant execute on function public.na_equipe_de_setor() to authenticated;

create or replace function public.ve_todo_estoque() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin','coordenacao','estoque','financeiro','decisoes','admin_edicao'])
      or (public.tem_perfil(array['visitante']) and not public.na_equipe_de_setor())
$$;
grant execute on function public.ve_todo_estoque() to authenticated;

drop policy itens_sel on public.itens;
create policy itens_sel on public.itens for select to authenticated
  using (public.ativa() and (public.ve_todo_estoque() or public.pode_setor(setor)));
drop policy env_sel on public.envios;
create policy env_sel on public.envios for select to authenticated
  using (public.ativa() and (not public.eh_admin_edicao() or public.pode_edicao(edicao_id))
    and (public.ve_todo_estoque() or public.pode_setor((select i.setor from public.itens i where i.id = envios.item_id))));
