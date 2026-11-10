-- Um único link por edição com o card de cada quarto (equipe de Saúde e Secretaria usam o mesmo).
-- A lista de saúde passa a mostrar também o quarto de cada pessoa.

create table if not exists public.quartos_link_edicao (
  token text primary key default encode(gen_random_bytes(18), 'hex'),
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists quartos_link_edicao_ativo on public.quartos_link_edicao (edicao_id) where ativo;
alter table public.quartos_link_edicao enable row level security;  -- sem políticas: só pelas funções abaixo

-- os links antigos (um por quarto) deixam de valer; o link único os substitui
update public.quarto_links set ativo = false where ativo;

create or replace function public.pode_link_quartos(p_edicao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.pode_secretaria() or public.tem_perfil(array['admin','saude']) or public.pode_edicao(p_edicao)
$$;
revoke all on function public.pode_link_quartos(uuid) from public, anon;
grant execute on function public.pode_link_quartos(uuid) to authenticated;

-- devolve o link ativo da edição (cria se ainda não existe)
create or replace function public.link_quartos(p_edicao uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if not public.pode_link_quartos(p_edicao) then raise exception 'sem_permissao'; end if;
  select token into v from public.quartos_link_edicao where edicao_id = p_edicao and ativo;
  if v is null then insert into public.quartos_link_edicao (edicao_id) values (p_edicao) returning token into v; end if;
  return v;
end $$;

-- troca por um link novo (o anterior para de funcionar)
create or replace function public.renovar_link_quartos(p_edicao uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if not public.pode_link_quartos(p_edicao) then raise exception 'sem_permissao'; end if;
  update public.quartos_link_edicao set ativo = false where edicao_id = p_edicao and ativo;
  insert into public.quartos_link_edicao (edicao_id) values (p_edicao) returning token into v;
  return v;
end $$;

create or replace function public.desligar_link_quartos(p_edicao uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_link_quartos(p_edicao) then raise exception 'sem_permissao'; end if;
  update public.quartos_link_edicao set ativo = false where edicao_id = p_edicao and ativo;
end $$;

revoke all on function public.link_quartos(uuid), public.renovar_link_quartos(uuid), public.desligar_link_quartos(uuid) from public, anon;
grant execute on function public.link_quartos(uuid), public.renovar_link_quartos(uuid), public.desligar_link_quartos(uuid) to authenticated;

-- página pública (sem login): todos os quartos da edição, cada um com seus encontristas
create or replace function public.quartos_edicao_info(p_token text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare v_t public.quartos_link_edicao;
begin
  select * into v_t from public.quartos_link_edicao where token = p_token and ativo;
  if v_t.token is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', true,
    'edicao', (select nome from public.edicoes where id = v_t.edicao_id),
    'quartos', coalesce((select json_agg(json_build_object(
      'id', q.id, 'nome', q.nome, 'sexo', q.sexo, 'capacidade', q.capacidade,
      'anjos', coalesce((select json_agg(a.nome order by a.nome) from public.quarto_anjos qa join public.encontristas a on a.id = qa.encontrista_id where qa.quarto_id = q.id), '[]'::json),
      'pessoas', coalesce((select json_agg(json_build_object(
          'id', e.id, 'nome', e.nome, 'idade', e.idade, 'sexo', e.sexo, 'estado_civil', e.estado_civil,
          'bairro', e.bairro, 'municipio', e.municipio,
          'batizado', sp.batizado, 'igreja', sp.igreja, 'em_celula', sp.em_celula, 'celula', sp.celula,
          'lider_celula', sp.lider_celula, 'discipulado', sp.discipulado, 'rede', sp.rede,
          'tem_necessidade', coalesce(sa.tem_necessidade, false), 'necessidade', sa.necessidade,
          'obs_saude', sa.observacao, 'contatos', coalesce(sa.contatos, '{}'::text[])
        ) order by e.nome)
        from public.quarto_ocupantes o
        join public.encontristas e on e.id = o.encontrista_id
        left join public.encontrista_espiritual sp on sp.encontrista_id = e.id
        left join public.encontrista_saude sa on sa.encontrista_id = e.id
        where o.quarto_id = q.id and not e.cancelada), '[]'::json)
    ) order by q.nome) from public.quartos q where q.edicao_id = v_t.edicao_id), '[]'::json));
end $$;
grant execute on function public.quartos_edicao_info(text) to anon, authenticated;

-- lista de saúde com o quarto de cada pessoa
drop function if exists public.saude_lista(uuid);
create function public.saude_lista(p_edicao uuid)
returns table(id uuid, nome text, idade integer, categoria text, necessidade text, contatos text[], observacao text, quarto text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.tem_perfil(array['admin','saude','secretaria1']) or public.pode_edicao(p_edicao)) then raise exception 'sem permissão'; end if;
  return query
    select e.id, e.nome, e.idade, e.categoria, s.necessidade, s.contatos, s.observacao,
      (select q.nome from public.quarto_ocupantes o join public.quartos q on q.id = o.quarto_id where o.encontrista_id = e.id limit 1)
    from public.encontristas e join public.encontrista_saude s on s.encontrista_id = e.id
    where e.edicao_id = p_edicao and not e.cancelada and s.tem_necessidade and not s.oculto order by e.nome;
end $$;
revoke all on function public.saude_lista(uuid) from public, anon;
grant execute on function public.saude_lista(uuid) to authenticated;
