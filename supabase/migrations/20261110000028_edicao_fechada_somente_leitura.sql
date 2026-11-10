-- Edição fechada = só consulta: estoque (retirada, balanço), financeiro, quartos, encontristas e decisões não mudam.
-- Para mexer de novo, reabrir a edição em Edições (status).

create or replace function public.edicao_fechada(p_edicao uuid) returns boolean
language sql volatile security definer set search_path = '' as $$
  select coalesce((select status = 'fechada' from public.edicoes where id = p_edicao), false)
$$;
revoke all on function public.edicao_fechada(uuid) from public, anon;
grant execute on function public.edicao_fechada(uuid) to authenticated;

-- ===== estoque =====
create or replace function public.definir_envio(p_edicao uuid, p_item uuid, p_env numeric) returns numeric
language plpgsql security definer set search_path = '' as $$
declare v_setor text; v_qtd numeric; v_old numeric := 0; v_ap numeric; v_inf boolean;
begin
  if public.edicao_fechada(p_edicao) then raise exception 'edicao_fechada'; end if;
  select setor, qtd into v_setor, v_qtd from public.itens where id = p_item for update;
  if v_setor is null then raise exception 'item_inexistente'; end if;
  if not public.eh_paiol(p_edicao) then raise exception 'sem_permissao'; end if;
  if p_env < 0 then raise exception 'quantidade_invalida'; end if;
  select env, aplicado, informado into v_old, v_ap, v_inf from public.envios where edicao_id = p_edicao and item_id = p_item;
  v_old := coalesce(v_old, 0);
  if v_ap is not null then raise exception 'balanco_fechado'; end if;
  if coalesce(v_inf, false) then raise exception 'balanco_informado'; end if;
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
  if public.edicao_fechada(p_edicao) then raise exception 'edicao_fechada'; end if;
  if not (public.eh_paiol(p_edicao) and (not public.eh_admin_edicao() or public.pode_edicao(p_origem))) then raise exception 'sem_permissao'; end if;
  for r in select e.item_id, e.env, i.qtd from public.envios e join public.itens i on i.id = e.item_id where e.edicao_id = p_origem loop
    if not exists (select 1 from public.envios where edicao_id = p_edicao and item_id = r.item_id) then
      v_novo := least(r.env, r.qtd);
      if v_novo > 0 then perform public.definir_envio(p_edicao, r.item_id, v_novo); v_n := v_n + 1; end if;
    end if;
  end loop;
  return v_n;
end $$;

create or replace function public.salvar_volta(p_edicao uuid, p_item uuid, p_volta numeric default null, p_comp numeric default null) returns json
language plpgsql security definer set search_path = '' as $$
declare e public.envios; v_setor text; v_comp numeric; v_volta numeric; v_paiol boolean := public.eh_paiol(p_edicao);
begin
  if public.edicao_fechada(p_edicao) then raise exception 'edicao_fechada'; end if;
  select * into e from public.envios where edicao_id = p_edicao and item_id = p_item;
  if e.item_id is null then raise exception 'sem_envio'; end if;
  select setor into v_setor from public.itens where id = p_item;
  if not (v_paiol or public.pode_setor(v_setor)) then raise exception 'sem_permissao'; end if;
  if e.aplicado is not null and not v_paiol then raise exception 'ja_conferido'; end if;
  if e.informado and not v_paiol then raise exception 'ja_enviado'; end if;
  v_comp := coalesce(p_comp, e.comp);
  if v_comp < 0 then raise exception 'quantidade_invalida'; end if;
  v_volta := coalesce(p_volta, e.volta);
  if v_volta is not null and (v_volta < 0 or v_volta > e.env + v_comp) then raise exception 'acima_do_enviado'; end if;
  update public.envios set comp = v_comp, volta = v_volta where edicao_id = p_edicao and item_id = p_item;
  return json_build_object('ok', true);
end $$;

create or replace function public.enviar_balanco(p_edicao uuid, p_setor text) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v_n integer := 0; v_eu uuid := public.eu_id();
begin
  if public.edicao_fechada(p_edicao) then raise exception 'edicao_fechada'; end if;
  for r in select e.item_id, e.env, e.comp, e.volta, i.setor from public.envios e join public.itens i on i.id = e.item_id
           where e.edicao_id = p_edicao and e.aplicado is null and not e.informado and (p_setor is null or i.setor = p_setor) loop
    if not public.pode_setor(r.setor) then continue; end if;
    update public.envios set volta = coalesce(r.volta, r.env + r.comp), volta_informada = coalesce(r.volta, r.env + r.comp),
      informado = true, informado_em = now(), informado_por = v_eu
      where edicao_id = p_edicao and item_id = r.item_id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.conferir_balanco(p_edicao uuid, p_item uuid, p_volta numeric) returns numeric
language plpgsql security definer set search_path = '' as $$
declare e public.envios; d numeric;
begin
  if public.edicao_fechada(p_edicao) then raise exception 'edicao_fechada'; end if;
  if not public.eh_paiol(p_edicao) then raise exception 'sem_permissao'; end if;
  perform 1 from public.itens where id = p_item for update;
  select * into e from public.envios where edicao_id = p_edicao and item_id = p_item;
  if e.item_id is null then raise exception 'sem_envio'; end if;
  if p_volta < 0 or p_volta > e.env + e.comp then raise exception 'acima_do_enviado'; end if;
  d := p_volta - coalesce(e.aplicado, 0);
  update public.envios set volta = p_volta, aplicado = p_volta, informado = true,
    conferido_em = now(), conferido_por = public.eu_id() where edicao_id = p_edicao and item_id = p_item;
  if d <> 0 then update public.itens set qtd = greatest(0, qtd + d), atualizado_em = now() where id = p_item; end if;
  return p_volta;
end $$;

create or replace function public.reabrir_balanco(p_edicao uuid, p_item uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if public.edicao_fechada(p_edicao) then raise exception 'edicao_fechada'; end if;
  if not public.eh_paiol(p_edicao) then raise exception 'sem_permissao'; end if;
  update public.envios set informado = false, informado_em = null where edicao_id = p_edicao and item_id = p_item and aplicado is null;
  return true;
end $$;

-- ===== demais dados da edição =====
create or replace function public.trava_edicao_fechada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ed uuid;
begin
  v_ed := case when tg_op = 'DELETE' then old.edicao_id else new.edicao_id end;
  if v_ed is not null and public.edicao_fechada(v_ed) then raise exception 'edicao_fechada'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['lancamentos','quartos','encontristas','decisoes'] loop
    execute format('drop trigger if exists trava_edicao_fechada on public.%I', t);
    execute format('create trigger trava_edicao_fechada before insert or update or delete on public.%I for each row execute function public.trava_edicao_fechada()', t);
  end loop;
end $$;
