-- Caixas de autorização por pessoa (só no site, dentro do perfil): restringem o que a pessoa vê/edita.
-- A trava real continua sendo as regras de acesso (RLS) por perfil; esta coluna só pode tirar acesso no site, nunca dar mais.
alter table public.pessoas add column if not exists permissoes jsonb;
comment on column public.pessoas.permissoes is 'Restrições feitas no site dentro do perfil: {"ver":[módulos],"editar":[módulos]}. Nulo = padrão do perfil.';

create or replace function public.meu_acesso()
 returns json language sql stable security definer set search_path to ''
as $function$
  select json_build_object(
    'id', p.id, 'nome', p.nome, 'email', p.email, 'perfil', p.perfil, 'permissoes', p.permissoes,
    'equipes', coalesce((select json_agg(json_build_object('nome', e.nome, 'setores', e.setores))
      from public.equipe_membros m join public.equipes e on e.id = m.equipe_id where m.pessoa_id = p.id), '[]'::json),
    'edicoes', coalesce((select json_agg(pe.edicao_id) from public.pessoa_edicoes pe where pe.pessoa_id = p.id), '[]'::json))
  from public.pessoas p where p.user_id = (select auth.uid()) and p.ativo
$function$;
