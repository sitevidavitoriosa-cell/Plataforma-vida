-- Link público de Decisões (sem login): só por funções com token

create or replace function public.link_info(p_token text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare v_l public.registro_links;
begin
  select * into v_l from public.registro_links where token = p_token and ativo;
  if v_l.token is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', true,
    'edicao', (select nome from public.edicoes where id = v_l.edicao_id),
    'botoes', coalesce((select botoes from public.decisoes_cfg where edicao_id = v_l.edicao_id), '[]'::jsonb),
    'pessoas', coalesce((select json_agg(json_build_object('id', e.id, 'nome', e.nome, 'cod', e.cod) order by e.nome)
      from public.encontristas e where e.edicao_id = v_l.edicao_id), '[]'::json),
    'marcadas', coalesce((select json_agg(json_build_object('p', d.encontrista_id, 'b', d.botao))
      from public.decisoes d where d.edicao_id = v_l.edicao_id), '[]'::json));
end $$;

create or replace function public.registrar_decisao(p_token text, p_pessoa uuid, p_botao text, p_marcar boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare v_l public.registro_links;
begin
  select * into v_l from public.registro_links where token = p_token and ativo;
  if v_l.token is null then return json_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if not exists (select 1 from public.encontristas where id = p_pessoa and edicao_id = v_l.edicao_id) then
    return json_build_object('ok', false, 'erro', 'pessoa_invalida'); end if;
  if p_marcar then
    insert into public.decisoes (edicao_id, encontrista_id, botao) values (v_l.edicao_id, p_pessoa, p_botao)
    on conflict do nothing;
  else
    delete from public.decisoes where edicao_id = v_l.edicao_id and encontrista_id = p_pessoa and botao = p_botao;
  end if;
  return json_build_object('ok', true);
end $$;

revoke execute on function public.link_info(text), public.registrar_decisao(text, uuid, text, boolean) from public;
grant execute on function public.link_info(text), public.registrar_decisao(text, uuid, text, boolean) to anon, authenticated;

-- Tempo real
alter publication supabase_realtime add table
  public.itens, public.movimentos, public.envios, public.edicoes, public.lancamentos,
  public.encontristas, public.decisoes;

-- Sementes: administradores e equipes
insert into public.pessoas (nome, email, perfil) values
  ('Everton', 'evertoncamara91@gmail.com', 'admin'),
  ('Gabriela', 'gabrielajully@hotmail.com', 'admin');

insert into public.equipes (nome, setores) values
  ('Secretaria 1', array['Secretaria 1']),
  ('Secretaria 2', array['Secretaria 2']),
  ('Saúde', array['Saúde']),
  ('Cozinha e Refeitório', array['Cozinha','Refeitório','Descartáveis','Limpeza']),
  ('Som e Templo', array['Som','Templo','Intercessão']),
  ('Recepção', array['Recepção','Quarto']),
  ('Dinâmicas e Festa', array['Material de Dinâmicas','Festa','Teatro']);
