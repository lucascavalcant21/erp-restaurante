# Decisões de produto

## DP-001 — Quem abre a Central de Inteligência

- `dashboard.intelligence.view`: dono, super admin e gerente-geral (`dashboard.*`).
- Configurações (metas, alertas): `dashboard.intelligence.settings`.
- **Não liberar para todos os funcionários.** Validado no banco real em 07/10: somente-consulta e cozinheiro recebem 403.

## DP-002 — Metas são do dono, nunca inventadas

A meta mensal é digitada por gente. O sistema só **sugere** a distribuição por dia (selo SUGESTÃO). O atingimento é o faturamento real ÷ meta.

## DP-003 — Três alertas em destaque

A Central mostra os três mais relevantes, por criticidade × impacto × confiança. Perguntas do Héfisto só quando só a equipe sabe a resposta. O feedback vira dado estruturado.

## DP-004 — Copilot legado escondido, não apagado

As páginas antigas (piloto, saúde, auditoria do Héfisto) saíram da busca. O código ficou: apagar é uma decisão separada.

## DP-005 — Reservas & Eventos e orçamento de buffet exigem permissão de eventos (07/10/2026)

Antes, qualquer funcionário abria essas telas, inclusive o custo das fichas no orçamento. Agora:
- `eventos.overview` cobre a visão geral, a agenda e os contatos;
- `eventos.quote` cobre o orçamento de buffet.

Somente-consulta perdeu esse acesso.

## DP-006 — O agente pode trabalhar 24 horas por dia (08/10/2026)

- **Decisão do dono:** "não precisa ser só à noite, pode ser o dia todo, 24h por dia".
- **Como ficou:** `npm run hefisto:continuo`. Sem missão READY, ele espera e confere de novo.
  - Limite do plano: espera o plano voltar, sem contar falha na missão (DP-007).
  - Parar: `npm run hefisto:parar`.
- **Permissões:** as mesmas da noite (conectores só leitura, DA-007).

## DP-007 — Só o plano do claude.ai, nunca dinheiro a mais (08/10/2026)

- **Decisão do dono:** "quando acabar o limite, ele não pode usar dinheiro para mais limite; tem que aguardar os tokens do plano voltarem".
- **Como ficou** (`scripts/hefisto-agent`):
  - o motor roda sem `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` nem as variáveis de Bedrock, Vertex e Foundry;
  - o runner lê o `stream-json` ao vivo:
    - fonte paga no início (`apiKeySource`): mata o motor e para;
    - `isUsingOverage`: mata na hora;
    - plano em 97% com uso extra ligado ou desconhecido: para antes de cobrar;
    - `status: rejected`: limite atingido;
  - a missão volta para READY sem tentativa;
  - o runner espera até o `resetsAt` informado (status `plano_volta_em`) e continua.
- **Garantia definitiva:** créditos de uso desligados em claude.ai → Configurações → Uso. Fonte: suporte da Anthropic, "extra usage for paid Claude plans".
- **Teto de gasto por dia:** desligado (`maxCustoPorDiaUsd: 0`). O custo que o Claude Code informa no plano é estimativa, não cobrança.
- **Evidência:**
  - TESTADO LOCAL: testes com motor falso (uso extra mata em menos de 15 s; a chave de API não chega ao motor);
  - TESTADO LOCAL com o Claude Code 2.1.294 real:
    - o `hefisto:preparar` mostrou "plano do claude.ai", "98% usado, volta às 19:30" e o estado do uso extra;
    - o formato do `rate_limit_event` foi conferido (com e sem `overageStatus`).

## Pendentes de decisão do dono

- **Agente com escrita em produção** (pedido de 08/10: aplicar migração, escrever no banco, branches do Supabase, deploy, promover e reverter, ver e mudar variáveis de ambiente).
  - A verificação de segurança automática da sessão de desenvolvimento recusou a mudança, por dar a um agente sem supervisão poder de deploy e escrita em produção.
  - Para seguir, o dono precisa confirmar com a sessão em modo Auto.
  - Desenho proposto: a guarda continua recusando DROP, TRUNCATE, DELETE/UPDATE sem WHERE, desligar RLS, policy aberta, auth.* e segredo em NEXT_PUBLIC_.


- **Correção de RLS crítico:** colaboradores, registro de ponto e tabelas multiempresa. Ver [[HDEV-008]] e BLQ-005.
- **Merge do PR #127 para produção:** BLQ-004.
- **Rotina noturna na nuvem:** custo por rodada definido em `scripts/hefisto-agent/config.json` (`--max-budget-usd`).

## DP — Design system branco e dourado (31/10/2026, decisão do dono)

Substitui as decisões de 11/10 ("sem fundo preto"), 27/10 (fundo cinza) e 29/10 (menu claro e verde):
- menu grafite #202124;
- dourado #C5A15A como cor principal (botões, seleção, item ativo), com texto escuro por cima;
- fundo e cards brancos, blocos internos #F7F7F8, bordas #E5E7EB, texto #252525;
- verde só para estado positivo; vermelho e âmbar só para estado real.
- O menu do topo é a fonte única das telas (app/lib/menu-principal.mjs).

## DP — Treinamento por função e Héfisto Estúdio (04/11/2026, decisão do dono)

- Cada pessoa entra com a própria conta. O líder coloca a pessoa na trilha da função.
- Aprovação em três etapas: aulas, prova com situações (80% ou mais, corrigida no banco) e avaliação prática do líder.
- O conteúdo nasce como rascunho e só chega à equipe depois de aprovado no Héfisto Estúdio.
- Os bonecos são personagens próprios. A voz é a do aparelho, sem custo por uso.
- As falas da IA são sugestões: a IA só reescreve o texto da aula, e número que não está no texto é recusado.
- Pratos e drinks mostram a ficha real. O Héfisto não inventa receita: sem preparo escrito, aparece como pendência.
## DP — Marmitaria: ficha só com custo, preço no Cardápio (05/11/2026, decisão do dono)

- **Ficha técnica** mostra só o custo (comida + embalagem). Preço, taxas e lucro ficam no **Cardápio**, por plataforma.
- **Ingrediente novo** nasce só no cadastro do sistema. A marmitaria mantém o cadastro de **embalagens**.
- **Lucro = o que o cliente paga − imposto − taxas da plataforma − custo da ficha − equipe − custos fixos.** Equipe e fixos são o valor do mês ÷ marmitas por mês (ESTIMATIVA); bebida e sobremesa não carregam essa parte.
- Base da conta: o último mês fechado do DRE da marmitaria. O que o dono digita em Configurações vale sobre o sistema.
- **Taxa em branco não é zero:** sem as taxas da plataforma, ou sem imposto definido, o Cardápio não mostra lucro.
- **MEI:** imposto sobre venda 0%. O regime e os custos mensais ficam em `marmitaria_configuracoes.rateio` (jsonb), sem migração. Vale `regime = "mei"` e `tributos_pct = 0`.
- Plataformas: iFood, 99 (`99food`), Keeta e Balcão; WhatsApp e outras entram por botão. Só a comissão do balcão nasce zerada.
- Rotas novas ficam sob `/dashboard/marmitaria/marmitas/` para herdar a permissão `marmitaria.recipes`.

## DP — Marmitaria: modelo da loja e painel de lucro (05/11/2026, decisão do dono)

- **Modelo da loja:** segue a ordem Mais pedidos, Combos, Marmitas de frango, Marmitas de carne, Sobremesas, Refrigerantes e Sucos. Mais pedidos sai só de vendas lançadas nos últimos 30 dias; sem venda, fica vazio.
- **Mudança de custo:** compara o primeiro preço do histórico nos últimos 30 dias com o preço de hoje (`insumos_precos_historico`). O preço de venda fica igual, então a diferença de custo sai direto do lucro.
- **Painel:** usa as mesmas linhas do Cardápio. "O que mais rendeu" = vendas reais × lucro de hoje (ESTIMATIVA).
- **Sugestões:** testam as combinações com preço e custo, com o mesmo desconto sobre a soma. O alvo é a meta de lucro ou, sem meta, a média dos pratos. Combo sem marmita não carrega equipe nem custos fixos.
- **Simulador de vendas:** equipe e custos fixos entram uma vez no mês, não por marmita, porque não crescem com a venda. Por isso o lucro simulado pode ser diferente de "lucro por marmita × quantidade". Avisa quando o faturamento anual passa do limite do MEI (LC 238/2026: R$ 81 mil em 2026, R$ 110 mil em 2027, R$ 140 mil em 2028).

## DP — Compras e produção exclusivas da marmitaria (05/11/2026, decisão do dono)

- **Exclusivo:** compras, estoque e produção usam só os locais `marmitaria`, `embalagens-marmitaria` e `producao-marmitaria`. A função da produção recusa baixar de outro local.
- **Pedido:** é um rascunho em `compras`, com a previsão de chegada em `data_recebimento`. Ao receber, grava o que chegou, a data real e chama `compras_confirmar`.
- **Conta a pagar:** não é gerada na compra da marmitaria, para não cair no financeiro do restaurante. Falta o dono decidir como lançar.
- **Estoque:** só retira. A entrada vem da compra e da produção.
- **Subproduto:** é uma ficha de pré-preparo. Cada tipo é uma ficha própria (frango empanado na panko, no trigo, só temperado). O estoque fica em `producao-marmitaria`.
- **As RPCs `iniciar_producao_lote` e `finalizar_producao_lote` não são usadas:** baixam de `estoque_atual`, que é legado.
- **Plano:** uma linha por dia em `marmitaria_planos_operacionais` com `periodo_tipo = 'cozinha'`.
- **Preço aberto:** a tela mostra markup em % (300% = 4 vezes o custo) e divide o preço em CMV, embalagens, CMO por funcionário, custos fixos por conta, taxas, impostos e lucro. As contas ficam em `rateio.custos_fixos`.
- **Pró-labore:** é uma conta própria entre os custos fixos, não entra no CMO.
- **Processos:** ficam em `config_sistema.params.marmitaria_processos`, por ficha, com as embalagens que servem e as etapas.
- **Embalagens e limpeza:** cada uma com estoque próprio da marmitaria (`embalagens-marmitaria`, `limpeza-marmitaria`).

## DP — Marmitaria é uma unidade própria (05/11/2026, decisão do dono)

- A marmitaria é uma empresa separada: unidade `marmitaria`, na mesma `empresa_id`, regime MEI.
- Começa vazia: cadastros e fichas próprios. Nada do restaurante é copiado ou movido. Substitui a decisão de usar o cadastro do sistema.
- Uma senha só para entrar e sair, em `estoque_seguranca` (hash e bloqueio por tentativas). A trava de tela prende o aparelho; a proteção dos dados é a separação por unidade.
- Funcionário precisa ter a unidade `marmitaria` como principal ou em `usuario_escopos`.
- Na unidade própria, toda conta entra inteira no resultado da marmitaria (`centros_diretos = ["*"]`), sem rateio, e a compra recebida gera a conta a pagar dela. O PR #172 (outubro) tinha a mesma ideia, mas não foi mesclado e tem histórico separado.
- **Acesso pela senha:** o dono passa a senha e não configura cada usuário. Com a senha certa, o usuário ativo da mesma empresa recebe o escopo da unidade `marmitaria`, que continua depois de sair. `hefisto_user_can` libera `estoque.*` só nessa unidade, menos segurança e cancelamento de compra. Quem tem a senha vê tudo da marmitaria, inclusive custos e DRE.

## DP — Marmitaria: etiqueta no recebimento da compra (05/11/2026, decisão do dono)

- Colocou validade e lançou no estoque: a etiqueta do produto sai junto. Sem validade, não sai etiqueta.
- A etiqueta é registrada com quantidade 0, porque o estoque já recebeu pela compra e `criarEtiqueta` somaria de novo.
- Saída: MDK-022 por USB se já estiver pareada, térmica Bluetooth se estiver conectada; senão, a impressão do aparelho.
- O navegador só pede permissão de USB em um toque da pessoa. O primeiro pareamento é feito em "Imprimir de novo".
- O iPhone não tem USB nem Bluetooth no navegador: de lá só sai por impressão do aparelho (AirPrint).

## DP — Marmitaria: funcionário nasce na marmitaria (05/11/2026, decisão do dono)

- O funcionário é cadastrado na tela Equipe da marmitaria, na unidade `marmitaria`, com 100% do custo nela.
- Continua na tabela oficial `colaboradores`, para ponto e recibos funcionarem. Não há cadastro paralelo.
- Sai a alocação compartilhada com o restaurante nessa tela: são empresas separadas.
- Cadastrar exige permissão de RH na unidade. Quem só entra com a senha da marmitaria não cria funcionário.

## DP — Três negócios e acesso por login (05/11/2026, decisão do dono)

- Restaurante, marmitaria e eventos são negócios diferentes, sem relação entre si: cada um com RH, ingredientes e fichas próprios.
- A senha única da marmitaria saiu por dar problema. Substitui a decisão anterior de entrada e saída por senha.
- Acesso pelo login: em Configurações > Usuários, o dono escolhe as páginas. Login só da marmitaria usa Unidade principal = Marmitaria.
- As telas da marmitaria sempre usam a unidade `marmitaria`, sem trocar a unidade do app.
- A troca de negócio é um menu no topo. Trocar muda a unidade do app, então RH, ingredientes e fichas passam a ser os do negócio aberto.
- Eventos virou a unidade `eventos`, começando vazia. Os eventos antigos ficam onde estão, e o negócio Restaurante continua com a tela deles.
- As funções e a senha guardada no banco ficam sem uso. Apagar é ação destrutiva e depende do dono.

## DP — Assistente Héfisto (07/11/2026)

Pedido do dono: a conversa da Inteligência se chama **Assistente Héfisto** e tem cara de WhatsApp.

- Tela própria em `/dashboard/inteligencia/assistente` (mesma permissão da Central, por prefixo). A Central abre a conversa por um cartão e manda a pergunta dos insights em `?q=`.
- **Exceção ao padrão hf-\***: só nesta tela, as cores do WhatsApp (topo #008069, fundo #EFEAE2, balão #D9FDD3, botão #00A884) em variáveis `--wa-*` dentro do componente. Sem logo nem nome do WhatsApp.
- Por baixo é o mesmo Command Bus, com confirmação no servidor e auditoria. Voz só troca a entrada (fala → texto).
- Entrada sem local: vai para o estoque com o nome do **setor do cadastro** ("cozinha" → Cozinha, "bar" → Bar), se o produto está nele ou ainda em nenhum. Sem setor, continua perguntando.
- Várias coisas numa frase ("3 kg de picanha, 4 L de xarope"): a origem é perguntada uma vez e cada item vira uma ação com prévia própria; "Confirmar todos" confirma uma por uma.
- Ficha pela conversa (`recipe.create`): o ingrediente que não existe é cadastrado junto com a ficha, só no Confirmar, no formato da tela de Ingredientes. Custo pela conta da tela de fichas (`custoDeProduzirFicha`). A ficha sai `ativa`, com observação de que falta o modo de preparo.
- Lucro de prato é **SIMULAÇÃO** (preço − custo da ficha), sem impostos, taxa, embalagem e mão de obra.
- Pontualidade: horário combinado = entrada do cadastro do colaborador; atraso no minuto exato, tolerância de 5 min (CLT art. 58, § 1º) só indicada.

## DP — Visual inspirado no Nina (07/11/2026, pedido do dono)

O dono mandou telas do Nina (Severina) e pediu o mesmo visual no Héfisto. Análise:
- **Fonte:** Inter (sans-serif neutra, títulos em peso 600 com espaçamento apertado, descrições cinza pequenas). O Héfisto passa da Plus Jakarta Sans para a Inter.
- **Cores:** fundo branco, cards brancos com borda fina e quase sem sombra; cada módulo com um **ícone colorido** (quadrado de canto arredondado, ícone branco). Destaque em card grafite com botão branco em pílula.
- **Posições:** trilha pequena no topo ("unidade / área") com a data à direita; título grande; card de destaque; seções com rótulo cinza; cards em grade com ícone à esquerda, título, descrição e seta ↗ no canto.

Decisões:
- **Cores de módulo** (`hf-tile-*`, `app/lib/cores-modulo.mjs`) entram como exceção à regra "sem azul/violeta": valem **só** para o quadradinho do ícone. Botão, texto, fundo e estado continuam no branco e dourado. A cor sai da função (Estoque sempre índigo, Etiquetas sempre azul), não da área.
- O card grafite de destaque usa `bg-hf-menu` (mesmo grafite do menu): KDS na Cozinha e no Bar, com a fila real; Comandas no Salão.
- Feito nas telas de Cozinha, Bar, Salão e no Início (lançador de módulos). As outras telas herdam só a fonte.
