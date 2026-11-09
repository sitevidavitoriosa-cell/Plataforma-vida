# Vida Vitoriosa – Plataforma de Gestão (versão nova)

Next.js (App Router) + Tailwind + Supabase (projeto `qlnutqoekuwyndooaedp`), hospedado na Vercel.
O site antigo (arquivo único, Firebase) está em `legado/index.html` e serve só de referência de regras e informações.

## Banco
- Migrações em `supabase/migrations/` (já aplicadas, em ordem). Mudança no banco = nova migração numerada.
- Perfis: admin, coordenacao, financeiro, estoque, decisoes, saude, visitante. Equipes ligam pessoas a setores do estoque (`equipes.setores`).
- Regras de acesso (RLS) no próprio banco; o site só esconde o que a pessoa não pode usar.
- Operações de estoque são funções do banco (`definir_envio`, `fechar_balanco`, `definir_estoque`, `copiar_envio`): atômicas e com checagem de permissão.
- Convite: admin cadastra a pessoa -> sistema gera um código -> pessoa abre `/ativar`, digita e-mail + código e cria a senha.
  A Edge Function `ativar` (`supabase/functions/ativar`) cria a conta; não depende de e-mail.
- Link público de Decisões (sem login): só pelas funções `link_info` e `registrar_decisao`.

## Regras
- Português claro; celular em primeiro lugar, completo no computador. Menu de baixo fixo.
- Só a chave publicável do Supabase vai no código (`.env.production`). Nunca chaves secretas.

## Edições (temporadas)
- Tipos: Vida Base, Vida Kids, Vida BeOne. Cada edição tem a cor da rede (Roxa, Azul, Amarela, Laranja, Vermelha, Verde, Branca); o site inteiro usa essa cor como destaque (`EdicaoProvider`, `useEdicao`, `src/lib/cores.ts`).
- A edição escolhida no topo vale para estoque, saúde, encontristas e secretaria.

## Setores (`/setores`, abas por permissão)
- Estoque (geral/enviado/balanço, `src/components/estoque.tsx`, aceita filtro de setor), Saúde, Secretaria 1 e os setores das equipes da pessoa.
- Saúde: só `saude_lista` e `salvar_obs_saude` (admin e perfil saúde). Não lê a ficha.
- Secretaria 1 (`pode_secretaria()`: admin ou equipe com o setor): Crachás (um PNG por rede no bucket privado `crachas`, posição do nome em `crachas_cfg`, PDF com jsPDF), Quartos (`quartos`, `quarto_ocupantes`, distribuição automática por sexo/vagas, PDF por quarto) e Material (estoque do setor). Nomes vêm de `nomes_edicao` (sem saúde/telefone).

## Encontristas (ficha) – só administrador
- Importação da planilha (.xlsx/.csv) em `/encontristas`, pela função `importar_encontristas` (chave: código da inscrição; reimportar atualiza). Só admin importa e vê.
- Tabelas `encontristas`, `encontrista_saude`, `encontrista_espiritual`: RLS só admin. Outros perfis acessam por funções (saúde, nomes).
- Não guardar CPF nem dados de pagamento da planilha.
