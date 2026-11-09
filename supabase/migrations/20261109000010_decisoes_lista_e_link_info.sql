-- (Já aplicada no banco.) Lista de decisões para o painel e link público sem botões arquivados / canceladas.
create or replace function public.decisoes_lista(p_edicao uuid)
returns table(encontrista_id uuid, nome text, cod text, botao text, por text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.tem_perfil(array['admin','coordenacao','decisoes']) or public.pode_edicao(p_edicao)) then
    raise exception 'sem permissão';
  end if;
  return query
    select d.encontrista_id, e.nome, e.cod, d.botao, d.por, d.criado_em
    from public.decisoes d join public.encontristas e on e.id = d.encontrista_id
    where d.edicao_id = p_edicao order by d.criado_em desc;
end $$;
