-- Link público de decisões: só encontristas (equipe/servos não entram).
create or replace function public.link_info(p_token text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare v_l public.registro_links;
begin
  select * into v_l from public.registro_links where token = p_token and ativo;
  if v_l.token is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', true,
    'edicao', (select nome from public.edicoes where id = v_l.edicao_id),
    'botoes', coalesce((select jsonb_agg(b) from public.decisoes_cfg c, jsonb_array_elements(c.botoes) b
                        where c.edicao_id = v_l.edicao_id and coalesce((b->>'arq')::boolean, false) = false), '[]'::jsonb),
    'pessoas', coalesce((select json_agg(json_build_object('id', e.id, 'nome', e.nome, 'cod', e.cod) order by e.nome)
      from public.encontristas e where e.edicao_id = v_l.edicao_id and not e.cancelada
        and (e.categoria is null or trim(e.categoria) = 'Encontrista')), '[]'::json),
    'marcadas', coalesce((select json_agg(json_build_object('p', d.encontrista_id, 'b', d.botao))
      from public.decisoes d where d.edicao_id = v_l.edicao_id), '[]'::json));
end $$;

create or replace function public.registrar_decisao(p_token text, p_pessoa uuid, p_botao text, p_marcar boolean, p_por text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare v_l public.registro_links;
begin
  select * into v_l from public.registro_links where token = p_token and ativo;
  if v_l.token is null then return json_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if not exists (select 1 from public.encontristas where id = p_pessoa and edicao_id = v_l.edicao_id
                 and (categoria is null or trim(categoria) = 'Encontrista')) then
    return json_build_object('ok', false, 'erro', 'pessoa_invalida'); end if;
  if p_marcar then
    insert into public.decisoes (edicao_id, encontrista_id, botao, por) values (v_l.edicao_id, p_pessoa, p_botao, left(p_por, 60))
    on conflict do nothing;
  else
    delete from public.decisoes where edicao_id = v_l.edicao_id and encontrista_id = p_pessoa and botao = p_botao;
  end if;
  return json_build_object('ok', true);
end $$;
