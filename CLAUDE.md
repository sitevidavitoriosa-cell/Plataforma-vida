# Vida Vitoriosa – Plataforma de Gestão (versão nova)

Next.js (App Router) + Tailwind + Supabase (projeto `qlnutqoekuwyndooaedp`), hospedado na Vercel.
O site antigo (arquivo único, Firebase) está em `legado/index.html` e serve só de referência de regras e informações.

## Banco
- Migrações em `supabase/migrations/` (já aplicadas, em ordem). Mudança no banco = nova migração numerada.
- Perfis: admin, admin_edicao, coordenacao, financeiro, estoque, decisoes, saude, secretaria1, visitante. `secretaria1` acessa só a Secretaria 1 (crachás, quartos, encontristas via `secretaria_encontristas`, saúde só leitura, material do setor); sem Painel, edições, financeiro ou estoque geral. `admin_edicao` enxerga e altera só as edições ligadas a ele (`pessoa_edicoes`, `pode_edicao()`): ficha, saúde, secretaria, decisões, envio de material/balanço e relatório; não mexe em pessoas, equipes, edições nem financeiro. Equipes ligam pessoas a setores do estoque (`equipes.setores`).
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
- A edição escolhida no topo vale para estoque, saúde, encontristas e secretaria. A opção **"Todas as edições"** (só admin e estoque; `todas` em `useEdicao`, `ed = null`) vale para: Painel (visão geral), Estoque (**lista mãe**) e Relatório (**relatório anual**, só admin). As demais páginas pedem para escolher uma edição (`EscolhaEdicao` no shell).

## Estoque (`/estoque`) e Equipes (`/setores`)
- **Lista mãe** = tabela `itens` (um saldo único, base do retiro). Em **Todas as edições**: itens divididos em **Consumíveis** (`cons = true`; comprar quando abaixo do mínimo, com "Copiar lista de compras") e **Não consumíveis** (voltam depois), compras/entradas (`definir_estoque`) e importação do inventário (`src/lib/inventario.ts`). Dentro de uma **edição**: aba "Retirada da lista mãe" (`definir_envio` tira da lista mãe, `copiar_envio` copia da última edição) e "Balanço (volta)" (o que sobrou volta para a lista mãe só após `conferir_balanco`/`fechar_balanco`). Estoque é só do paiol (admin e estoque; admin de edição nas edições dele).
- **Equipes** são só **Saúde** e **Secretaria 1** (`entradasSetores`). O material da Secretaria 1 fica em Secretaria 1 › Material (modo equipe: `salvar_volta`, `enviar_balanco`; RLS `ve_todo_estoque()`).
- Saúde (`src/components/saude.tsx`): consulta rápida de emergência (nome, quarto, necessidade e contatos direto no card, com WhatsApp). `saude_lista` (admin, saúde, secretaria1, admin de edição) já devolve o `quarto`. Exporta PDF para imprimir (A4 paisagem, `src/lib/saudePdf.ts`) e Excel. `salvar_obs_saude` e `excluir_da_saude`. Não lê a ficha.
- Secretaria 1 (`pode_secretaria()`): Crachás (modelo PNG por rede/edição para encontristas e outro para servos com foto; fotos em `crachas_fotos`), Quartos (a planilha só é importada em Encontristas; aqui cria-se o quarto: número, sexo, vagas, anjos [`quarto_anjos`], busca/marca dos encontristas) e Material. Nomes vêm de `nomes_edicao`.
- **Link único dos quartos**: um por edição (`quartos_link_edicao`, funções `link_quartos`, `renovar_link_quartos`, `desligar_link_quartos`; botão "Link dos quartos" em Quartos e na Saúde). Página pública `/q/[token]` (função anon `quartos_edicao_info`, noindex): card de cada quarto com anjos e encontristas, busca por nome, perfil e saúde. Os links antigos por quarto (`quarto_links`) foram desligados.

## Painel (`/`)
- Enxuto: edição (ou visão geral em Todas as edições) e atalhos por permissão. Os números dos encontristas (totais, perfil espiritual, redes) ficam em **Encontristas** (`DashboardEncontristas`). Os gráficos de pizza e de linha de inscrições existem só nos relatórios.

## Encontristas (ficha) – só administrador
- Importação da planilha (.xlsx/.csv) em `/encontristas`, pela função `importar_encontristas` (chave: código da inscrição; reimportar atualiza). Só admin importa e vê.
- Tabelas `encontristas`, `encontrista_saude`, `encontrista_espiritual`: RLS só admin. Outros perfis acessam por funções (saúde, nomes).
- Não guardar CPF nem dados de pagamento da planilha.

## Relatório geral (`/relatorio`, cartão no Painel)
- Materiais por setor, pessoas e decisões da edição escolhida; em "Todas as edições" vira o relatório anual (`src/components/relatorioAnual.tsx`, só admin; `/relatorio-anual` apenas redireciona). Saídas: imprimir/PDF, Excel (`xlsx`) e apresentação PowerPoint (`pptxgenjs`, tema da edição). Pessoas só para quem vê a ficha.
- Estoque: importação do inventário (.xls/.xlsx) em `src/lib/inventario.ts`.

## Decisões e Financeiro
- Decisões (`/decisoes`): botões por edição (`decisoes_cfg`), lista por `decisoes_lista`, link de registro em `registro_links`. Página pública sem login em `/r/[token]` (só `link_info` e `registrar_decisao`; nomes dos encontristas, sem telefone/endereço). Gerar novo link desliga o anterior.
- Financeiro (`/financeiro`): lançamentos por edição (entrada/saída), categoria, setor e comprovante no bucket privado `comprovantes`; exportação em Excel. Acesso: admin, coordenação, financeiro.
