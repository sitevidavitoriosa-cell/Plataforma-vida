-- Saúde: "Excluir" tira a pessoa da lista da equipe de saúde (a ficha, o quarto e a planilha não são mexidos).
alter table public.encontrista_saude add column if not exists oculto boolean not null default false;

create or replace function public.saude_lista(p_edicao uuid)
returns table(id uuid, nome text, idade integer, categoria text, necessidade text, contatos text[], observacao text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.tem_perfil(array['admin','saude','secretaria1']) or public.pode_edicao(p_edicao)) then raise exception 'sem permissão'; end if;
  return query
    select e.id, e.nome, e.idade, e.categoria, s.necessidade, s.contatos, s.observacao
    from public.encontristas e join public.encontrista_saude s on s.encontrista_id = e.id
    where e.edicao_id = p_edicao and not e.cancelada and s.tem_necessidade and not s.oculto order by e.nome;
end $$;

create or replace function public.excluir_da_saude(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ed uuid;
begin
  select edicao_id into v_ed from public.encontristas where id = p_id;
  if not (public.tem_perfil(array['admin','saude']) or public.pode_edicao(v_ed)) then raise exception 'sem permissão'; end if;
  update public.encontrista_saude set oculto = true, atualizado_em = now() where encontrista_id = p_id;
end $$;
revoke execute on function public.excluir_da_saude(uuid) from anon, public;
