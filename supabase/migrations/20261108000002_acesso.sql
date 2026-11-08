-- Funções de acesso e regras (RLS)

create or replace function public.eu_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.pessoas where user_id = (select auth.uid()) and ativo
$$;

create or replace function public.tem_perfil(perfis text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pessoas
    where user_id = (select auth.uid()) and ativo and perfil = any(perfis))
$$;

create or replace function public.ativa() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pessoas where user_id = (select auth.uid()) and ativo)
$$;

create or replace function public.pode_setor(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin','coordenacao','estoque'])
  or exists (
    select 1 from public.pessoas p
    join public.equipe_membros m on m.pessoa_id = p.id
    join public.equipes e on e.id = m.equipe_id
    where p.user_id = (select auth.uid()) and p.ativo and s = any(e.setores))
$$;

-- "Ativar meu acesso": liga o login (e-mail confirmado) à pessoa convidada
create or replace function public.ativar_meu_acesso() returns json
language plpgsql security definer set search_path = '' as $$
declare v_email text; v_p public.pessoas;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then return json_build_object('ok', false, 'erro', 'sem_login'); end if;
  update public.pessoas set user_id = auth.uid()
    where lower(email) = v_email and ativo and (user_id is null or user_id = auth.uid())
    returning * into v_p;
  if v_p.id is null then return json_build_object('ok', false, 'erro', 'nao_convidado'); end if;
  return json_build_object('ok', true, 'nome', v_p.nome, 'perfil', v_p.perfil);
end $$;

create or replace function public.meu_acesso() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', p.id, 'nome', p.nome, 'email', p.email, 'perfil', p.perfil,
    'equipes', coalesce((select json_agg(json_build_object('nome', e.nome, 'setores', e.setores))
      from public.equipe_membros m join public.equipes e on e.id = m.equipe_id
      where m.pessoa_id = p.id), '[]'::json))
  from public.pessoas p where p.user_id = (select auth.uid()) and p.ativo
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.eu_id(), public.tem_perfil(text[]), public.ativa(),
  public.pode_setor(text), public.ativar_meu_acesso(), public.meu_acesso() to authenticated;

-- RLS
alter table public.pessoas enable row level security;
alter table public.equipes enable row level security;
alter table public.equipe_membros enable row level security;
alter table public.edicoes enable row level security;
alter table public.itens enable row level security;
alter table public.movimentos enable row level security;
alter table public.envios enable row level security;
alter table public.lancamentos enable row level security;
alter table public.encontristas enable row level security;
alter table public.decisoes_cfg enable row level security;
alter table public.decisoes enable row level security;
alter table public.registro_links enable row level security;

-- pessoas / equipes: admin gerencia; cada um vê a si mesmo
create policy pessoas_sel on public.pessoas for select to authenticated
  using (public.tem_perfil(array['admin']) or user_id = (select auth.uid()));
create policy pessoas_adm on public.pessoas for all to authenticated
  using (public.tem_perfil(array['admin'])) with check (public.tem_perfil(array['admin']));
create policy equipes_sel on public.equipes for select to authenticated using (public.ativa());
create policy equipes_adm on public.equipes for all to authenticated
  using (public.tem_perfil(array['admin'])) with check (public.tem_perfil(array['admin']));
create policy membros_sel on public.equipe_membros for select to authenticated
  using (public.tem_perfil(array['admin']) or pessoa_id = public.eu_id());
create policy membros_adm on public.equipe_membros for all to authenticated
  using (public.tem_perfil(array['admin'])) with check (public.tem_perfil(array['admin']));

-- edições: todos leem; admin/coordenação escrevem
create policy edicoes_sel on public.edicoes for select to authenticated using (public.ativa());
create policy edicoes_esc on public.edicoes for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao']))
  with check (public.tem_perfil(array['admin','coordenacao']));

-- estoque: todos leem; escreve quem é admin/coordenação/estoque ou da equipe do setor
create policy itens_sel on public.itens for select to authenticated using (public.ativa());
create policy itens_esc on public.itens for all to authenticated
  using (public.pode_setor(setor)) with check (public.pode_setor(setor));
create policy mov_sel on public.movimentos for select to authenticated using (public.ativa());
create policy mov_esc on public.movimentos for all to authenticated
  using (public.pode_setor((select i.setor from public.itens i where i.id = item_id)))
  with check (public.pode_setor((select i.setor from public.itens i where i.id = item_id)));
create policy env_sel on public.envios for select to authenticated using (public.ativa());
create policy env_esc on public.envios for all to authenticated
  using (public.pode_setor((select i.setor from public.itens i where i.id = item_id)))
  with check (public.pode_setor((select i.setor from public.itens i where i.id = item_id)));

-- financeiro
create policy lanc_sel on public.lancamentos for select to authenticated
  using (public.tem_perfil(array['admin','coordenacao','financeiro']));
create policy lanc_esc on public.lancamentos for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','financeiro']))
  with check (public.tem_perfil(array['admin','coordenacao','financeiro']));

-- decisões
create policy enc_all on public.encontristas for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','decisoes']))
  with check (public.tem_perfil(array['admin','coordenacao','decisoes']));
create policy deccfg_all on public.decisoes_cfg for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','decisoes']))
  with check (public.tem_perfil(array['admin','coordenacao','decisoes']));
create policy dec_all on public.decisoes for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','decisoes']))
  with check (public.tem_perfil(array['admin','coordenacao','decisoes']));
create policy links_all on public.registro_links for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','decisoes']))
  with check (public.tem_perfil(array['admin','coordenacao','decisoes']));
