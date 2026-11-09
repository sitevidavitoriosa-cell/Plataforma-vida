-- Edição é uma só escolha: uma rede (Vida Roxa, Vida Azul…), Vida Base, Vida Kids ou Vida BeOne.
-- Pode ser feita junto com outra rede (ex.: Vida Branca e Roxa): campo rede2.
alter table public.edicoes drop constraint edicoes_tipo_check;
alter table public.edicoes alter column tipo set default 'rede';
alter table public.edicoes add constraint edicoes_tipo_check check (tipo in ('rede','base','kids','beone'));
alter table public.edicoes alter column cor drop not null;
alter table public.edicoes alter column cor drop default;
alter table public.edicoes add column rede2 text
  check (rede2 in ('Roxa','Azul','Amarela','Laranja','Vermelha','Verde','Branca'));
alter table public.edicoes add constraint edicoes_cor_tipo check (
  (tipo = 'rede' and cor is not null) or (tipo <> 'rede' and rede2 is null));
