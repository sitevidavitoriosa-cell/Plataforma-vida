-- Três categorias de acesso: Administrador, Coordenador (admin_edicao, só as edições ligadas a ele) e Servo (áreas marcadas em pessoas.permissoes).
alter table public.pessoas drop constraint if exists pessoas_perfil_check;
alter table public.pessoas add constraint pessoas_perfil_check check (perfil in
  ('admin','coordenacao','financeiro','estoque','decisoes','saude','visitante','admin_edicao','secretaria1','servo'));

-- Perfis "equivalentes" de um servo, conforme as áreas marcadas (ver ou mexer). Na RLS não há distinção entre ver e mexer: o site faz essa trava fina.
create or replace function public.servo_perfis(p jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select case m
      when 'estoque' then 'estoque' when 'saude' then 'saude' when 'secretaria' then 'secretaria1'
      when 'decisoes' then 'decisoes' when 'financeiro' then 'financeiro' when 'organizacional' then 'visitante' end as x
    from (select jsonb_array_elements_text(coalesce(p->'ver','[]'::jsonb) || coalesce(p->'editar','[]'::jsonb)) as m) t
  ) s where x is not null
$$;

create or replace function public.tem_perfil(perfis text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pessoas
    where user_id = (select auth.uid()) and ativo
      and (perfil = any(perfis) or (perfil = 'servo' and public.servo_perfis(permissoes) && perfis)))
$$;

-- Servo com Organizacional não ganha o estoque geral por causa do perfil "visitante" equivalente.
create or replace function public.ve_todo_estoque() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin','coordenacao','estoque','financeiro','decisoes','admin_edicao'])
      or (public.tem_perfil(array['visitante']) and not public.na_equipe_de_setor()
          and not exists (select 1 from public.pessoas where user_id = (select auth.uid()) and perfil = 'servo'))
$$;
