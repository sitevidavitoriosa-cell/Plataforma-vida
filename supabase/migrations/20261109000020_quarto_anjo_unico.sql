-- Um servo só pode ser anjo de um quarto.
create unique index if not exists quartos_anjo_unico on public.quartos (anjo_id) where anjo_id is not null;
