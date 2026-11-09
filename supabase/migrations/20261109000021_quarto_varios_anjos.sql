-- Um quarto pode ter mais de um anjo (quem dorme no quarto e quem supervisiona). Um servo só é anjo de um quarto.
create table public.quarto_anjos (
  encontrista_id uuid primary key references public.encontristas(id) on delete cascade,
  quarto_id uuid not null references public.quartos(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index on public.quarto_anjos (quarto_id);
alter table public.quarto_anjos enable row level security;
create policy quarto_anjos_sec on public.quarto_anjos for all to authenticated
  using (public.pode_secretaria()) with check (public.pode_secretaria());
insert into public.quarto_anjos (encontrista_id, quarto_id) select anjo_id, id from public.quartos where anjo_id is not null on conflict do nothing;
drop index if exists public.quartos_anjo_unico;
alter table public.quartos drop column if exists anjo_id;
-- quarto_info passa a devolver 'anjos' (lista de nomes) no lugar de 'anjo'.
