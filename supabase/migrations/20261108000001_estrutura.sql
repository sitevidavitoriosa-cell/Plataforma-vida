-- Vida Vitoriosa - Plataforma de Gestão: estrutura (tabelas)

create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  email text not null,
  perfil text not null default 'visitante'
    check (perfil in ('admin','coordenacao','financeiro','estoque','decisoes','visitante')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index pessoas_email_uk on public.pessoas (lower(email));

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  setores text[] not null default '{}'
);

create table public.equipe_membros (
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  equipe_id uuid not null references public.equipes(id) on delete cascade,
  primary key (pessoa_id, equipe_id)
);

create table public.edicoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_ini date,
  data_fim date,
  local text,
  enc integer not null default 0,
  status text not null default 'aberta' check (status in ('aberta','fechada')),
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create table public.itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  setor text not null,
  un text not null default 'un',
  qtd numeric not null default 0,
  min numeric not null default 0,
  cons boolean not null default false,
  preco numeric not null default 0,
  obs text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index itens_setor_idx on public.itens (setor);

create table public.movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.itens(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  qtd numeric not null,
  obs text,
  edicao_id uuid references public.edicoes(id) on delete set null,
  por uuid references public.pessoas(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index movimentos_item_idx on public.movimentos (item_id);

create table public.envios (
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  item_id uuid not null references public.itens(id) on delete cascade,
  env numeric not null default 0,
  comp numeric not null default 0,
  volta numeric,
  aplicado boolean not null default false,
  primary key (edicao_id, item_id)
);

create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid references public.edicoes(id) on delete set null,
  tipo text not null check (tipo in ('entrada','saida')),
  descricao text not null,
  categoria text,
  valor numeric not null default 0,
  data date not null default current_date,
  por uuid references public.pessoas(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.encontristas (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  nome text not null,
  cod text,
  fone text,
  endereco text,
  bairro text,
  criado_em timestamptz not null default now()
);
create index encontristas_ed_idx on public.encontristas (edicao_id);

create table public.decisoes_cfg (
  edicao_id uuid primary key references public.edicoes(id) on delete cascade,
  botoes jsonb not null default '[]'::jsonb
);

create table public.decisoes (
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  encontrista_id uuid not null references public.encontristas(id) on delete cascade,
  botao text not null,
  criado_em timestamptz not null default now(),
  primary key (edicao_id, encontrista_id, botao)
);

create table public.registro_links (
  token text primary key default encode(gen_random_bytes(18), 'hex'),
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  nome text,
  ativo boolean not null default true,
  criado_por uuid references public.pessoas(id) on delete set null,
  criado_em timestamptz not null default now()
);
