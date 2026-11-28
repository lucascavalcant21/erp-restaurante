# Auditoria — Expansão Financeira e Comercial (Fase 1)

Data: 27/11/2026. Pedido do dono: documento "Projeto Héfisto — Expansão Financeira e Comercial", item 29 (só auditoria; nenhuma alteração estrutural antes da autorização).

**Como foi feita:**
- leitura do código no branch `hefisto-teste` (igual à `main` depois do PR #317);
- leitura do banco de produção `sezccspqxgklicfndwxx`: catálogo, colunas e contagens, só leitura (TESTADO NO SUPABASE REAL, só leitura);
- consulta à memória do projeto (`docs/brain`).

Nenhuma tabela, policy ou dado foi alterado.

Legenda de situação: **EXISTE** · **PARCIAL** · **NÃO EXISTE** · **DEPENDE DE INTEGRAÇÃO**.

---

## 1. Inventário do sistema atual

### Plataforma
- **Aplicação:** Next.js 15 (App Router) + React 18 + Tailwind, em JavaScript (sem TypeScript).
- **Hospedagem:** Vercel, projeto `erp-restaurante`, domínio `app.hefisto.com.br`. Ainda há um Express legado (`backend_cloud_code/`) atendendo parte de `/api/*` e os webhooks antigos.
- **Banco:** Supabase (Postgres 17, `sa-east-1`) com Auth, RLS ligado em todas as tabelas públicas, RPCs e Realtime.
- **Testes:** `node:test`. São 1.393 testes em `app/lib`, mais 280 do Intelligence Core e os testes do agente. Testes com SQL real via PGlite. Não há CI no GitHub.

### Tamanho
- 40 áreas em `app/dashboard` e 42 grupos de rotas em `app/api` (20 deles `ia-*`).
- 469 arquivos em `app/lib`, 311 deles módulos `.mjs` puros e testáveis.
- 155 arquivos SQL em `db/`.

### Dados reais (contagem em 27/11/2026)

| Item | Quantidade |
|---|---|
| Empresas / unidades / assinaturas | 1 / 4 / 1 |
| Fichas técnicas / insumos | 208 / 429 |
| Histórico de custo de fichas / de preços de insumos | 259 / 522 linhas |
| Preços por canal (marmitaria) | 30 |
| Vendas PDV / pedidos / pedidos de delivery | 0 / 14 / 0 |
| Repasses / vendas da marmitaria / faturamento diário | 0 / 0 / 0 |
| Taxas de meio de pagamento / campanhas | 0 / 0 |

**Consequência:** o motor e as telas existem para boa parte do pedido, mas **não há vendas nem repasses gravados**. Dashboard, CMV teórico, conciliação, engenharia de cardápio e DRE sairiam hoje como **DADOS INSUFICIENTES**. A entrada de dados (importação de vendas e faturas, integração iFood) é pré-requisito de quase tudo.

---

## 2. Mapeamento das funcionalidades existentes (o que reaproveitar)

| Tema | Onde está | Situação |
|---|---|---|
| Fichas técnicas, bases, subfichas, custo por porção, histórico de custo | `app/lib/ficha-calculos.mjs`, `custo-rendimento.mjs`, `ficha-financeiro.mjs`; tabelas `fichas_tecnicas`, `fichas_ingredientes`, `fichas_custo_historico`, `fichas_versoes` | EXISTE (é o núcleo mais maduro) |
| Insumos: unidade de compra × uso, fator de compra, aproveitamento, perda, fornecedor, histórico de preço | `insumos` (`unidade_compra`, `fator_compra`, `aproveitamento_pct`, `perda_pct`, `fornecedor_atual_id`), `insumos_precos_historico`, `insumos_fornecedores`, `estoque-unidades.mjs` | EXISTE |
| Precificação por canal (delivery) | `app/lib/marmitaria/nucleo.mjs` (`precoSugerido`, `resultadoPorCanal`, `taxaDaFatura`), `precificacao.mjs`, `lucro-por-canal.mjs`, `comparar-apps.mjs`; tabela `marmitaria_precificacao_canais` | PARCIAL (só marmitaria; sem vigência nem histórico) |
| Composição do preço (para onde vão R$ 100) | `composicao-preco.mjs` (em centavos), `/dashboard/financeiro/pizza` | PARCIAL |
| Promoções | `marmitaria/promocoes.mjs`, `cardapio-promocoes.mjs`; tabelas `cupons`, `campanhas` (vazias) | PARCIAL |
| Ponto de equilíbrio e metas | `metas-negocio.mjs` (`pontoDeEquilibrio` por mês, semana e dia), `/dashboard/financeiro/equilibrio`, `evento-metas.mjs`, Simulador de vendas da marmitaria | PARCIAL (contribuição média sem ponderar o mix real) |
| Simuladores | `evento-simulador.mjs`, `marmitaria_simulacoes`, `SimuladorDeVendas` | PARCIAL (sem salvar e comparar cenários genéricos) |
| DRE gerencial | `dre-gerencial.mjs` (318 linhas, testado), `/dashboard/financeiro/dre`, DRE da marmitaria e DRE do evento | PARCIAL (por unidade; sem canal e sem caixa × competência explícito) |
| CMV real | `cmv-real.mjs`, `/dashboard/financeiro/cmv`, estoque imutável (`estoque_movimentacoes_multi`) | EXISTE (fórmula estoque inicial + compras − final) |
| CMV teórico | Custo da ficha × vendido: depende de vendas, que estão vazias | PARCIAL |
| Engenharia de cardápio | `app/lib/engenharia.js` (86 linhas), `/dashboard/operacao/engenharia` | PARCIAL (sem testes e sem critérios configuráveis) |
| Conciliação | `/dashboard/financeiro/conciliacao` (bancária), `marmitaria/conciliacao.mjs` + `ConciliacaoIfood`, `recebiveis.js`, `delivery_repasses` | PARCIAL (só iFood e marmitaria; sem estados de contestação) |
| Auditoria por pedido | `delivery_pedidos` (subtotal, descontos da loja, benefícios do canal, taxas, `pedido_externo_id`) | PARCIAL (estrutura só para delivery; vazia) |
| Contas a pagar e receber, caixa, fluxo | `fin_*` + RPCs `fin_registrar_pagamento` etc. | EXISTE |
| Taxas de meio de pagamento com vigência | `fin_taxas_meio_pagamento` (`vigente_desde/ate`) | EXISTE (vazia) |
| Inteligência | `app/lib/intelligence/*` (contexto no banco, métricas determinísticas, natureza REAL/ESTIMATIVA…, auditoria imutável, ações confirmáveis) | EXISTE (base certa para a HI financeira) |
| Multiempresa | `empresas`, `unidades.empresa_id`, `hefisto_user_can`, RLS `sec_unidade` | PARCIAL (1 empresa real; isolamento por unidade testado) |
| Assinaturas e planos | `empresa_assinatura`, `app/lib/planos.mjs`, `/dashboard/assinar`, `/dashboard/conta/plano`, `api/assinatura/pix` | PARCIAL (sem provedor aprovado nem webhook) |
| Onboarding | `/dashboard/implantacao` | PARCIAL |
| Página comercial | landing pública em `app/page.js` | PARCIAL |

---

## 3. Comparação com os requisitos (item 3 do documento)

| # | Módulo pedido | Situação | Observação |
|---|---|---|---|
| 1 | Dashboard financeiro | PARCIAL | Existem painéis por área (financeiro, marmitaria, eventos). Falta um consolidado com comparação de períodos, unidades e canais. |
| 2 | Canais de venda | PARCIAL | O canal hoje é texto livre (`canal`) e os apps ficam na config da marmitaria. Não há cadastro ilimitado de canais. |
| 3 | Contratos e taxas | PARCIAL | Há taxa do canal, de pagamento e tributos por ficha e canal, e taxa da fatura. Faltam base de incidência, vigência, tipo de cobrança e histórico por regra. |
| 4 | Cadastro de produtos | EXISTE | `produtos` liga ficha e preço de venda, com dados fiscais. |
| 5 | Fichas técnicas | EXISTE | |
| 6 | Ingredientes e insumos | EXISTE | |
| 7 | Pré-preparos | EXISTE | Bases e subfichas, usadas em vários pratos. |
| 8 | Cardápio multicanal | PARCIAL | Há preço por canal na marmitaria e cardápio digital; falta central única com cópia entre canais e arredondamento ,90. |
| 9 | Calculadora de preços | PARCIAL | `precoSugerido` faz `custo ÷ (1 − taxas − margem)`. Falta comparar todos os canais ao mesmo tempo e tratar bases diferentes. |
| 10 | Simulador de promoções | PARCIAL | `promocoes.mjs` cobre desconto; faltam subsídio por participante, combos e volume para compensar. |
| 11 | Produtos isca | NÃO EXISTE | |
| 12 | Conciliação financeira | PARCIAL / DEPENDE DE INTEGRAÇÃO | iFood: adaptador e webhook com HMAC. 99 e Keeta: só importação manual. |
| 13 | Auditoria por pedido | PARCIAL / DEPENDE DE INTEGRAÇÃO | |
| 14 | CMV teórico e real | PARCIAL | Real existe. Teórico depende de vendas. Faltam as categorias de perda separadas. |
| 15 | Engenharia de cardápio | PARCIAL | |
| 16 | Ranking de produtos | PARCIAL | Depende de vendas. |
| 17 | Ponto de equilíbrio | PARCIAL | |
| 18 | Metas financeiras | PARCIAL | |
| 19 | Simulador de vendas | PARCIAL | |
| 20 | DRE gerencial | PARCIAL | |
| 21 | Inteligência Héfisto | PARCIAL | O Core existe; faltam os agentes financeiros e a entrada por foto, nota e planilha para finanças. |
| 22 | Relatórios e exportações | PARCIAL | `api/saas/export`, PDF de fichas e DRE. |
| 23 | Configurações | EXISTE | |

---

## 4. Diagnóstico das lacunas (por prioridade)

1. **Não há dados de venda nem de repasse.** Sem eles nenhum indicador de resultado sai REAL. Primeira lacuna a fechar: importação de vendas por canal (CSV/planilha da fatura do app e do PDV) e ligar a integração iFood já pronta.
2. **Motor financeiro espalhado.** Existem pelo menos sete módulos com fórmulas próprias:
   - `marmitaria/nucleo.mjs`
   - `metas-negocio.mjs`
   - `evento-financeiro.mjs`
   - `composicao-preco.mjs`
   - `ficha-financeiro.mjs`
   - `dre-gerencial.mjs`
   - `painel-lucro.mjs`

   O documento pede um serviço central.
3. **Canal e contrato sem modelo próprio.** Faltam:
   - tabela de canais;
   - regras de taxa com base de incidência e vigência;
   - histórico de preço por canal (hoje só há o preço atual em `marmitaria_precificacao_canais`).
4. **Precisão monetária.** A maior parte das contas usa `number` (ponto flutuante). Só `composicao-preco.mjs` e partes do financeiro trabalham em centavos.
5. **Perdas com campos sobrepostos.** O mesmo insumo pode ter perda em mais de um lugar:
   - no insumo: `aproveitamento_pct`, `perda_pct` e `perda_g`;
   - na linha da ficha: `fator_correcao` e `perda_percentual`.

   Precisa de regra única para não contar a mesma perda duas vezes (item 7 do documento).
6. **Taxas em dois lugares.** A ficha tem `taxa_maquininha`, `imposto_pct` e `custo_embalagem`, e o canal tem as taxas dele. Sem regra, a taxa pode entrar duas vezes no preço.
7. **Promoções, produtos isca e engenharia configurável** não estão completos.
8. **Conciliação com estados** (conciliado, aguardando, em análise, contestação, resolvido, dados insuficientes) e **mensagem de contestação** não existem.
9. **SaaS comercial:** falta escolher provedor de pagamento (decisão do dono), webhook idempotente, planos por módulo, período de teste e portal do assinante.

---

## 5. Riscos técnicos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Dupla contagem de perda (insumo × linha da ficha) e de taxa (ficha × canal) | ALTA (preço errado) | Definir a fonte única no motor e cobrir com testes de regressão sobre as 208 fichas reais (só leitura) antes de trocar a conta |
| Ponto flutuante em dinheiro | MÉDIA | Motor em centavos inteiros (`BigInt` ou inteiro), arredondando só na saída |
| Fórmulas antigas usadas por telas em produção | ALTA | Motor novo como fachada: as telas migram uma a uma, comparando resultado antigo × novo em teste |
| Sem dump confiável do esquema; ~10 tabelas centrais sem `CREATE` no repositório | MÉDIA | Gerar dump `schema-only` antes da primeira migração da expansão |
| Plano FREE do Supabase sem backup automático nem PITR | ALTA para migrações | Backup externo verificável (contagem + hash) antes de cada migração |
| Repositório público com dados de funcionários (S-35) | ALTA | O dono torna o repositório privado antes de começar a parte comercial |
| Rotas e segurança pendentes (S-36 apps antigos, SEC-FICHAS-1 aguardando APR-016) | ALTA | Fechar antes de ter a segunda empresa |
| Express legado ainda atende parte de `/api/*` | MÉDIA | Não colocar nada novo nele; migrar as rotas restantes |
| Isolamento entre empresas só validado com 1 empresa real | ALTA para SaaS | Teste automatizado com 2 empresas em PGlite e em transação desfeita no banco real |
| Integrações 99 e Keeta sem API oficial confirmada | MÉDIA | Começar por importação de fatura (CSV/planilha); API só com acesso oficial |

---

## 6. Proposta de arquitetura

**Motor financeiro central em `app/lib/financeiro/motor/`.** São funções puras em centavos, sem acesso ao banco:
- `dinheiro.mjs`: centavos e arredondamento comercial (,90 / ,99) que nunca reduz a margem mínima;
- `custo.mjs`: rendimento, perda e custo por porção. Embrulha `ficha-calculos.mjs` e define a fonte única da perda;
- `taxas.mjs`: regras com base de incidência (preço de lista, preço pago, subtotal), percentual, fixo por pedido, mensalidade rateada, vigência;
- `preco.mjs`: preço mínimo, recomendado e comercial; bloqueia cenário inviável (taxas + margem ≥ 100%);
- `promocao.mjs`: subsídio por participante, margem antes e depois, volume para compensar;
- `resultado.mjs`: margem de contribuição, resultado unitário, ponto de equilíbrio ponderado pelo mix real;
- `cmv.mjs`, `dre.mjs`, `conciliacao.mjs`: reaproveitam `cmv-real`, `dre-gerencial` e `marmitaria/conciliacao`.

Cada saída leva a natureza (REAL / ESTIMATIVA / PROJEÇÃO / SIMULAÇÃO / HIPÓTESE) e a lista do que falta. Sem dado, a saída é **DADOS INSUFICIENTES**.

**Leitura de dados:** `app/lib/financeiro/dados/` (cliente Supabase sob RLS) monta as entradas do motor. As telas só exibem.

**HI:** novos agentes financeiros em `app/lib/intelligence/agents/` chamam o motor oficial. Mudança de preço ou cadastro vira ação confirmável, gravada em `intelligence_acoes`.

**Telas:** um hub "Precificação e Resultado" que reaproveita `/dashboard/financeiro/*` e o padrão visual do Delivery. Sem módulo paralelo.

---

## 7. Plano de migrações (todas aditivas; nenhuma aplicada sem aprovação)

| Migração | Conteúdo | Observação |
|---|---|---|
| FIN-EXP-1 Canais | `canais_venda` (empresa, unidade, tipo, ativo) + carga dos canais que já existem no texto `canal` | Não muda nada nas tabelas atuais |
| FIN-EXP-2 Contratos e regras | `canal_contratos`, `canal_regras_taxa` (tipo, base de incidência, valor, vigência) + histórico por trigger | Substitui com o tempo as taxas da ficha (sem apagar colunas) |
| FIN-EXP-3 Preços por canal | `precos_canal` com vigência + `precos_canal_historico`; cópia de `marmitaria_precificacao_canais` | A tabela antiga continua até a troca das telas |
| FIN-EXP-4 Vendas importadas | `vendas_importacoes` (arquivo, hash, origem) e chave única `(canal, pedido_externo_id)` para idempotência | Reaproveita `delivery_pedidos` e `delivery_repasses` |
| FIN-EXP-5 Conciliação | `conciliacoes` e `divergencias` (estado, valor esperado e recebido, contestação) | |
| FIN-EXP-6 Promoções e cenários | `campanhas_financeiras` (financiador por participante) e `cenarios_simulacao` | `campanhas` antiga fica como está |
| FIN-EXP-7 SaaS | `planos`, `plano_modulos`, `assinatura_eventos` (webhook idempotente) | Depende do provedor escolhido pelo dono |

Toda migração terá:
- preflight que aborta sem mudar nada;
- transação;
- RLS por empresa e unidade com `hefisto_user_can`;
- grants mínimos;
- impressão digital pós-aplicação;
- rollback documentado (nunca executado sem o dono);
- teste em PGlite.

---

## 8. Arquivos que precisarão ser alterados

**Novos:**
- `app/lib/financeiro/motor/*` e `app/lib/financeiro/dados/*`, com testes;
- `db/FIN_EXP_1..7_*.sql`;
- telas do hub em `app/dashboard/financeiro/precificacao/*`.

**Alterados, para passar a usar o motor:**
- `app/lib/marmitaria/nucleo.mjs`, `precificacao.mjs`, `lucro-por-canal.mjs`, `painel-lucro.mjs`;
- `app/lib/metas-negocio.mjs`, `composicao-preco.mjs`, `ficha-financeiro.mjs`, `dre-gerencial.mjs`, `cmv-real.mjs`, `engenharia.js`;
- `app/components/marmitaria/SimuladorDeVendas.js`, `Conciliacao.js`, `ConciliacaoIfood.js`;
- `app/dashboard/financeiro/{pizza,equilibrio,dre,cmv,margem,conciliacao}/page.js`, `app/dashboard/operacao/engenharia/page.js`;
- `app/lib/intelligence/agents/*` e `metrics/*` (agentes financeiros);
- `app/lib/permissions-catalog.mjs` e `menu-principal.mjs` (telas novas);
- `app/lib/planos.mjs`, `app/components/planos/*`, `app/api/assinatura/*` (fase comercial).

---

## 9. Plano de implementação por fase

| Fase | Entrega | Depende de |
|---|---|---|
| 1 | Esta auditoria | — |
| 2 | Motor em centavos com a fonte única de perda e taxa; testes do documento (custo 11, taxa 23%, margem 30% → 23,404…; 23,41; 23,90) e regressão sobre as fichas reais | Decisão do dono sobre perda e taxa (item 10) |
| 3 | Fichas e custos ligados ao motor (custo bruto e líquido, histórico) | Fase 2 |
| 4 | Canais, contratos e calculadora comparando todos os canais | FIN-EXP-1/2/3 aprovadas |
| 5 | Cardápio multicanal (cópia entre canais, arredondamento, prévia) e simulador de promoções | Fase 4 |
| 6 | Importação de vendas e faturas, conciliação e auditoria por pedido | FIN-EXP-4/5; arquivos reais de fatura do dono |
| 7 | CMV teórico × real com categorias de perda; engenharia de cardápio configurável | Vendas da fase 6 |
| 8 | DRE por canal e regime; metas e simuladores com cenários salvos | Fases 6 e 7 |
| 9 | HI financeira (perguntas da seção 20, com aprovação e auditoria) | Fases 2 a 8 |
| 10 | SaaS: planos por módulo, assinatura, webhook | Provedor aprovado pelo dono |
| 11 | Onboarding de 9 passos com empresa demonstrativa e página de vendas | Fase 10; preços aprovados |
| 12 | Segurança (2 empresas), testes de ponta a ponta, homologação | Repositório privado; fechar S-35/S-36 |

---

## 10. Critérios de aprovação

**Para cada fase:**
- Testes unitários do motor cobrindo os casos do item 27 do documento.
- Regressão sobre as fichas reais (só leitura): diferença explicada linha a linha entre a conta antiga e a nova.
- Valor ausente nunca vira zero: o teste confere "DADOS INSUFICIENTES".
- Isolamento com 2 empresas: TESTADO LOCAL (PGlite) e TESTADO NO SUPABASE REAL em transação desfeita.
- Migração com preflight, transação, verificação pós-aplicação e rollback escrito; aplicada só com aprovação explícita.
- Tela nova no catálogo de permissões (a trava cobra), sem rolagem lateral em 390 px, build ok e `.next/static` sem a service role.
- Evidência declarada (MOCK / LOCAL / SUPABASE REAL / PREVIEW / PRODUÇÃO).

**Decisões que dependem do dono antes da fase 2:**
1. **Perda:** onde fica a perda oficial. Sugestão: no insumo (`aproveitamento_pct`), e o fator da linha da ficha só quando o preparo daquela ficha tiver perda diferente.
2. **Taxas:** as taxas e impostos da ficha (`taxa_maquininha`, `imposto_pct`) passam para o contrato do canal. Sugestão: sim; a ficha guarda só o custo.
3. **Repositório:** tornar o repositório privado (S-35).
4. **Fatura:** enviar uma fatura de cada app (iFood, 99, Keeta) em CSV ou planilha para a fase 6.
5. **Provedor de pagamento do SaaS:** fica para a fase 10; nada é contratado antes.
