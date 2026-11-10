-- como no Drive: arquivos também podem ficar soltos na raiz (area_id nulo)
alter table public.org_arquivos alter column area_id drop not null;

create or replace function public.org_pasta_ativa(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select p is null or (
    exists (select 1 from public.org_areas where id = p)
    and not exists (
      with recursive acima as (
        select id, pai_id, apagado_em from public.org_areas where id = p
        union all select a.id, a.pai_id, a.apagado_em from public.org_areas a join acima on a.id = acima.pai_id)
      select 1 from acima where apagado_em is not null));
$$;
revoke all on function public.org_pasta_ativa(uuid) from public, anon, authenticated;
