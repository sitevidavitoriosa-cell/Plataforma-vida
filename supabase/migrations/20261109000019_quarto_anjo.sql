-- Anjo do quarto (um servo da planilha) e nome do anjo no link do quarto.
alter table public.quartos add column if not exists anjo_id uuid references public.encontristas(id) on delete set null;
-- quarto_info passa a devolver 'anjo' (nome); definição completa em 20261109000012 + campo novo.
