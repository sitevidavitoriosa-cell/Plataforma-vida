-- Crachá: faixa (tarja) atrás do nome, na largura toda, centralizada na altura "y".
alter table public.crachas_cfg
  add column if not exists faixa boolean not null default false,
  add column if not exists faixa_h numeric not null default 16,
  add column if not exists faixa_cor text not null default '#ffffff';
update public.crachas_cfg set faixa = true, y = 50, tam = 8 where id = 1;
