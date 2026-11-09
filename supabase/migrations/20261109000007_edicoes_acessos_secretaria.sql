-- Edições com tipo e cor da rede; planilha de encontristas só para administradores;
-- Saúde vê apenas dados de saúde (por função); Secretaria 1: crachás e quartos.

-- 1) edições: tipo (Base/Kids/BeOne) e cor da rede
alter table public.edicoes
  add column tipo text not null default 'base' check (tipo in ('base','kids','beone')),
  add column cor text not null default 'Roxa' check (cor in ('Roxa','Azul','Amarela','Laranja','Vermelha','Verde','Branca'));

-- 2) ficha completa: só administrador (lê e escreve)
drop policy if exists enc_sel on public.encontristas;
drop policy if exists enc_esc on public.encontristas;
drop policy if exists enc_saude_all on public.encontrista_saude;
drop policy if exists enc_esp_all on public.encontrista_espiritual;
create policy enc_adm on public.encontristas for all to authenticated
  using (public.tem_perfil(array['admin'])) with check (public.tem_perfil(array['admin']));
create policy enc_saude_adm on public.encontrista_saude for all to authenticated
  using (public.tem_perfil(array['admin'])) with check (public.tem_perfil(array['admin']));
create policy enc_esp_adm on public.encontrista_espiritual for all to authenticated
  using (public.tem_perfil(array['admin'])) with check (public.tem_perfil(array['admin']));

-- importar: só admin
create or replace function public.importar_encontristas(p_edicao uuid, p_itens jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare
  it jsonb; v_id uuid; v_novos int := 0; v_atual int := 0; v_existia boolean;
begin
  if not public.tem_perfil(array['admin']) then raise exception 'sem permissão'; end if;
  if not exists (select 1 from public.edicoes where id = p_edicao) then raise exception 'edição inexistente'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    if coalesce(btrim(it->>'cod'), '') = '' or coalesce(btrim(it->>'nome'), '') = '' then continue; end if;
    select exists (select 1 from public.encontristas where edicao_id = p_edicao and cod = it->>'cod') into v_existia;
    insert into public.encontristas as e
      (edicao_id, cod, nome, email, fone, endereco, bairro, municipio, cep, sexo, idade,
       estado_civil, categoria, status, cancelada, data_inscricao, atualizado_em)
    values
      (p_edicao, it->>'cod', btrim(it->>'nome'), nullif(it->>'email',''), nullif(it->>'fone',''),
       nullif(it->>'endereco',''), nullif(it->>'bairro',''), nullif(it->>'municipio',''),
       nullif(it->>'cep',''), nullif(it->>'sexo',''), nullif(it->>'idade','')::int,
       nullif(it->>'estado_civil',''), nullif(it->>'categoria',''), nullif(it->>'status',''),
       coalesce((it->>'cancelada')::boolean, false), nullif(it->>'data_inscricao','')::timestamptz, now())
    on conflict (edicao_id, cod) do update set
      nome = excluded.nome, email = excluded.email, fone = excluded.fone, endereco = excluded.endereco,
      bairro = excluded.bairro, municipio = excluded.municipio, cep = excluded.cep, sexo = excluded.sexo,
      idade = excluded.idade, estado_civil = excluded.estado_civil, categoria = excluded.categoria,
      status = excluded.status, cancelada = excluded.cancelada,
      data_inscricao = excluded.data_inscricao, atualizado_em = now()
    returning e.id into v_id;
    insert into public.encontrista_saude (encontrista_id, tem_necessidade, necessidade, contatos)
    values (v_id, coalesce((it->>'tem_necessidade')::boolean, false), nullif(it->>'necessidade',''),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it->'contatos','[]'::jsonb)) x), '{}'))
    on conflict (encontrista_id) do update set
      tem_necessidade = excluded.tem_necessidade, necessidade = excluded.necessidade,
      contatos = excluded.contatos, atualizado_em = now();
    insert into public.encontrista_espiritual (encontrista_id, batizado, igreja, em_celula, celula, lider_celula, discipulado, rede)
    values (v_id, (it->>'batizado')::boolean, nullif(it->>'igreja',''), (it->>'em_celula')::boolean,
      nullif(it->>'celula',''), nullif(it->>'lider_celula',''), nullif(it->>'discipulado',''), nullif(it->>'rede',''))
    on conflict (encontrista_id) do update set
      batizado = excluded.batizado, igreja = excluded.igreja, em_celula = excluded.em_celula,
      celula = excluded.celula, lider_celula = excluded.lider_celula,
      discipulado = excluded.discipulado, rede = excluded.rede, atualizado_em = now();
    if v_existia then v_atual := v_atual + 1; else v_novos := v_novos + 1; end if;
  end loop;
  return json_build_object('novos', v_novos, 'atualizados', v_atual);
end $$;
revoke all on function public.importar_encontristas(uuid, jsonb) from public, anon;
grant execute on function public.importar_encontristas(uuid, jsonb) to authenticated;

-- 3) Saúde: só o que é de saúde, por função (a tabela da ficha segue fechada)
create or replace function public.saude_lista(p_edicao uuid)
returns table (id uuid, nome text, idade int, categoria text, necessidade text, contatos text[], observacao text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tem_perfil(array['admin','saude']) then raise exception 'sem permissão'; end if;
  return query
    select e.id, e.nome, e.idade, e.categoria, s.necessidade, s.contatos, s.observacao
    from public.encontristas e join public.encontrista_saude s on s.encontrista_id = e.id
    where e.edicao_id = p_edicao and not e.cancelada and s.tem_necessidade
    order by e.nome;
end $$;
create or replace function public.salvar_obs_saude(p_id uuid, p_obs text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.tem_perfil(array['admin','saude']) then raise exception 'sem permissão'; end if;
  update public.encontrista_saude set observacao = nullif(btrim(p_obs), ''), atualizado_em = now() where encontrista_id = p_id;
end $$;
revoke all on function public.saude_lista(uuid), public.salvar_obs_saude(uuid, text) from public, anon;
grant execute on function public.saude_lista(uuid), public.salvar_obs_saude(uuid, text) to authenticated;

-- 4) Secretaria 1: administrador ou membro de equipe com o setor "Secretaria 1"
create or replace function public.pode_secretaria() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin'])
  or exists (
    select 1 from public.pessoas p
    join public.equipe_membros m on m.pessoa_id = p.id
    join public.equipes e on e.id = m.equipe_id
    where p.user_id = (select auth.uid()) and p.ativo and 'Secretaria 1' = any(e.setores))
$$;

-- nomes para crachá e quartos (sem telefone, saúde ou dados espirituais)
create or replace function public.nomes_edicao(p_edicao uuid)
returns table (id uuid, cod text, nome text, categoria text, sexo text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pode_secretaria() then raise exception 'sem permissão'; end if;
  return query
    select e.id, e.cod, e.nome, e.categoria, e.sexo from public.encontristas e
    where e.edicao_id = p_edicao and not e.cancelada order by e.nome;
end $$;
revoke all on function public.pode_secretaria(), public.nomes_edicao(uuid) from public, anon;
grant execute on function public.pode_secretaria(), public.nomes_edicao(uuid) to authenticated;

create table public.quartos (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  nome text not null,
  sexo text not null check (sexo in ('Feminino','Masculino')),
  capacidade int not null check (capacidade between 1 and 60),
  criado_em timestamptz not null default now()
);
create table public.quarto_ocupantes (
  encontrista_id uuid primary key references public.encontristas(id) on delete cascade,
  quarto_id uuid not null references public.quartos(id) on delete cascade
);
create index on public.quartos (edicao_id);
create index on public.quarto_ocupantes (quarto_id);
alter table public.quartos enable row level security;
alter table public.quarto_ocupantes enable row level security;
create policy quartos_sec on public.quartos for all to authenticated
  using (public.pode_secretaria()) with check (public.pode_secretaria());
create policy quartos_oc_sec on public.quarto_ocupantes for all to authenticated
  using (public.pode_secretaria()) with check (public.pode_secretaria());

-- crachás: um PNG por rede + posição do nome (a mesma para todas as edições)
create table public.crachas_modelos (
  cor text primary key check (cor in ('Roxa','Azul','Amarela','Laranja','Vermelha','Verde','Branca')),
  arquivo text not null,
  atualizado_em timestamptz not null default now()
);
create table public.crachas_cfg (
  id int primary key default 1 check (id = 1),
  x numeric not null default 50,      -- % da largura (centro do nome)
  y numeric not null default 62,      -- % da altura
  tam numeric not null default 7,     -- % da altura (tamanho da letra)
  cor_texto text not null default '#111111',
  por_pagina int not null default 8 check (por_pagina in (1,2,4,6,8,9))
);
insert into public.crachas_cfg (id) values (1) on conflict do nothing;
alter table public.crachas_modelos enable row level security;
alter table public.crachas_cfg enable row level security;
create policy cr_mod_sec on public.crachas_modelos for all to authenticated
  using (public.pode_secretaria()) with check (public.pode_secretaria());
create policy cr_cfg_sec on public.crachas_cfg for all to authenticated
  using (public.pode_secretaria()) with check (public.pode_secretaria());

insert into storage.buckets (id, name, public) values ('crachas', 'crachas', false) on conflict do nothing;
create policy crachas_sel on storage.objects for select to authenticated
  using (bucket_id = 'crachas' and public.pode_secretaria());
create policy crachas_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'crachas' and public.pode_secretaria());
create policy crachas_upd on storage.objects for update to authenticated
  using (bucket_id = 'crachas' and public.pode_secretaria());
create policy crachas_del on storage.objects for delete to authenticated
  using (bucket_id = 'crachas' and public.pode_secretaria());
