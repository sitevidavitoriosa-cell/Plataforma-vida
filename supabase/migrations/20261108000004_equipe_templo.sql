insert into public.equipes (nome, setores) values ('Templo', array['Templo']);
update public.equipes set nome = 'Som e Intercessão', setores = array['Som','Intercessão'] where nome = 'Som e Templo';
