-- Crachás: modelo separado para encontristas e servos (com foto), modelo também para Base/Kids/BeOne.
alter table public.crachas_modelos drop constraint if exists crachas_modelos_cor_check;
alter table public.crachas_modelos add column if not exists tipo text not null default 'encontrista' check (tipo in ('encontrista','servo'));
alter table public.crachas_modelos drop constraint crachas_modelos_pkey;
alter table public.crachas_modelos add primary key (cor, tipo);

alter table public.crachas_cfg drop constraint if exists crachas_cfg_id_check;
alter table public.crachas_cfg add constraint crachas_cfg_id_check check (id in (1, 2)); -- 1 = encontristas, 2 = servos
alter table public.crachas_cfg
  add column if not exists fx numeric not null default 50,    -- foto: centro, % da largura
  add column if not exists fy numeric not null default 35,    -- foto: centro, % da altura
  add column if not exists fw numeric not null default 40,    -- foto: largura, % da largura
  add column if not exists fh numeric not null default 30,    -- foto: altura, % da altura
  add column if not exists redonda boolean not null default true;
insert into public.crachas_cfg (id, y) values (2, 62) on conflict do nothing;

create table public.crachas_fotos (
  encontrista_id uuid primary key references public.encontristas(id) on delete cascade,
  arquivo text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.crachas_fotos enable row level security;
create policy cr_fotos_sec on public.crachas_fotos for all to authenticated
  using (public.pode_secretaria()) with check (public.pode_secretaria());
