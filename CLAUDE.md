# Vida Vitoriosa – Plataforma de Gestão (versão nova)

Next.js (App Router) + Tailwind + Supabase (projeto `qlnutqoekuwyndooaedp`), hospedado na Vercel.
O site antigo (arquivo único, Firebase) está em `legado/index.html` e serve só de referência de regras e informações.

## Banco
- Migrações em `supabase/migrations/` (já aplicadas, em ordem). Mudança no banco = nova migração numerada.
- Perfis: admin, admin_edicao, coordenacao, financeiro, estoque, decisoes, saude, visitante. `admin_edicao` enxerga e altera só as edições ligadas a ele (`pessoa_edicoes`, `pode_edicao()`): ficha, saúde, secretaria, decisões, envio de material/balanço e relatório; não mexe em pessoas, equipes, edições nem financeiro. Equipes ligam pessoas a setores do estoque (`equipes.setores`).
- Regras de acesso (RLS) no próprio banco; o site só esconde o que a pessoa não pode usar.
- Operações de estoque são funções do banco (`definir_envio`, `fechar_balanco`, `definir_estoque`, `copiar_envio`): atômicas e com checagem de permissão.
- Convite: admin cadastra a pessoa -> sistema gera um código -> pessoa abre `/ativar`, digita e-mail + código e cria a senha.
  A Edge Function `ativar` (`supabase/functions/ativar`) cria a conta; não depende de e-mail.
- Link público de Decisões (sem login): só pelas funções `link_info` e `registrar_decisao`.

## Regras
- Português claro; celular em primeiro lugar, completo no computador. Menu de baixo fixo.
- Só a chave publicável do Supabase vai no código (`.env.production`). Nunca chaves secretas.

## Edições (temporadas)
- Tipos: Vida Base, Vida Kids, Vida BeOne. Uma edição é uma rede (Vida Roxa, Azul, Amarela, Laranja, Vermelha, Verde, Branca), ou Vida Base, Vida Kids, Vida BeOne; pode ser junto com outra rede (`rede2`, ex.: Vida Branca e Roxa). Visual: redes na própria cor (Branca = cinza), Base azul+amarelo, Kids azul+roxo, BeOne preto e branco (`EdicaoProvider`, `src/lib/cores.ts`).
- A edição escolhida no topo vale para estoque, saúde, encontristas e secretaria.

## Estoque (`/estoque`) e Equipes (`/setores`, aba "Equipes")
- **Estoque** (`src/components/estoque.tsx`) é só do paiol (admin, coordenação, estoque; admin de edição nas edições dele): Geral (itens por setor), Enviado (registra o envio por edição) e Balanço (confere). O material que as equipes usam fica no estoque geral e quem administra é o paiol.
- **Equipes** (Saúde, Secretaria 1 e demais setores): o servo vê só o que o paiol enviou para a equipe dele (`Estoque setor=...`, modo equipe). No Balanço informa o que voltou (nunca mais que o levado) e envia ao paiol (`salvar_volta`, `enviar_balanco`). O paiol confere e confirma (`conferir_balanco`, `reabrir_balanco`, `fechar_balanco`); só aí o estoque geral muda. Servo de setor não vê itens/envios de outros setores (RLS `ve_todo_estoque()`), nem envia material (`definir_envio` só `eh_paiol`).
- Saúde: só `saude_lista` e `salvar_obs_saude` (admin e perfil saúde). Não lê a ficha.
- Secretaria 1 (`pode_secretaria()`): Crachás (modelo PNG por rede/edição para encontristas e outro para servos com foto; fotos em `crachas_fotos`), Quartos (cadastro manual ou importação de planilha; link secreto por quarto `/q/[token]` com perfil dos encontristas, função `quarto_info`) e Material (equipe). Nomes vêm de `nomes_edicao` (sem saúde/telefone).

## Encontristas (ficha) – só administrador
- Importação da planilha (.xlsx/.csv) em `/encontristas`, pela função `importar_encontristas` (chave: código da inscrição; reimportar atualiza). Só admin importa e vê.
- Tabelas `encontristas`, `encontrista_saude`, `encontrista_espiritual`: RLS só admin. Outros perfis acessam por funções (saúde, nomes).
- Não guardar CPF nem dados de pagamento da planilha.

## Relatório geral (`/relatorio`, cartão no Painel)
- Materiais por setor, pessoas e decisões da edição escolhida. Saídas: imprimir/PDF, Excel (`xlsx`) e apresentação PowerPoint (`pptxgenjs`, tema da edição). Pessoas só para quem vê a ficha.
- Estoque: importação do inventário (.xls/.xlsx) em `src/lib/inventario.ts`.

## Decisões e Financeiro
- Decisões (`/decisoes`): botões por edição (`decisoes_cfg`), lista por `decisoes_lista`, link de registro em `registro_links`. Página pública sem login em `/r/[token]` (só `link_info` e `registrar_decisao`; nomes dos encontristas, sem telefone/endereço). Gerar novo link desliga o anterior.
- Financeiro (`/financeiro`): lançamentos por edição (entrada/saída), categoria, setor e comprovante no bucket privado `comprovantes`; exportação em Excel. Acesso: admin, coordenação, financeiro.
