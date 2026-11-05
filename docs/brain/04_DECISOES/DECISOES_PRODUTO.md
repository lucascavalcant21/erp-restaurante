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

