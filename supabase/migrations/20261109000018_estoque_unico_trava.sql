-- Estoque único para todas as edições: duas edições ativas ao mesmo tempo disputam a mesma quantidade.
-- O envio trava o item (for update) antes de conferir a quantidade, então envios simultâneos nunca passam do disponível.
create or replace function public.definir_envio(p_edicao uuid, p_item uuid, p_env numeric)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_setor text; v_qtd numeric; v_old numeric := 0; v_ap numeric; v_inf boolean;
begin
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

create or replace function public.conferir_balanco(p_edicao uuid, p_item uuid, p_volta numeric)
returns numeric language plpgsql security definer set search_path = '' as $$
declare e public.envios; d numeric;
begin
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
