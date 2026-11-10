-- Organizacional como drive completo: subpastas, lixeira, favoritos e links de compartilhamento (pasta ou arquivo).
-- org_areas passa a ser "pasta" (pai_id nulo = área na raiz).

alter table public.org_areas drop constraint if exists org_areas_nome_key;
alter table public.org_areas
  add column if not exists pai_id uuid references public.org_areas(id) on delete cascade,
  add column if not exists apagado_em timestamptz,
  add column if not exists criado_por uuid default auth.uid();
alter table public.org_arquivos
  add column if not exists apagado_em timestamptz,
  add column if not exists atualizado_em timestamptz not null default now();
create unique index if not exists org_areas_nome_pai on public.org_areas (coalesce(pai_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome)) where apagado_em is null;
create index if not exists org_areas_pai on public.org_areas (pai_id);

-- uma pasta não pode ser colocada dentro dela mesma nem de uma subpasta dela
create or replace function public.org_sem_ciclo() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.pai_id is null then return new; end if;
  if new.pai_id = new.id then raise exception 'pasta_em_si_mesma'; end if;
  if tg_op = 'UPDATE' and exists (
    with recursive acima as (
      select id, pai_id from public.org_areas where id = new.pai_id
      union all select a.id, a.pai_id from public.org_areas a join acima on a.id = acima.pai_id)
    select 1 from acima where id = new.id) then
    raise exception 'pasta_em_si_mesma';
  end if;
  return new;
end $$;
drop trigger if exists org_sem_ciclo on public.org_areas;
create trigger org_sem_ciclo before insert or update of pai_id on public.org_areas for each row execute function public.org_sem_ciclo();
revoke all on function public.org_sem_ciclo() from public, anon, authenticated;

-- favoritos (estrela), um conjunto por pessoa
create table if not exists public.org_favoritos (
  usuario uuid not null default auth.uid(),
  tipo text not null check (tipo in ('pasta', 'arquivo')),
  item_id uuid not null,
  primary key (usuario, tipo, item_id)
);
alter table public.org_favoritos enable row level security;
create policy org_fav_sel on public.org_favoritos for select to authenticated using (usuario = (select auth.uid()));
create policy org_fav_ins on public.org_favoritos for insert to authenticated
  with check (usuario = (select auth.uid()) and public.tem_perfil(array['admin','coordenacao','financeiro','estoque','decisoes','saude','admin_edicao','visitante']));
create policy org_fav_del on public.org_favoritos for delete to authenticated using (usuario = (select auth.uid()));

-- links de compartilhamento: de uma pasta (com tudo dentro) ou de um arquivo. Só leitura/baixar.
create table if not exists public.org_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  pasta_id uuid references public.org_areas(id) on delete cascade,
  arquivo_id uuid references public.org_arquivos(id) on delete cascade,
  expira_em timestamptz,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  check ((pasta_id is null) <> (arquivo_id is null))
);
create index if not exists org_links_pasta on public.org_links (pasta_id);
create index if not exists org_links_arquivo on public.org_links (arquivo_id);
alter table public.org_links enable row level security;
create policy org_links_all on public.org_links for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao'])) with check (public.tem_perfil(array['admin','coordenacao']));

-- ajudantes (só o banco usa)
create or replace function public.org_pasta_ativa(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
  with recursive acima as (
    select id, pai_id, apagado_em from public.org_areas where id = p
    union all select a.id, a.pai_id, a.apagado_em from public.org_areas a join acima on a.id = acima.pai_id)
  select exists (select 1 from acima) and not exists (select 1 from acima where apagado_em is not null);
$$;
create or replace function public.org_arvore(p uuid) returns setof uuid language sql stable security definer set search_path = '' as $$
  with recursive abaixo as (
    select id from public.org_areas where id = p and apagado_em is null
    union all select a.id from public.org_areas a join abaixo on a.pai_id = abaixo.id where a.apagado_em is null)
  select id from abaixo;
$$;
revoke all on function public.org_pasta_ativa(uuid), public.org_arvore(uuid) from public, anon, authenticated;

-- o que um link mostra (anon): só o conteúdo coberto pelo link ativo
create or replace function public.org_link_info(p_token text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.org_links; a public.org_arquivos; r public.org_areas;
begin
  select * into l from public.org_links where token = p_token and ativo and (expira_em is null or expira_em > now());
  if not found then return jsonb_build_object('ok', false); end if;
  if l.arquivo_id is not null then
    select * into a from public.org_arquivos where id = l.arquivo_id and apagado_em is null;
    if not found or not public.org_pasta_ativa(a.area_id) then return jsonb_build_object('ok', false); end if;
    return jsonb_build_object('ok', true, 'tipo', 'arquivo', 'nome', a.nome,
      'arquivos', jsonb_build_array(jsonb_build_object('id', a.id, 'nome', a.nome, 'pasta_id', null, 'tamanho', a.tamanho, 'tipo', a.tipo, 'caminho', a.caminho, 'criado_em', a.criado_em)));
  end if;
  select * into r from public.org_areas where id = l.pasta_id and apagado_em is null;
  if not found or not public.org_pasta_ativa(r.id) then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'tipo', 'pasta', 'nome', r.nome, 'raiz', r.id,
    'pastas', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'pai_id', p.pai_id) order by p.nome)
                        from public.org_areas p where p.id in (select public.org_arvore(r.id))), '[]'::jsonb),
    'arquivos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'pasta_id', f.area_id, 'tamanho', f.tamanho, 'tipo', f.tipo, 'caminho', f.caminho, 'criado_em', f.criado_em) order by f.nome)
                          from public.org_arquivos f where f.apagado_em is null and f.area_id in (select public.org_arvore(r.id))), '[]'::jsonb));
end $$;
revoke all on function public.org_link_info(text) from public;
grant execute on function public.org_link_info(text) to anon, authenticated;

-- permite ao link (sem login) gerar o endereço temporário só dos arquivos que ele cobre
create or replace function public.org_caminho_publico(p_caminho text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_links l
    join public.org_arquivos f on f.caminho = p_caminho and f.apagado_em is null
    where l.ativo and (l.expira_em is null or l.expira_em > now())
      and public.org_pasta_ativa(f.area_id)
      and (l.arquivo_id = f.id or (l.pasta_id is not null and f.area_id in (select public.org_arvore(l.pasta_id)))));
$$;
revoke all on function public.org_caminho_publico(text) from public;
grant execute on function public.org_caminho_publico(text) to anon, authenticated;
create policy organizacional_link on storage.objects for select to anon
  using (bucket_id = 'organizacional' and public.org_caminho_publico(name));

-- auditoria dos links e favoritos não é necessária; dos links sim (quem abriu acesso)
drop trigger if exists auditar on public.org_links;
create trigger auditar after insert or update or delete on public.org_links for each row execute function public.auditar_linha();

-- apagar de vez um arquivo/pasta: só admin e coordenação (já coberto pelas políticas existentes)
