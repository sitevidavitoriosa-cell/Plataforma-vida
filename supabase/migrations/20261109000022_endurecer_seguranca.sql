-- Endurecimento de segurança: visitante sem login só chama as 3 funções dos links secretos + quem_e (tela de ativação).
revoke execute on function public.conferir_balanco(uuid, uuid, numeric) from anon, public;
revoke execute on function public.eh_paiol(uuid) from anon, public;
revoke execute on function public.enviar_balanco(uuid, text) from anon, public;
revoke execute on function public.na_equipe_de_setor() from anon, public;
revoke execute on function public.reabrir_balanco(uuid, uuid) from anon, public;
revoke execute on function public.salvar_volta(uuid, uuid, numeric, numeric) from anon, public;
revoke execute on function public.secretaria_encontristas(uuid) from anon, public;
revoke execute on function public.ve_todo_estoque() from anon, public;

-- quem_e: não revela mais o perfil (cargo) de quem tem o e-mail; só nome e se já ativou.
create or replace function public.quem_e(p_email text)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce((select json_build_object('nome', nome, 'ativado', user_id is not null)
    from public.pessoas where lower(email) = lower(trim(p_email)) and ativo), 'null'::json)
$$;

-- registrar_decisao: limita o tamanho dos textos enviados pelo link público.
create or replace function public.registrar_decisao(p_token text, p_pessoa uuid, p_botao text, p_marcar boolean, p_por text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare v_l public.registro_links;
begin
  select * into v_l from public.registro_links where token = p_token and ativo;
  if v_l.token is null then return json_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if p_botao is null or length(p_botao) > 60 then return json_build_object('ok', false, 'erro', 'botao_invalido'); end if;
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
