-- Organizacional: um "drive" com as áreas do Vida Vitoriosa (pastas) e os arquivos de cada uma (manuais, roteiros etc.).
-- Ler: todos os perfis do site (menos Secretaria 1, que só usa a própria equipe). Subir, renomear e apagar: administrador e coordenação.

create table public.org_areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now()
);
create table public.org_arquivos (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.org_areas(id) on delete cascade,
  nome text not null,
  caminho text not null,
  tamanho bigint not null default 0,
  tipo text,
  criado_por uuid,
  criado_em timestamptz not null default now()
);
create index on public.org_arquivos (area_id);

alter table public.org_areas enable row level security;
alter table public.org_arquivos enable row level security;

create policy org_areas_sel on public.org_areas for select to authenticated
  using (public.tem_perfil(array['admin','coordenacao','financeiro','estoque','decisoes','saude','admin_edicao','visitante']));
create policy org_areas_esc on public.org_areas for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao'])) with check (public.tem_perfil(array['admin','coordenacao']));
create policy org_arquivos_sel on public.org_arquivos for select to authenticated
  using (public.tem_perfil(array['admin','coordenacao','financeiro','estoque','decisoes','saude','admin_edicao','visitante']));
create policy org_arquivos_esc on public.org_arquivos for all to authenticated
  using (public.tem_perfil(array['admin','coordenacao'])) with check (public.tem_perfil(array['admin','coordenacao']));

-- áreas iniciais: os setores que já existem no estoque + Saúde, Secretaria 1 e uma pasta Geral
insert into public.org_areas (nome)
  select distinct setor from public.itens
  union select 'Saúde' union select 'Secretaria 1' union select 'Geral'
  on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit) values ('organizacional', 'organizacional', false, 52428800) on conflict do nothing;
create policy organizacional_sel on storage.objects for select to authenticated
  using (bucket_id = 'organizacional' and public.tem_perfil(array['admin','coordenacao','financeiro','estoque','decisoes','saude','admin_edicao','visitante']));
create policy organizacional_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'organizacional' and public.tem_perfil(array['admin','coordenacao']));
create policy organizacional_del on storage.objects for delete to authenticated
  using (bucket_id = 'organizacional' and public.tem_perfil(array['admin','coordenacao']));
