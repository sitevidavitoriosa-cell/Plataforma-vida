-- Financeiro e estoque podem definir o preço unitário de um item (usado na previsão de reposição).
create or replace function public.definir_preco(p_item uuid, p_preco numeric)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.tem_perfil(array['admin','coordenacao','financeiro','estoque']) then raise exception 'sem_permissao'; end if;
  if p_preco is null or p_preco < 0 then raise exception 'valor_invalido'; end if;
  update public.itens set preco = p_preco, atualizado_em = now() where id = p_item;
  if not found then raise exception 'item_inexistente'; end if;
  return true;
end $$;
revoke all on function public.definir_preco(uuid, numeric) from public, anon;
grant execute on function public.definir_preco(uuid, numeric) to authenticated;
