-- Ficha de encontristas: dados básicos, saúde e espirituais em tabelas separadas,
-- cada uma com sua regra de acesso (RLS). Importação atômica por função.

-- novo perfil: Saúde
alter table public.pessoas drop constraint if exists pessoas_perfil_check;
alter table public.pessoas add constraint pessoas_perfil_check
  check (perfil in ('admin','coordenacao','financeiro','estoque','decisoes','saude','visitante'));

-- dados básicos (colunas novas na tabela existente)
alter table public.encontristas
  add column email text,
  add column categoria text,
  add column status text,
  add column cancelada boolean not null default false,
  add column data_inscricao timestamptz,
  add column sexo text,
  add column idade int,
  add column estado_civil text,
  add column municipio text,
  add column cep text,
  add column atualizado_em timestamptz not null default now();
alter table public.encontristas
  add constraint encontristas_ed_cod_uq unique (edicao_id, cod);

-- saúde: necessidade (medicamentosa, alimentar, locomoção) e contatos de emergência
create table public.encontrista_saude (
  encontrista_id uuid primary key references public.encontristas(id) on delete cascade,
  tem_necessidade boolean not null default false,
  necessidade text,
  contatos text[] not null default '{}',
  observacao text,
  atualizado_em timestamptz not null default now()
);

-- espiritual
create table public.encontrista_espiritual (
  encontrista_id uuid primary key references public.encontristas(id) on delete cascade,
  batizado boolean,
  igreja text,
  em_celula boolean,
  celula text,
  lider_celula text,
  discipulado text,
  rede text,
  atualizado_em timestamptz not null default now()
);

alter table public.encontrista_saude enable row level security;
alter table public.encontrista_espiritual enable row level security;

-- básicos: ver = admin, coordenação, decisões, saúde; escrever = admin, coordenação
drop policy if exists enc_all on public.encontristas;
create policy enc_sel on public.encontristas for select to authenticated
  using (public.tem_perfil(array['admin','coordenacao','decisoes','saude']));
create policy enc_esc on public.encontristas for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao']))
  with check (public.tem_perfil(array['admin','coordenacao']));

-- saúde: admin, coordenação, saúde
create policy enc_saude_all on public.encontrista_saude for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','saude']))
  with check (public.tem_perfil(array['admin','coordenacao','saude']));

-- espiritual: admin, coordenação, decisões
create policy enc_esp_all on public.encontrista_espiritual for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao','decisoes']))
  with check (public.tem_perfil(array['admin','coordenacao','decisoes']));

-- importação atômica (só admin/coordenação). Atualiza quem já existe pelo código da inscrição.
create or replace function public.importar_encontristas(p_edicao uuid, p_itens jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare
  it jsonb; v_id uuid; v_novos int := 0; v_atual int := 0; v_existia boolean;
begin
  if not public.tem_perfil(array['admin','coordenacao']) then
    raise exception 'sem permissão';
  end if;
  if not exists (select 1 from public.edicoes where id = p_edicao) then
    raise exception 'edição inexistente';
  end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    if coalesce(btrim(it->>'cod'), '') = '' or coalesce(btrim(it->>'nome'), '') = '' then
      continue;
    end if;
    select exists (select 1 from public.encontristas where edicao_id = p_edicao and cod = it->>'cod') into v_existia;
    insert into public.encontristas as e
      (edicao_id, cod, nome, email, fone, endereco, bairro, municipio, cep, sexo, idade,
       estado_civil, categoria, status, cancelada, data_inscricao, atualizado_em)
    values
      (p_edicao, it->>'cod', btrim(it->>'nome'), nullif(it->>'email',''), nullif(it->>'fone',''),
       nullif(it->>'endereco',''), nullif(it->>'bairro',''), nullif(it->>'municipio',''),
       nullif(it->>'cep',''), nullif(it->>'sexo',''), nullif(it->>'idade','')::int,
       nullif(it->>'estado_civil',''), nullif(it->>'categoria',''), nullif(it->>'status',''),
       coalesce((it->>'cancelada')::boolean, false), nullif(it->>'data_inscricao','')::timestamptz, now())
    on conflict (edicao_id, cod) do update set
      nome = excluded.nome, email = excluded.email, fone = excluded.fone, endereco = excluded.endereco,
      bairro = excluded.bairro, municipio = excluded.municipio, cep = excluded.cep, sexo = excluded.sexo,
      idade = excluded.idade, estado_civil = excluded.estado_civil, categoria = excluded.categoria,
      status = excluded.status, cancelada = excluded.cancelada,
      data_inscricao = excluded.data_inscricao, atualizado_em = now()
    returning e.id into v_id;

    -- saúde: não apaga observação escrita pela equipe da Saúde
    insert into public.encontrista_saude (encontrista_id, tem_necessidade, necessidade, contatos)
    values (v_id, coalesce((it->>'tem_necessidade')::boolean, false), nullif(it->>'necessidade',''),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it->'contatos','[]'::jsonb)) x), '{}'))
    on conflict (encontrista_id) do update set
      tem_necessidade = excluded.tem_necessidade, necessidade = excluded.necessidade,
      contatos = excluded.contatos, atualizado_em = now();

    insert into public.encontrista_espiritual (encontrista_id, batizado, igreja, em_celula, celula, lider_celula, discipulado, rede)
    values (v_id, (it->>'batizado')::boolean, nullif(it->>'igreja',''), (it->>'em_celula')::boolean,
      nullif(it->>'celula',''), nullif(it->>'lider_celula',''), nullif(it->>'discipulado',''), nullif(it->>'rede',''))
    on conflict (encontrista_id) do update set
      batizado = excluded.batizado, igreja = excluded.igreja, em_celula = excluded.em_celula,
      celula = excluded.celula, lider_celula = excluded.lider_celula,
      discipulado = excluded.discipulado, rede = excluded.rede, atualizado_em = now();

    if v_existia then v_atual := v_atual + 1; else v_novos := v_novos + 1; end if;
  end loop;
  return json_build_object('novos', v_novos, 'atualizados', v_atual);
end $$;
revoke all on function public.importar_encontristas(uuid, jsonb) from public, anon;
grant execute on function public.importar_encontristas(uuid, jsonb) to authenticated;
