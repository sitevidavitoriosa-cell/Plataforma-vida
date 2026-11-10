-- Financeiro integrado ao estoque:
--  1) item "alugado" (terceirizado: gás hélio, cadeira, fantasminha): fica na lista de controle, sem saldo no paiol;
--  2) previsão de reposição: itens abaixo do mínimo (não alugados) viram "a comprar"; ao confirmar a compra vira despesa e o estoque sobe;
--  3) aluguéis por edição (quantidade e valor), que viram despesa da edição quando marcados como pagos.

alter table public.itens add column if not exists alugado boolean not null default false;

alter table public.lancamentos
  add column if not exists origem text not null default 'manual' check (origem in ('manual', 'reposicao', 'aluguel')),
  add column if not exists item_id uuid references public.itens(id) on delete set null,
  add column if not exists qtd numeric;

create table if not exists public.alugueis (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  item_id uuid not null references public.itens(id) on delete cascade,
  qtd numeric not null default 1 check (qtd >= 0),
  valor numeric not null default 0 check (valor >= 0),   -- valor total do aluguel
  fornecedor text,
  obs text,
  lancamento_id uuid references public.lancamentos(id) on delete set null,   -- preenchido quando pago
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists alugueis_edicao on public.alugueis (edicao_id);
alter table public.alugueis enable row level security;
create policy alugueis_all on public.alugueis for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','financeiro'])) with check (public.tem_perfil(array['admin','coordenacao','financeiro']));

create trigger trava_edicao_fechada before insert or update or delete on public.alugueis for each row execute function public.trava_edicao_fechada();
create trigger auditar after insert or update or delete on public.alugueis for each row execute function public.auditar_linha();

-- itens abaixo do mínimo (menos os alugados), com o valor previsto para repor
create or replace function public.reposicao_prevista()
returns table (item_id uuid, nome text, setor text, un text, qtd numeric, minimo numeric, preco numeric, cons boolean, falta numeric, previsto numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tem_perfil(array['admin','coordenacao','financeiro','estoque']) then raise exception 'sem_permissao'; end if;
  return query
    select i.id, i.nome, i.setor, i.un, i.qtd, i.min, i.preco, i.cons, (i.min - i.qtd), (i.min - i.qtd) * coalesce(i.preco, 0)
    from public.itens i
    where not i.alugado and i.min > 0 and i.qtd < i.min
    order by i.setor, i.nome;
end $$;
revoke all on function public.reposicao_prevista() from public, anon;
grant execute on function public.reposicao_prevista() to authenticated;

-- compra feita: lança a despesa na edição e soma a quantidade ao estoque (tudo junto)
create or replace function public.confirmar_compra(p_edicao uuid, p_item uuid, p_qtd numeric, p_valor numeric, p_data date default current_date, p_obs text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare it public.itens; v_id uuid;
begin
  if not public.tem_perfil(array['admin','coordenacao','financeiro']) then raise exception 'sem_permissao'; end if;
  if public.edicao_fechada(p_edicao) then raise exception 'edicao_fechada'; end if;
  if p_qtd is null or p_qtd <= 0 or p_valor is null or p_valor < 0 then raise exception 'valor_invalido'; end if;
  select * into it from public.itens where id = p_item and not alugado for update;
  if not found then raise exception 'item_inexistente'; end if;
  insert into public.lancamentos (edicao_id, tipo, descricao, categoria, valor, data, por, setor, origem, item_id, qtd)
    values (p_edicao, 'saida', 'Compra: ' || it.nome || coalesce(' — ' || nullif(trim(p_obs), ''), ''), 'Reposição de estoque', p_valor, p_data, public.eu_id(), it.setor, 'reposicao', it.id, p_qtd)
    returning id into v_id;
  update public.itens set qtd = qtd + p_qtd, atualizado_em = now() where id = it.id;
  insert into public.movimentos (item_id, tipo, qtd, delta, obs, edicao_id, por)
    values (it.id, 'entrada', p_qtd, p_qtd, 'Compra confirmada no financeiro', p_edicao, public.eu_id());
  return v_id;
end $$;
revoke all on function public.confirmar_compra(uuid, uuid, numeric, numeric, date, text) from public, anon;
grant execute on function public.confirmar_compra(uuid, uuid, numeric, numeric, date, text) to authenticated;

-- aluguel pago: vira despesa da edição
create or replace function public.pagar_aluguel(p_aluguel uuid, p_data date default current_date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.alugueis; it public.itens; v_id uuid;
begin
  if not public.tem_perfil(array['admin','coordenacao','financeiro']) then raise exception 'sem_permissao'; end if;
  select * into a from public.alugueis where id = p_aluguel for update;
  if not found then raise exception 'aluguel_inexistente'; end if;
  if public.edicao_fechada(a.edicao_id) then raise exception 'edicao_fechada'; end if;
  if a.lancamento_id is not null then raise exception 'ja_pago'; end if;
  select * into it from public.itens where id = a.item_id;
  insert into public.lancamentos (edicao_id, tipo, descricao, categoria, valor, data, por, setor, origem, item_id, qtd)
    values (a.edicao_id, 'saida', 'Aluguel: ' || it.nome || coalesce(' — ' || nullif(trim(a.fornecedor), ''), ''), 'Aluguel', a.valor, p_data, public.eu_id(), it.setor, 'aluguel', it.id, a.qtd)
    returning id into v_id;
  update public.alugueis set lancamento_id = v_id, atualizado_em = now() where id = a.id;
  return v_id;
end $$;
revoke all on function public.pagar_aluguel(uuid, date) from public, anon;
grant execute on function public.pagar_aluguel(uuid, date) to authenticated;
