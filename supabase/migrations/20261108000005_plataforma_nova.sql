-- Plataforma nova: ajustes de tabelas, convite por código, operações de estoque atômicas

-- 1) Tabelas
alter table public.edicoes drop constraint edicoes_status_check;
alter table public.edicoes add constraint edicoes_status_check check (status in ('planejada','aberta','fechada'));
alter table public.edicoes alter column status set default 'planejada';
alter table public.edicoes add column resp text;

alter table public.envios alter column aplicado drop default, alter column aplicado drop not null;
alter table public.envios alter column aplicado type numeric using null;

alter table public.movimentos add column delta numeric;
alter table public.decisoes add column por text;
alter table public.lancamentos add column setor text, add column comp_path text, add column comp_nome text;

alter table public.pessoas
  add column telefone text,
  add column codigo text default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  add column codigo_expira timestamptz default (now() + interval '14 days'),
  add column tentativas integer not null default 0;

-- 2) Login só por código de convite (a função "ativar" cria a conta); remove o atalho antigo
drop function if exists public.ativar_meu_acesso();

create or replace function public.quem_e(p_email text) returns json
language sql stable security definer set search_path = '' as $$
  select coalesce((select json_build_object('nome', nome, 'perfil', perfil, 'ativado', user_id is not null)
    from public.pessoas where lower(email) = lower(trim(p_email)) and ativo), 'null'::json)
$$;

create or replace function public.novo_codigo(p_pessoa uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if not public.tem_perfil(array['admin']) then raise exception 'sem_permissao'; end if;
  v := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  update public.pessoas set codigo = v, codigo_expira = now() + interval '14 days', tentativas = 0 where id = p_pessoa;
  return v;
end $$;

-- 3) Estoque: operações atômicas (respeitam perfil e equipe do setor)
create or replace function public.ajustar_estoque(p_item uuid, p_delta numeric, p_tipo text, p_obs text default null, p_edicao uuid default null)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_setor text; v_qtd numeric;
begin
  select setor into v_setor from public.itens where id = p_item;
  if v_setor is null then raise exception 'item_inexistente'; end if;
  if not public.pode_setor(v_setor) then raise exception 'sem_permissao'; end if;
  update public.itens set qtd = greatest(0, qtd + p_delta), atualizado_em = now() where id = p_item returning qtd into v_qtd;
  insert into public.movimentos (item_id, tipo, qtd, delta, obs, edicao_id, por)
    values (p_item, p_tipo, abs(p_delta), p_delta, p_obs, p_edicao, public.eu_id());
  return v_qtd;
end $$;

create or replace function public.definir_estoque(p_item uuid, p_qtd numeric, p_obs text default null)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_atual numeric;
begin
  select qtd into v_atual from public.itens where id = p_item;
  if v_atual is null then raise exception 'item_inexistente'; end if;
  if p_qtd < 0 then raise exception 'quantidade_invalida'; end if;
  return public.ajustar_estoque(p_item, p_qtd - v_atual, 'ajuste', coalesce(p_obs, 'Correção de quantidade'), null);
end $$;

create or replace function public.definir_envio(p_edicao uuid, p_item uuid, p_env numeric)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_setor text; v_qtd numeric; v_old numeric := 0; v_ap numeric; v_tem boolean;
begin
  select setor, qtd into v_setor, v_qtd from public.itens where id = p_item;
  if v_setor is null then raise exception 'item_inexistente'; end if;
  if not public.pode_setor(v_setor) then raise exception 'sem_permissao'; end if;
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

create or replace function public.copiar_envio(p_edicao uuid, p_origem uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v_n integer := 0; v_novo numeric;
begin
  for r in select e.item_id, e.env, i.qtd, i.setor from public.envios e join public.itens i on i.id = e.item_id where e.edicao_id = p_origem loop
    if public.pode_setor(r.setor) and not exists (select 1 from public.envios where edicao_id = p_edicao and item_id = r.item_id) then
      v_novo := least(r.env, r.qtd);
      if v_novo > 0 then perform public.definir_envio(p_edicao, r.item_id, v_novo); v_n := v_n + 1; end if;
    end if;
  end loop;
  return v_n;
end $$;

create or replace function public.fechar_balanco(p_edicao uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v numeric; d numeric; v_n integer := 0;
begin
  for r in select e.item_id, e.env, e.comp, e.volta, e.aplicado, i.setor from public.envios e join public.itens i on i.id = e.item_id where e.edicao_id = p_edicao loop
    if not public.pode_setor(r.setor) then continue; end if;
    v := coalesce(r.volta, r.env + r.comp);
    d := v - coalesce(r.aplicado, 0);
    if r.aplicado is not null and d = 0 then continue; end if;
    update public.envios set volta = v, aplicado = v where edicao_id = p_edicao and item_id = r.item_id;
    if d <> 0 then update public.itens set qtd = greatest(0, qtd + d), atualizado_em = now() where id = r.item_id; end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- 4) Link público de Decisões: agora registra quem anotou
drop function if exists public.registrar_decisao(text, uuid, text, boolean);
create or replace function public.registrar_decisao(p_token text, p_pessoa uuid, p_botao text, p_marcar boolean, p_por text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare v_l public.registro_links;
begin
  select * into v_l from public.registro_links where token = p_token and ativo;
  if v_l.token is null then return json_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if not exists (select 1 from public.encontristas where id = p_pessoa and edicao_id = v_l.edicao_id) then
    return json_build_object('ok', false, 'erro', 'pessoa_invalida'); end if;
  if p_marcar then
    insert into public.decisoes (edicao_id, encontrista_id, botao, por) values (v_l.edicao_id, p_pessoa, p_botao, left(p_por, 60))
    on conflict do nothing;
  else
    delete from public.decisoes where edicao_id = v_l.edicao_id and encontrista_id = p_pessoa and botao = p_botao;
  end if;
  return json_build_object('ok', true);
end $$;

-- 5) Permissões de execução
revoke execute on all functions in schema public from public, anon;
grant execute on function public.eu_id(), public.tem_perfil(text[]), public.ativa(), public.pode_setor(text),
  public.meu_acesso(), public.novo_codigo(uuid), public.ajustar_estoque(uuid, numeric, text, text, uuid),
  public.definir_estoque(uuid, numeric, text), public.definir_envio(uuid, uuid, numeric),
  public.copiar_envio(uuid, uuid), public.fechar_balanco(uuid) to authenticated;
grant execute on function public.quem_e(text), public.link_info(text),
  public.registrar_decisao(text, uuid, text, boolean, text) to anon, authenticated;

-- 6) Comprovantes (arquivos do financeiro)
insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', false) on conflict do nothing;
create policy comprovantes_sel on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and public.tem_perfil(array['admin','coordenacao','financeiro']));
create policy comprovantes_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and public.tem_perfil(array['admin','coordenacao','financeiro']));
create policy comprovantes_del on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes' and public.tem_perfil(array['admin','coordenacao','financeiro']));
