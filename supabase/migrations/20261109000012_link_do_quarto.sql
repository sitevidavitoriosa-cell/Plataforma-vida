-- Link secreto por quarto (para o "anjo"): mostra o perfil de quem dorme no quarto.
create table public.quarto_links (
  token text primary key default encode(gen_random_bytes(18), 'hex'),
  quarto_id uuid not null references public.quartos(id) on delete cascade,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on public.quarto_links (quarto_id);
alter table public.quarto_links enable row level security;
create policy quarto_links_sec on public.quarto_links for all to authenticated
  using (public.pode_secretaria()) with check (public.pode_secretaria());

create or replace function public.quarto_info(p_token text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare v_q public.quartos; v_t public.quarto_links;
begin
  select * into v_t from public.quarto_links where token = p_token and ativo;
  if v_t.token is null then return json_build_object('ok', false); end if;
  select * into v_q from public.quartos where id = v_t.quarto_id;
  return json_build_object('ok', true,
    'quarto', v_q.nome, 'sexo', v_q.sexo,
    'edicao', (select nome from public.edicoes where id = v_q.edicao_id),
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
      where o.quarto_id = v_q.id and not e.cancelada), '[]'::json));
end $$;
grant execute on function public.quarto_info(text) to anon, authenticated;
