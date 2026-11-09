-- Perfil "Secretaria 1": acessa só a Secretaria 1 (crachás, quartos, encontristas, saúde, material do setor).
alter table public.pessoas drop constraint if exists pessoas_perfil_check;
alter table public.pessoas add constraint pessoas_perfil_check check (perfil in
  ('admin','coordenacao','financeiro','estoque','decisoes','saude','visitante','admin_edicao','secretaria1'));

create or replace function public.pode_secretaria() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin','secretaria1'])
  or exists (
    select 1 from public.pessoas p
    join public.equipe_membros m on m.pessoa_id = p.id
    join public.equipes e on e.id = m.equipe_id
    where p.user_id = (select auth.uid()) and p.ativo and 'Secretaria 1' = any(e.setores))
$$;

-- material do setor Secretaria 1 (recebido do paiol e balanço)
create or replace function public.pode_setor(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin','estoque'])
  or (s = 'Secretaria 1' and public.tem_perfil(array['secretaria1']))
  or exists (
    select 1 from public.pessoas p
    join public.equipe_membros m on m.pessoa_id = p.id
    join public.equipes e on e.id = m.equipe_id
    where p.user_id = (select auth.uid()) and p.ativo and s = any(e.setores))
$$;

-- lista de saúde (somente leitura para a Secretaria 1)
create or replace function public.saude_lista(p_edicao uuid)
returns table(id uuid, nome text, idade integer, categoria text, necessidade text, contatos text[], observacao text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.tem_perfil(array['admin','saude','secretaria1']) or public.pode_edicao(p_edicao)) then raise exception 'sem permissão'; end if;
  return query
    select e.id, e.nome, e.idade, e.categoria, s.necessidade, s.contatos, s.observacao
    from public.encontristas e join public.encontrista_saude s on s.encontrista_id = e.id
    where e.edicao_id = p_edicao and not e.cancelada and s.tem_necessidade order by e.nome;
end $$;

-- encontristas para a Secretaria 1: dados de cadastro, sem telefone, CPF, pagamento ou saúde
create or replace function public.secretaria_encontristas(p_edicao uuid)
returns table(id uuid, cod text, nome text, categoria text, sexo text, idade integer, estado_civil text, bairro text, municipio text, batizado boolean, igreja text, rede text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.pode_secretaria() or public.pode_edicao(p_edicao)) then raise exception 'sem permissão'; end if;
  return query
    select e.id, e.cod, e.nome, e.categoria, e.sexo, e.idade, e.estado_civil, e.bairro, e.municipio, sp.batizado, sp.igreja, sp.rede
    from public.encontristas e left join public.encontrista_espiritual sp on sp.encontrista_id = e.id
    where e.edicao_id = p_edicao and not e.cancelada order by e.nome;
end $$;
grant execute on function public.secretaria_encontristas(uuid) to authenticated;
