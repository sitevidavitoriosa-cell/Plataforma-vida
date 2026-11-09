-- Perfil "admin_edicao": administrador que enxerga e mexe só nas edições que lhe foram atribuídas
-- (ficha, saúde, secretaria, decisões, envio de material e relatório dessas edições).

-- 1) perfil novo + ligação pessoa x edição
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid = 'public.pessoas'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%perfil%';
  if c is not null then execute format('alter table public.pessoas drop constraint %I', c); end if;
end $$;
alter table public.pessoas add constraint pessoas_perfil_check
  check (perfil in ('admin','coordenacao','financeiro','estoque','decisoes','saude','visitante','admin_edicao'));

create table public.pessoa_edicoes (
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  primary key (pessoa_id, edicao_id)
);
alter table public.pessoa_edicoes enable row level security;
create policy pe_adm on public.pessoa_edicoes for all to authenticated
  using (public.tem_perfil(array['admin'])) with check (public.tem_perfil(array['admin']));
create policy pe_proprio on public.pessoa_edicoes for select to authenticated
  using (pessoa_id = public.eu_id());

-- 2) funções de acesso
create or replace function public.eh_admin_edicao() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin_edicao'])
$$;
create or replace function public.pode_edicao(p_edicao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_perfil(array['admin'])
  or exists (
    select 1 from public.pessoas p join public.pessoa_edicoes pe on pe.pessoa_id = p.id
    where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin_edicao' and pe.edicao_id = p_edicao)
$$;
revoke all on function public.eh_admin_edicao(), public.pode_edicao(uuid) from public, anon;
grant execute on function public.eh_admin_edicao(), public.pode_edicao(uuid) to authenticated;

-- meu_acesso devolve também as edições do admin de edição
create or replace function public.meu_acesso() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', p.id, 'nome', p.nome, 'email', p.email, 'perfil', p.perfil,
    'equipes', coalesce((select json_agg(json_build_object('nome', e.nome, 'setores', e.setores))
      from public.equipe_membros m join public.equipes e on e.id = m.equipe_id where m.pessoa_id = p.id), '[]'::json),
    'edicoes', coalesce((select json_agg(pe.edicao_id) from public.pessoa_edicoes pe where pe.pessoa_id = p.id), '[]'::json))
  from public.pessoas p where p.user_id = (select auth.uid()) and p.ativo
$$;

-- 3) edições, envios e movimentos: admin de edição só enxerga as dele
drop policy edicoes_sel on public.edicoes;
create policy edicoes_sel on public.edicoes for select to authenticated
  using (public.ativa() and (not public.eh_admin_edicao() or public.pode_edicao(id)));
drop policy env_sel on public.envios;
create policy env_sel on public.envios for select to authenticated
  using (public.ativa() and (not public.eh_admin_edicao() or public.pode_edicao(edicao_id)));
drop policy mov_sel on public.movimentos;
create policy mov_sel on public.movimentos for select to authenticated
  using (public.ativa() and (not public.eh_admin_edicao() or edicao_id is null or public.pode_edicao(edicao_id)));

-- 4) ficha (admin ou admin da edição)
drop policy enc_adm on public.encontristas;
create policy enc_adm on public.encontristas for all to authenticated
  using (public.pode_edicao(edicao_id)) with check (public.pode_edicao(edicao_id));
drop policy enc_saude_adm on public.encontrista_saude;
create policy enc_saude_adm on public.encontrista_saude for all to authenticated
  using (public.pode_edicao((select e.edicao_id from public.encontristas e where e.id = encontrista_id)))
  with check (public.pode_edicao((select e.edicao_id from public.encontristas e where e.id = encontrista_id)));
drop policy enc_esp_adm on public.encontrista_espiritual;
create policy enc_esp_adm on public.encontrista_espiritual for all to authenticated
  using (public.pode_edicao((select e.edicao_id from public.encontristas e where e.id = encontrista_id)))
  with check (public.pode_edicao((select e.edicao_id from public.encontristas e where e.id = encontrista_id)));

-- importar: admin ou admin da edição
create or replace function public.importar_encontristas(p_edicao uuid, p_itens jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare
  it jsonb; v_id uuid; v_novos int := 0; v_atual int := 0; v_existia boolean;
begin
  if not public.pode_edicao(p_edicao) then raise exception 'sem permissão'; end if;
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

-- 5) saúde e nomes (secretaria)
create or replace function public.saude_lista(p_edicao uuid)
returns table (id uuid, nome text, idade int, categoria text, necessidade text, contatos text[], observacao text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.tem_perfil(array['admin','saude']) or public.pode_edicao(p_edicao)) then raise exception 'sem permissão'; end if;
  return query
    select e.id, e.nome, e.idade, e.categoria, s.necessidade, s.contatos, s.observacao
    from public.encontristas e join public.encontrista_saude s on s.encontrista_id = e.id
    where e.edicao_id = p_edicao and not e.cancelada and s.tem_necessidade order by e.nome;
end $$;
create or replace function public.salvar_obs_saude(p_id uuid, p_obs text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ed uuid;
begin
  select edicao_id into v_ed from public.encontristas where id = p_id;
  if not (public.tem_perfil(array['admin','saude']) or public.pode_edicao(v_ed)) then raise exception 'sem permissão'; end if;
  update public.encontrista_saude set observacao = nullif(btrim(p_obs), ''), atualizado_em = now() where encontrista_id = p_id;
end $$;
create or replace function public.nomes_edicao(p_edicao uuid)
returns table (id uuid, cod text, nome text, categoria text, sexo text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.pode_secretaria() or public.pode_edicao(p_edicao)) then raise exception 'sem permissão'; end if;
  return query
    select e.id, e.cod, e.nome, e.categoria, e.sexo from public.encontristas e
    where e.edicao_id = p_edicao and not e.cancelada order by e.nome;
end $$;

-- quartos (por edição) e crachás (modelos globais)
drop policy quartos_sec on public.quartos;
create policy quartos_sec on public.quartos for all to authenticated
  using (public.pode_secretaria() or public.pode_edicao(edicao_id))
  with check (public.pode_secretaria() or public.pode_edicao(edicao_id));
drop policy quartos_oc_sec on public.quarto_ocupantes;
create policy quartos_oc_sec on public.quarto_ocupantes for all to authenticated
  using (public.pode_secretaria() or public.pode_edicao((select q.edicao_id from public.quartos q where q.id = quarto_id)))
  with check (public.pode_secretaria() or public.pode_edicao((select q.edicao_id from public.quartos q where q.id = quarto_id)));
drop policy cr_mod_sec on public.crachas_modelos;
create policy cr_mod_sec on public.crachas_modelos for all to authenticated
  using (public.pode_secretaria() or public.eh_admin_edicao()) with check (public.pode_secretaria() or public.eh_admin_edicao());
drop policy cr_cfg_sec on public.crachas_cfg;
create policy cr_cfg_sec on public.crachas_cfg for all to authenticated
  using (public.pode_secretaria() or public.eh_admin_edicao()) with check (public.pode_secretaria() or public.eh_admin_edicao());
drop policy crachas_sel on storage.objects;
drop policy crachas_ins on storage.objects;
drop policy crachas_upd on storage.objects;
drop policy crachas_del on storage.objects;
create policy crachas_sel on storage.objects for select to authenticated
  using (bucket_id = 'crachas' and (public.pode_secretaria() or public.eh_admin_edicao()));
create policy crachas_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'crachas' and (public.pode_secretaria() or public.eh_admin_edicao()));
create policy crachas_upd on storage.objects for update to authenticated
  using (bucket_id = 'crachas' and (public.pode_secretaria() or public.eh_admin_edicao()));
create policy crachas_del on storage.objects for delete to authenticated
  using (bucket_id = 'crachas' and (public.pode_secretaria() or public.eh_admin_edicao()));

-- 6) decisões
drop policy dec_all on public.decisoes;
create policy dec_all on public.decisoes for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','decisoes']) or public.pode_edicao(edicao_id))
  with check (public.tem_perfil(array['admin','coordenacao','decisoes']) or public.pode_edicao(edicao_id));
drop policy deccfg_all on public.decisoes_cfg;
create policy deccfg_all on public.decisoes_cfg for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','decisoes']) or public.pode_edicao(edicao_id))
  with check (public.tem_perfil(array['admin','coordenacao','decisoes']) or public.pode_edicao(edicao_id));
drop policy links_all on public.registro_links;
create policy links_all on public.registro_links for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','decisoes']) or public.pode_edicao(edicao_id))
  with check (public.tem_perfil(array['admin','coordenacao','decisoes']) or public.pode_edicao(edicao_id));

-- 7) envio de material: também permitido ao admin da edição (nas edições dele)
create or replace function public.definir_envio(p_edicao uuid, p_item uuid, p_env numeric)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_setor text; v_qtd numeric; v_old numeric := 0; v_ap numeric; v_tem boolean;
begin
  select setor, qtd into v_setor, v_qtd from public.itens where id = p_item;
  if v_setor is null then raise exception 'item_inexistente'; end if;
  if not (public.pode_setor(v_setor) or (public.eh_admin_edicao() and public.pode_edicao(p_edicao))) then raise exception 'sem_permissao'; end if;
  if p_env < 0 then raise exception 'quantidade_invalida'; end if;
  select true, env, aplicado into v_tem, v_old, v_ap from public.envios where edicao_id = p_edicao and item_id = p_item;
  v_old := coalesce(v_old, 0);
  if v_ap is not null then raise exception 'balanco_fechado'; end if;
  if p_env - v_old > v_qtd then raise exception 'sem_estoque'; end if;
  if p_env = 0 then
    delete from public.envios where edicao_id = p_edicao and item_id = p_item;
  else
    insert into public.envios (edicao_id, item_id, env) values (p_edicao, p_item, p_env)
      on conflict (edicao_id, item_id) do update set env = excluded.env;
  end if;
  update public.itens set qtd = qtd + v_old - p_env, atualizado_em = now() where id = p_item;
  return p_env;
end $$;

create or replace function public.copiar_envio(p_edicao uuid, p_origem uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; v_n integer := 0; v_novo numeric; v_ae boolean := public.eh_admin_edicao();
begin
  if v_ae and not (public.pode_edicao(p_edicao) and public.pode_edicao(p_origem)) then raise exception 'sem_permissao'; end if;
  for r in select e.item_id, e.env, i.qtd, i.setor from public.envios e join public.itens i on i.id = e.item_id where e.edicao_id = p_origem loop
    if (public.pode_setor(r.setor) or v_ae) and not exists (select 1 from public.envios where edicao_id = p_edicao and item_id = r.item_id) then
      v_novo := least(r.env, r.qtd);
      if v_novo > 0 then perform public.definir_envio(p_edicao, r.item_id, v_novo); v_n := v_n + 1; end if;
    end if;
  end loop;
  return v_n;
end $$;

create or replace function public.fechar_balanco(p_edicao uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; v numeric; d numeric; v_n integer := 0; v_ae boolean := public.eh_admin_edicao() and public.pode_edicao(p_edicao);
begin
  for r in select e.item_id, e.env, e.comp, e.volta, e.aplicado, i.setor from public.envios e join public.itens i on i.id = e.item_id where e.edicao_id = p_edicao loop
    if not (public.pode_setor(r.setor) or v_ae) then continue; end if;
    v := coalesce(r.volta, r.env + r.comp);
    d := v - coalesce(r.aplicado, 0);
    if r.aplicado is not null and d = 0 then continue; end if;
    update public.envios set volta = v, aplicado = v where edicao_id = p_edicao and item_id = r.item_id;
    if d <> 0 then update public.itens set qtd = greatest(0, qtd + d), atualizado_em = now() where id = r.item_id; end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- comprado/voltou (edição direta em envios): admin da edição, nas edições dele
drop policy env_esc on public.envios;
create policy env_esc on public.envios for all to authenticated
  using (public.pode_setor((select i.setor from public.itens i where i.id = envios.item_id))
         or (public.eh_admin_edicao() and public.pode_edicao(edicao_id)))
  with check (public.pode_setor((select i.setor from public.itens i where i.id = envios.item_id))
         or (public.eh_admin_edicao() and public.pode_edicao(edicao_id)));
