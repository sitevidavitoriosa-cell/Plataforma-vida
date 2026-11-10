-- 1) Registro de atividades (auditoria): quem mudou o quê. Só o administrador lê; ninguém edita nem apaga.
-- 2) Apagar dados sensíveis de uma edição fechada (LGPD).
-- 3) Remove o quarto de teste.

delete from public.quartos where nome = 'teste' and id = '409748f8-5130-49fb-9a10-9f9d1e0afc94';

create table public.auditoria (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  user_id uuid,
  quem text not null,
  tabela text not null,
  acao text not null,
  registro text,
  rotulo text,
  edicao_id uuid,
  detalhe text
);
create index on public.auditoria (quando desc);
alter table public.auditoria enable row level security;
create policy auditoria_sel on public.auditoria for select to authenticated using (public.tem_perfil(array['admin']));
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

create or replace function public.auditoria_quem() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.nome from public.pessoas p where p.user_id = (select auth.uid()) limit 1),
                  case when (select auth.uid()) is null then 'Sistema' else 'Usuário sem cadastro' end)
$$;
revoke all on function public.auditoria_quem() from public, anon, authenticated;

-- linha a linha (tabelas pequenas e importantes). Nunca grava o conteúdo de campos sensíveis, só os nomes dos campos.
create or replace function public.auditar_linha() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb; o jsonb; campos text; det text;
begin
  j := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    select string_agg(k, ', ' order by k) into campos from jsonb_object_keys(j) k
      where k not in ('atualizado_em', 'tentativas', 'codigo', 'codigo_expira') and j->k is distinct from o->k;
    if campos is null then return new; end if;
    det := 'campos: ' || campos;
    if tg_table_name = 'pessoas' then
      if j->>'perfil' is distinct from o->>'perfil' then det := det || ' | perfil ' || coalesce(o->>'perfil','-') || ' → ' || coalesce(j->>'perfil','-'); end if;
      if j->>'ativo' is distinct from o->>'ativo' then det := det || ' | ativo ' || coalesce(o->>'ativo','-') || ' → ' || coalesce(j->>'ativo','-'); end if;
    elsif tg_table_name = 'edicoes' and j->>'status' is distinct from o->>'status' then
      det := det || ' | status ' || coalesce(o->>'status','-') || ' → ' || coalesce(j->>'status','-');
    end if;
  elsif tg_table_name = 'pessoas' and tg_op = 'INSERT' then
    det := 'perfil ' || coalesce(j->>'perfil', '-');
  end if;
  insert into public.auditoria (user_id, quem, tabela, acao, registro, rotulo, edicao_id, detalhe)
  values ((select auth.uid()), public.auditoria_quem(), tg_table_name, tg_op,
    case when tg_table_name in ('quartos_link_edicao', 'registro_links') then j->>'edicao_id' else coalesce(j->>'id', j->>'encontrista_id') end,
    case when tg_table_name in ('quartos_link_edicao', 'registro_links') then null else coalesce(j->>'nome', j->>'descricao') end,
    nullif(j->>'edicao_id', '')::uuid, det);
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['pessoas','pessoa_edicoes','equipes','equipe_membros','edicoes','lancamentos','quartos','org_areas','org_arquivos','decisoes_cfg','registro_links','quartos_link_edicao'] loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function public.auditar_linha()', t);
  end loop;
  foreach t in array array['decisoes','itens'] loop
    execute format('drop trigger if exists auditar_del on public.%I', t);
  end loop;
  execute 'drop trigger if exists auditar_ins on public.itens';
  execute 'create trigger auditar_del after delete on public.decisoes for each row execute function public.auditar_linha()';
  execute 'create trigger auditar_ins after insert on public.itens for each row execute function public.auditar_linha()';
  execute 'create trigger auditar_del after delete on public.itens for each row execute function public.auditar_linha()';
end $$;

-- em lote (dados pessoais e de saúde): uma linha por operação, só com a quantidade de registros
create or replace function public.auditar_lote_ins() returns trigger language plpgsql security definer set search_path = '' as $$
declare n int;
begin select count(*) into n from novos;
  insert into public.auditoria (user_id, quem, tabela, acao, detalhe) values ((select auth.uid()), public.auditoria_quem(), tg_table_name, 'INSERT', n || ' registro(s)');
  return null; end $$;
create or replace function public.auditar_lote_upd() returns trigger language plpgsql security definer set search_path = '' as $$
declare n int;
begin select count(*) into n from novos;
  insert into public.auditoria (user_id, quem, tabela, acao, detalhe) values ((select auth.uid()), public.auditoria_quem(), tg_table_name, 'UPDATE', n || ' registro(s)');
  return null; end $$;
create or replace function public.auditar_lote_del() returns trigger language plpgsql security definer set search_path = '' as $$
declare n int;
begin select count(*) into n from antigos;
  insert into public.auditoria (user_id, quem, tabela, acao, detalhe) values ((select auth.uid()), public.auditoria_quem(), tg_table_name, 'DELETE', n || ' registro(s)');
  return null; end $$;

do $$
declare t text;
begin
  foreach t in array array['encontristas','encontrista_saude','encontrista_espiritual'] loop
    execute format('drop trigger if exists auditar_ins on public.%I', t);
    execute format('drop trigger if exists auditar_upd on public.%I', t);
    execute format('drop trigger if exists auditar_del on public.%I', t);
    execute format('create trigger auditar_ins after insert on public.%I referencing new table as novos for each statement execute function public.auditar_lote_ins()', t);
    execute format('create trigger auditar_upd after update on public.%I referencing new table as novos for each statement execute function public.auditar_lote_upd()', t);
    execute format('create trigger auditar_del after delete on public.%I referencing old table as antigos for each statement execute function public.auditar_lote_del()', t);
  end loop;
end $$;

-- ===== LGPD: apagar dados sensíveis de uma edição fechada =====
alter table public.edicoes add column if not exists dados_limpos_em timestamptz;

-- o bloqueio da edição fechada deixa passar só a limpeza (que liga um aviso interno na própria transação)
create or replace function public.trava_edicao_fechada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ed uuid;
begin
  if current_setting('vv.lgpd', true) = '1' then return case when tg_op = 'DELETE' then old else new end; end if;
  v_ed := case when tg_op = 'DELETE' then old.edicao_id else new.edicao_id end;
  if v_ed is not null and public.edicao_fechada(v_ed) then raise exception 'edicao_fechada'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function public.limpar_dados_sensiveis(p_edicao uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_saude int; v_pessoas int; v_links int;
begin
  if not public.tem_perfil(array['admin']) then raise exception 'sem_permissao'; end if;
  select nome into v_nome from public.edicoes where id = p_edicao;
  if v_nome is null then raise exception 'edicao_inexistente'; end if;
  if not public.edicao_fechada(p_edicao) then raise exception 'edicao_aberta'; end if;
  perform set_config('vv.lgpd', '1', true);
  update public.encontrista_saude s set necessidade = null, contatos = '{}', observacao = null, tem_necessidade = false, oculto = true
    from public.encontristas e where e.id = s.encontrista_id and e.edicao_id = p_edicao;
  get diagnostics v_saude = row_count;
  update public.encontristas set fone = null, email = null, endereco = null, cep = null where edicao_id = p_edicao;
  get diagnostics v_pessoas = row_count;
  update public.quartos_link_edicao set ativo = false where edicao_id = p_edicao and ativo;
  update public.registro_links set ativo = false where edicao_id = p_edicao and ativo;
  get diagnostics v_links = row_count;
  update public.edicoes set dados_limpos_em = now() where id = p_edicao;
  perform set_config('vv.lgpd', '0', true);
  insert into public.auditoria (user_id, quem, tabela, acao, registro, rotulo, edicao_id, detalhe)
    values ((select auth.uid()), public.auditoria_quem(), 'edicoes', 'LIMPEZA_LGPD', p_edicao::text, v_nome, p_edicao,
            v_saude || ' ficha(s) de saúde e ' || v_pessoas || ' cadastro(s) (telefone, e-mail, endereço, CEP) apagados');
  return json_build_object('saude', v_saude, 'pessoas', v_pessoas);
end $$;
revoke all on function public.limpar_dados_sensiveis(uuid) from public, anon;
grant execute on function public.limpar_dados_sensiveis(uuid) to authenticated;
