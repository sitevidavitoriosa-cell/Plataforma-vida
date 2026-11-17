-- Servo: o material do setor (Saúde / Secretaria 1) é liberado pela caixa da área, sem precisar de equipe.
create or replace function public.pode_setor(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin','estoque'])
  or (s = 'Secretaria 1' and public.tem_perfil(array['secretaria1']))
  or (s = 'Saúde' and exists (select 1 from public.pessoas p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'servo' and 'saude' = any(public.servo_perfis(p.permissoes))))
  or exists (
    select 1 from public.pessoas p
    join public.equipe_membros m on m.pessoa_id = p.id
    join public.equipes e on e.id = m.equipe_id
    where p.user_id = (select auth.uid()) and p.ativo and s = any(e.setores))
$$;
