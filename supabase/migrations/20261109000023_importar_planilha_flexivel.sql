-- Importar planilha flexível: só atualiza as colunas que vieram na planilha (chaves presentes no JSON).
-- Planilha sem saúde/espiritual não apaga nem zera o que já estava cadastrado.
create or replace function public.importar_encontristas(p_edicao uuid, p_itens jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare
  it jsonb; v_id uuid; v_novos int := 0; v_atual int := 0; v_existia boolean;
begin
  if not public.pode_edicao(p_edicao) then raise exception 'sem permissão'; end if;
  if not exists (select 1 from public.edicoes where id = p_edicao) then raise exception 'edição inexistente'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    if coalesce(btrim(it->>'cod'), '') = '' or coalesce(btrim(it->>'nome'), '') = '' then continue; end if;
    select exists (select 1 from public.encontristas where edicao_id = p_edicao and cod = it->>'cod') into v_existia;
    insert into public.encontristas as e
      (edicao_id, cod, nome, email, fone, endereco, bairro, municipio, cep, sexo, idade,
       estado_civil, categoria, status, cancelada, data_inscricao, atualizado_em)
    values
      (p_edicao, it->>'cod', btrim(it->>'nome'), nullif(it->>'email',''), nullif(it->>'fone',''),
       nullif(it->>'endereco',''), nullif(it->>'bairro',''), nullif(it->>'municipio',''),
       nullif(it->>'cep',''), nullif(it->>'sexo',''), nullif(it->>'idade','')::int,
       nullif(it->>'estado_civil',''), coalesce(nullif(it->>'categoria',''), 'Encontrista'), nullif(it->>'status',''),
       coalesce((it->>'cancelada')::boolean, false), nullif(it->>'data_inscricao','')::timestamptz, now())
    on conflict (edicao_id, cod) do update set
      nome = excluded.nome,
      email = case when it ? 'email' then nullif(it->>'email','') else e.email end,
      fone = case when it ? 'fone' then nullif(it->>'fone','') else e.fone end,
      endereco = case when it ? 'endereco' then nullif(it->>'endereco','') else e.endereco end,
      bairro = case when it ? 'bairro' then nullif(it->>'bairro','') else e.bairro end,
      municipio = case when it ? 'municipio' then nullif(it->>'municipio','') else e.municipio end,
      cep = case when it ? 'cep' then nullif(it->>'cep','') else e.cep end,
      sexo = case when it ? 'sexo' then nullif(it->>'sexo','') else e.sexo end,
      idade = case when it ? 'idade' then nullif(it->>'idade','')::int else e.idade end,
      estado_civil = case when it ? 'estado_civil' then nullif(it->>'estado_civil','') else e.estado_civil end,
      categoria = case when it ? 'categoria' then nullif(it->>'categoria','') else e.categoria end,
      status = case when it ? 'status' then nullif(it->>'status','') else e.status end,
      cancelada = case when it ? 'cancelada' then coalesce((it->>'cancelada')::boolean, false) else e.cancelada end,
      data_inscricao = case when it ? 'data_inscricao' then nullif(it->>'data_inscricao','')::timestamptz else e.data_inscricao end,
      atualizado_em = now()
    returning e.id into v_id;

    insert into public.encontrista_saude as s (encontrista_id, tem_necessidade, necessidade, contatos)
    values (v_id, coalesce((it->>'tem_necessidade')::boolean, false), nullif(it->>'necessidade',''),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it->'contatos','[]'::jsonb)) x), '{}'))
    on conflict (encontrista_id) do update set
      tem_necessidade = case when it ? 'tem_necessidade' then coalesce((it->>'tem_necessidade')::boolean, false) else s.tem_necessidade end,
      necessidade = case when it ? 'necessidade' then nullif(it->>'necessidade','') else s.necessidade end,
      contatos = case when it ? 'contatos' then coalesce((select array_agg(x) from jsonb_array_elements_text(it->'contatos') x), '{}') else s.contatos end,
      atualizado_em = now();

    insert into public.encontrista_espiritual as p (encontrista_id, batizado, igreja, em_celula, celula, lider_celula, discipulado, rede)
    values (v_id, (it->>'batizado')::boolean, nullif(it->>'igreja',''), (it->>'em_celula')::boolean,
      nullif(it->>'celula',''), nullif(it->>'lider_celula',''), nullif(it->>'discipulado',''), nullif(it->>'rede',''))
    on conflict (encontrista_id) do update set
      batizado = case when it ? 'batizado' then (it->>'batizado')::boolean else p.batizado end,
      igreja = case when it ? 'igreja' then nullif(it->>'igreja','') else p.igreja end,
      em_celula = case when it ? 'em_celula' then (it->>'em_celula')::boolean else p.em_celula end,
      celula = case when it ? 'celula' then nullif(it->>'celula','') else p.celula end,
      lider_celula = case when it ? 'lider_celula' then nullif(it->>'lider_celula','') else p.lider_celula end,
      discipulado = case when it ? 'discipulado' then nullif(it->>'discipulado','') else p.discipulado end,
      rede = case when it ? 'rede' then nullif(it->>'rede','') else p.rede end,
      atualizado_em = now();
    if v_existia then v_atual := v_atual + 1; else v_novos := v_novos + 1; end if;
  end loop;
  return json_build_object('novos', v_novos, 'atualizados', v_atual);
end $$;
