# PLANO F2.1 — FUNDAÇÃO FINANCEIRA DO HÉFISTO

Data: 2026-10-01 · Branch `fase-f2-1/fundacao-financeira` (sobre `hotfix/fin-cp-1`) · **PROPOSTA PARA APROVAÇÃO**

**Entregáveis:**
- `db/F2_1_FUNDACAO_FINANCEIRA.sql`: a migration consolidada, **não executada**;
- `db/F2_1_FUNDACAO_FINANCEIRA_ROLLBACK.sql`: só com aprovação;
- `scripts/test_f2_1_fundacao_financeira.mjs`: teste local em Postgres simulado;
- este plano.

**Sem:**
- execução em produção;
- tela alterada;
- dado alterado;
- push e deploy.

---

## 1. Decisão em uma frase

Uma fundação **pequena e aditiva**: 13 tabelas novas, 18 colunas nulas em `contas_pagar`, 5 views, 7 RPCs (2 internas) e 8 funções de apoio/trigger. Ela separa:

| Camada | O que cobre |
|---|---|
| **Financeiro** | conta → pagamento; recebível → recebimento; contas financeiras |
| **Compras** | documento → itens |
| **Estoque** | contagem → itens; custo médio |

O **gerencial** (DRE, CMV, margem, PE) **não ganha tabela**: é calculado lendo essas camadas, sempre com a qualidade do dado (REAL/CALCULADO/ESTIMADO/SIMULAÇÃO/NÃO APURADO, da F1.1).

As 4 migrations financeiras antigas ficam **descartadas**: unidade como `uuid`, policies `using(true)`, reescrita de histórico, compra como CMV.

---

## 2. O que ainda depende de S1–S9

A migration começa com uma **verificação prévia que aborta tudo** (nada muda) se uma premissa não for verdadeira. Por isso ela é segura de rodar mesmo antes dos blocos. Mas os blocos evitam uma tentativa frustrada:

| Premissa | Bloco que confirma | Se falhar |
|---|---|---|
| `unidades.id` é `text` | **S2** | Aborta |
| `fornecedores`, `insumos`, `estoques`, `vendas` existem com `id uuid` (destinos das FKs) | **S1 + S2** | Aborta dizendo qual |
| `contas_pagar` não tem CHECK próprio em `status` (bloquearia `parcial`/`cancelado`) | **S5** | Aborta |
| Nenhuma tabela já usa os nomes novos (`compras`, `fin_*`, `estoque_contagens`, `estoque_custos`) | **S1** | Aborta |
| `contas_pagar` tem exatamente as 11 colunas que você confirmou | já confirmado | Aborta se divergir |
| `auth_unidade_id()` e `pode_ver_todas()` existem (SEC-RH-1.4, 30/09) | não está em S1–S9; a verificação prévia checa | Aborta |
| Postgres 15+ (views `security_invoker`) | a verificação prévia checa | Aborta |

**Indispensáveis antes de aplicar: S1, S2 e S5.**

**Não bloqueiam a F2.1, mas bloqueiam a F2.3:**
- **S6:** RPCs de estoque. A confirmação de compra → entrada no razão dependerá delas.
- **S7–S9:** volumes e status.
- **S3/S4:** FKs e índices existentes.

---

## 3. Arquitetura por camada

```
OPERACIONAL   vendas / pedidos (F2.2 — fora desta entrega)
                 │ gera
FINANCEIRO    fin_contas_receber ──► fin_recebimentos ──┐
              contas_pagar ───────► fin_pagamentos ─────┼─► fin_contas_financeiras (saldo derivado)
                 ▲ origem COMPRA                         │
COMPRAS       compras ──► compras_itens                  │
                 │ (F2.3) entrada no razão               │
ESTOQUE       estoque_movimentacoes_multi (existente) · estoque_contagens(_itens) · estoque_custos
                 │
GERENCIAL     DRE · CMV real/teórico · margens · PE  ← só LÊ as camadas acima (views + JS com qualidade)
```

**Regras que o schema impõe:**
- **Compra não gera CMV nem conta sozinha.** A ligação compra → conta é explícita: `compras.conta_pagar_id` e `contas_pagar.origem_tipo='COMPRA'`, única por origem.
- **Pagamento ≠ conta.** O valor original nunca é sobrescrito; saldo = `valor − Σ principal`.
- **Recebimento ≠ receita.** Receita é o **bruto**; o líquido é caixa.
- **Contagem fechada é imutável**, e só fecha com custo em todos os itens. Valor de estoque nunca é inventado.

---

## 4. Schema

### 4.1 Tabelas novas

| Tabela | Camada | Finalidade | Chaves e regras principais |
|---|---|---|---|
| `fin_categorias` | Ref. | Plano de categorias (global), com `grupo` e **`natureza`** (onde entra no DRE) | PK `codigo`. 29 categorias + 6 "legado" (só leitura). `permite_conta_manual`, `exige_revisao` |
| `fin_categorias_legado` | Ref. | Texto antigo de `contas_pagar.categoria` → categoria nova | 12 mapeamentos (§6) |
| `fin_centros_custo` | Ref. | cozinha, bar, salão, administrativo, delivery, eventos, geral | PK `codigo` |
| `fin_contas_financeiras` | Financeiro | Caixa, banco, carteira digital, adquirente | `saldo_inicial` + `saldo_inicial_em` **obrigatórios**, informados pelo dono. Saldo atual é derivado |
| `fin_pagamentos` | Financeiro | Saída de caixa contra uma conta a pagar | `valor_principal > 0`, juros, multa, desconto; `valor_total` gerado. **Imutável**: só estorno (com motivo). Sem DELETE |
| `fin_taxas_meio_pagamento` | Financeiro | Taxa % e fixa, prazo, por meio/adquirente/bandeira/modalidade/parcelas e vigência | **Nada semeado**: sem taxa inventada |
| `fin_contas_receber` | Financeiro | Recebível: bruto, taxa prevista, líquido previsto (gerado), data da venda, data prevista | Taxa nula = "não informada", e o líquido fica nulo. Status `previsto/parcial/recebido/cancelado` |
| `fin_recebimentos` | Financeiro | Entrada de caixa: bruto baixado, líquido recebido, taxa efetiva (gerada), conciliação | Imutável; só estorno |
| `compras` | Compras | Documento de entrada (NF/cupom), fornecedor, data, frete, desconto, status | `rascunho → confirmada → cancelada`. Confirmada não muda. NF única por fornecedor |
| `compras_itens` | Compras | Insumo, embalagens × conteúdo → quantidade base (g/ml/un), valor, custo unitário base (gerado), lote, validade, destino | Herda e confere a unidade do documento; congela na confirmação. `movimento_estoque_id` reservado para a F2.3 |
| `estoque_custos` | Estoque | Custo médio vigente por insumo | Escrito só pela confirmação de compra (F2.3). Nenhuma linha agora |
| `estoque_contagens` | Estoque | Inventário: `inicial / final / intermediaria / ajuste`, data, estoque (ou todos) | Fechada = imutável; uma fechada por (unidade, estoque, data, tipo) |
| `estoque_contagens_itens` | Estoque | Quantidade contada, quantidade do sistema, **custo congelado**, valor e diferença (gerados) | Fecha só se todos os itens tiverem custo |

`estoque_contagens` **não** é o `inventario_itens` atual: aquele é patrimônio/utensílios.

### 4.2 Colunas novas em `contas_pagar`

Todas **nulas e sem default**. As linhas antigas não mudam.

| Coluna | Tipo | Para quê |
|---|---|---|
| `fornecedor_id` | uuid → `fornecedores` | Fornecedor |
| `categoria_codigo` | text → `fin_categorias` | Categoria nova (a coluna `categoria` antiga fica intacta) |
| `centro_custo_codigo` | text → `fin_centros_custo` | Centro de custo |
| `competencia` | date (dia 1) | Mês a que a despesa pertence (DRE) |
| `documento_numero`, `anexo_url`, `observacao` | text | Documento e anexo |
| `origem_tipo`, `origem_id` | text, uuid | MANUAL, COMPRA, FOLHA, RECORRENTE, MANUTENCAO, RH, IMPORTACAO |
| `recorrencia_origem_id` | uuid → `contas_pagar` | Recorrência idempotente |
| `grupo_parcelas_id`, `parcela_numero`, `parcelas_total` | uuid, int, int | Parcelamento |
| `chave_idempotencia` | text | Anti-duplicidade |
| `cancelado_em`, `motivo_cancelamento` | timestamptz, text | Cancelar sem apagar |
| `criado_por`, `atualizado_por` | uuid | Auditoria |

`valor` **continua sendo o valor original**. Não foram criados `valor_original`, `valor_pago` nem `saldo`: o pago e o saldo são **calculados** pelos pagamentos, o que evita o erro do "0 padrão = pago" da F1.

**CHECKs novos, todos `NOT VALID`** (valem para linha nova ou alterada; o histórico não é validado):
- `status in (pendente, parcial, pago, cancelado)`;
- `valor > 0`;
- competência no dia 1;
- origem válida;
- parcela coerente;
- cancelado exige data + motivo.

### 4.3 Status

| Entidade | Persistido | Derivado na view |
|---|---|---|
| Conta a pagar | `pendente`, `parcial`, `pago`, `cancelado` | `vencido` (saldo > 0 e vencimento < hoje em São Paulo), mais o booleano `vencida` (inclui parcial vencida) |
| Conta a receber | `previsto`, `parcial`, `recebido`, `cancelado` | `atrasado` |

**Por que "vencido" é derivado:** gravar "vencido" exigiria uma rotina diária reescrevendo status, que esquece, atrasa ou duplica. Derivar da data é sempre correto e não altera dado. O status persistido é mantido só pelas RPCs (`fin_*_recalcular`).

### 4.4 Índices

**Idempotência (únicos parciais):**
- `contas_pagar (unidade_id, chave_idempotencia)`;
- `contas_pagar (recorrencia_origem_id, competencia)`: uma conta recorrente por mês;
- `contas_pagar (unidade_id, origem_tipo, origem_id, parcela)`: uma conta por origem/parcela, ou seja, uma compra não gera duas contas;
- `fin_pagamentos (unidade_id, chave_idempotencia)`;
- `fin_contas_receber (unidade_id, chave_idempotencia)` e `fin_contas_receber (unidade_id, origem_tipo, origem_id, parcela)`;
- `fin_recebimentos (unidade_id, chave_idempotencia)`;
- `compras (unidade_id, chave_idempotencia)` e `compras (unidade_id, fornecedor, nº documento)`, para compra não cancelada;
- contagem fechada única;
- item de contagem único.

**Consulta:** unidade+vencimento, unidade+competência, unidade+data de pagamento/recebimento/compra, conta, insumo.

A idempotência **é do banco**, não do botão: repetir a mesma chave devolve o registro existente (`idempotente: true`).

### 4.5 Foreign keys

| Tabela | Referências |
|---|---|
| Todas as novas | `unidade_id → unidades(id)` (text) |
| `contas_pagar` | → `fornecedores`, `fin_categorias`, `fin_centros_custo`, `contas_pagar` (recorrência) |
| `fin_pagamentos` | → `contas_pagar`, `fin_contas_financeiras` |
| `fin_contas_receber` | → `vendas`, `fin_taxas_meio_pagamento`, `fin_contas_financeiras` |
| `fin_recebimentos` | → `fin_contas_receber`, `fin_contas_financeiras` |
| `compras` | → `fornecedores`, `contas_pagar` |
| `compras_itens` | → `compras`, `insumos`, `estoques` |
| `estoque_custos` | → `insumos` |
| `estoque_contagens` | → `estoques` |
| `estoque_contagens_itens` | → `estoque_contagens`, `insumos`, `estoques` |

**Nenhum `on delete cascade`:** nada financeiro some em cascata.

### 4.6 RLS e permissões (só tabelas novas)

| Quem | O que pode |
|---|---|
| `anon` | **Nada** (tabelas, views e RPCs) |
| `authenticated` | **Só a própria unidade**, ou todas para quem vê a rede. Regra: `pode_ver_todas() or unidade_id = auth_unidade_id()`, as mesmas funções aplicadas em 30/09. Sem `unidade_id IS NULL` liberado (as colunas são NOT NULL) |
| Ninguém do app | DELETE em tabela financeira: cancelamento e estorno são por status |
| Somente leitura direta | `fin_pagamentos`, `fin_recebimentos`, `estoque_custos`. A escrita é **só pelas RPCs** |
| Leitura para todos os logados | Tabelas de referência; escrita só pelo dono via SQL |

**As policies de `contas_pagar` (tabela existente) NÃO são alteradas.** Hoje ela provavelmente tem `using(true)`, ou seja, qualquer logado vê todas as unidades. Isso pertence à trilha de segurança (SEC-RH-2). As RPCs novas, porém, já checam a unidade.

### 4.7 Funções e RPCs

| Função | Tipo | O que faz |
|---|---|---|
| `fin_registrar_pagamento(conta, pago_em, principal, juros, multa, desconto, forma, conta_fin, obs, chave)` | RPC, definer | Trava a conta e checa a unidade. **Idempotente.** Recusa:<br>• data futura;<br>• valor ≤ 0 ou acima do saldo;<br>• conta cancelada;<br>• conta paga antes da F2.1.<br>Grava o pagamento e recalcula o status (parcial/pago) e o `data_pagamento` |
| `fin_estornar_pagamento(pagamento, motivo)` | RPC | Marca o estorno (quem/quando/motivo) e recalcula. Não apaga |
| `fin_cancelar_conta_pagar(conta, motivo)` | RPC | Só sem pagamento ativo |
| `fin_registrar_recebimento(conta_receber, recebido_em, líquido, bruto_baixado, conta_fin, conciliação, obs, chave)` | RPC | Baixa do bruto, líquido creditado, taxa efetiva. Idempotente |
| `fin_estornar_recebimento(recebimento, motivo)` | RPC | Idem pagamento |
| `fin_conta_pagar_recalcular` / `fin_conta_receber_recalcular` | Internas | Sem permissão para o app |
| `fin_pode_acessar_unidade(unidade)` | Apoio | Regra de unidade dentro das RPCs |
| `fin_hoje()` | Apoio | Dia em America/Sao_Paulo |
| `estoque_custo_medio_novo(saldo_ant, custo_ant, qtd, valor)` | Pura | **Fonte única do custo médio ponderado** (§5.4) |

### 4.8 Triggers

| Trigger | Regra |
|---|---|
| `*_auditoria_f21` (contas_pagar + 7 tabelas novas) | Preenche `criado_por` na criação; em cada alteração grava `updated_at` e `atualizado_por`. Impede reescrever `criado_por`/`created_at` |
| `fin_*_imutavel_f21` | Pagamento/recebimento: proíbe DELETE e qualquer mudança que não seja o estorno; estornado não muda mais |
| `*_cabecalho_f21` | Item precisa ter a unidade do documento; documento confirmado/fechado não aceita mudança de item |
| `estoque_contagens_status_f21` | Fechada/cancelada é imutável; fechar exige itens e custo em todos |
| `compras_status_f21` | Cancelada é imutável; confirmada só pode ser cancelada; confirmar exige itens |

### 4.9 Views (`security_invoker`: respeitam o RLS de quem lê)

| View | O que mostra |
|---|---|
| `vw_fin_contas_pagar` | Valor original, pago, saldo, saída de caixa (com juros/multa), competência efetiva (ou inferida), categoria efetiva (ou mapeada do texto antigo), natureza, situação, `vencida`, `pagamento_legado` |
| `vw_fin_contas_receber` | Bruto, taxa e líquido previstos, `taxa_nao_informada`, baixado, recebido, saldo, situação |
| `vw_fin_fluxo_caixa` | Realizado (pagamentos, pagamentos legados, recebimentos) e previsto (saldos a pagar por vencimento, a receber por previsão), com entrada/saída |
| `vw_fin_saldo_contas_financeiras` | Saldo inicial + recebimentos − pagamentos após a data do saldo inicial |
| `vw_compras` | Compra com valor dos itens, frete, desconto e total |

### 4.10 Auditoria

| Pergunta | Onde está |
|---|---|
| Quem criou / quando criou | `criado_por` / `created_at` (trigger, não reescrevível) |
| Quem alterou | `atualizado_por` / `updated_at` |
| Quem pagou / quando pagou | `fin_pagamentos.criado_por` / `pago_em` (data real) / `created_at` (quando foi registrado) |
| Quem estornou e por quê | `estornado_por` / `estornado_em` / `motivo_estorno` |
| Origem | `origem_tipo` / `origem_id` |
| Unidade | `unidade_id` em todas |

Não criei uma tabela de log genérica. `hefisto_auditoria` existe no repositório, mas a aplicação dela em produção não está confirmada (S1). As colunas acima cobrem os eventos financeiros sem duplicar.

---

## 5. Regras gerenciais (descritas; cálculo na camada gerencial)

### 5.1 Caixa × competência

| Leitura | Data usada | Fonte |
|---|---|---|
| **Fluxo de caixa** | `pago_em` / `recebido_em` | `vw_fin_fluxo_caixa` |
| **DRE** | despesas: `competencia_efetiva`; receitas: `data_venda` (vendas, F2.2) | `vw_fin_contas_pagar` e vendas |

Exemplo: energia de setembro, paga em outubro. Lançada com `competencia = 2026-09-01`, ela aparece no DRE de setembro e sai no fluxo de outubro.

### 5.2 DRE gerencial (estrutura)

| Linha | Fonte | Disponível após |
|---|---|---|
| Receita bruta | Vendas canônicas (bruto) | F2.2 |
| (−) Cancelamentos, descontos | Vendas | F2.2 |
| (−) Impostos sobre venda | Contas com natureza `deducao_receita`, por competência | F2.1 (cadastro) |
| **= Receita** | | |
| (−) **CMV real** | EI + compras − EF (§5.3) | F2.3 (compras confirmadas + contagens) |
| **= Lucro bruto** | | |
| (−) Custos variáveis | Natureza `custo_variavel`, mais taxas efetivas dos recebimentos | F2.1 / F2.2 |
| **= Margem de contribuição** | | |
| (−) Pessoal (CMO), despesas fixas | Naturezas `pessoal`, `despesa_fixa` | F2.1 |
| **= Resultado operacional** | | |
| (−/+) Financeiro | Natureza `financeiro` + juros/multas dos pagamentos | F2.1 |
| **= Resultado gerencial** | | |
| Fora do resultado | `investimento`, `distribuicao`; `mercadoria` vai para o estoque; `perda_estoque` legado só com revisão | — |

**Regra contra dupla contagem de taxa de cartão:**
- a taxa retida no repasse vem **só** do recebimento (`valor_taxa_efetiva`);
- a categoria `com_taxa_cartao` em contas a pagar é só para cobrança **avulsa** (aluguel de maquininha, mensalidade).

Enquanto a receita bruta não tiver fonte completa autorizada (F1.1), o DRE continua **NÃO APURADO**: a F2.1 não muda isso.

### 5.3 CMV

| Conceito | Definição | Fonte |
|---|---|---|
| **CMV real** | Estoque inicial (contagem fechada `inicial` ou `final` do período anterior) + compras de mercadoria confirmadas no período − estoque final (contagem fechada `final`) | `estoque_contagens_itens.valor_total`, `compras_itens.valor_total` |
| **CMV teórico** | Venda × ficha técnica → quantidade teórica × custo (médio vigente) | Vendas (F2.2) + fichas + `estoque_custos` |
| **Divergência** | Real − teórico | Investigar perda, desperdício, porcionamento, ficha, furto, erro de estoque, entrada/saída sem registro, mudança de custo |

Sem contagem inicial **ou** final fechada, o CMV real fica **NÃO APURADO**. Nunca entra zero no lugar.

Compra **nunca** entra como CMV direto: só pela fórmula.

### 5.4 Custo médio ponderado (fonte única)

`estoque_custo_medio_novo(saldo_ant, custo_ant, qtd, valor)` = `(saldo_ant × custo_ant + valor) / (saldo_ant + qtd)`.

**Exemplo (testado):**
1. 20 kg por R$ 900 → R$ 45/kg.
2. Depois, 10 kg por R$ 500 → R$ 1.400 / 30 kg = **R$ 46,67/kg**.

**Bordas:**
- saldo anterior ≤ 0 ou custo desconhecido → custo da entrada;
- **ninguém mais calcula essa fórmula.** O `custo-medio.mjs` da F1 vira espelho, testado contra a função SQL.

### 5.5 Ponto de equilíbrio

PE = custos fixos (pessoal + despesa_fixa por competência) ÷ margem de contribuição %. As variantes diária/semanal/mensal dividem pelo número de dias de operação do período.

Enquanto a margem real não existir (sem receita apurada), o PE continua **SIMULAÇÃO**, já assim desde a F1.1.

---

## 6. Os 7 registros atuais de `contas_pagar`

**Nenhum é alterado:** nenhum UPDATE e nenhum valor padrão novo. A migration só os **lê de outro jeito** pela view:

| Registros (S10 + datas) | `status`/`categoria` gravados | Como a `vw_fin_contas_pagar` lê |
|---|---|---|
| 2 × CMO pagos, 23/06 (R$ 4.764,40) | `pago` / `cmo` | `situacao = pago`, `pagamento_legado = true` (pago integral em `data_pagamento`), categoria `legado_cmo` (pessoal), competência inferida 2026-06. **Bloqueados para novo pagamento por RPC**, porque já constam pagos |
| 3 × CMO pendentes, 23/06 (R$ 2.421,98) | `pendente` / `cmo` | `situacao = vencido`, saldo = valor, `legado_cmo`. Podem receber pagamento pela RPC |
| 1 × "cmv" pendente, 15/07 (R$ 9,00) | `pendente` / `cmv` | Categoria `legado_cmv` = **mercadoria, `exige_revisao`**. Não entra como CMV nem como despesa até você revisar |
| 1 × custo variável pendente, 02/09 (R$ 5.500,00) | `pendente` / `custo_variavel` | `legado_custo_variavel` (custo variável, `exige_revisao`), vencido |

- **CHECKs novos** são `NOT VALID`: os 7 continuam válidos e editáveis (testado).
- **Colunas novas** ficam nulas nos 7 (testado).
- **Fluxo de caixa:** as 2 pagas aparecem como "saída realizada — pagamento legado" de R$ 4.764,40 em 23/06 (testado).
- **Reclassificar** (ex.: o R$ 9 de "cmv") é uma decisão sua, feita depois, conta a conta. Nada é automático.

---

## 7. As perguntas que o Héfisto vai responder: de onde vem cada uma

| Pergunta | Fonte na fundação | Hoje |
|---|---|---|
| Quanto vendi? | Vendas canônicas (F2.2) | NÃO APURADO |
| Quanto recebi? | `fin_recebimentos` (líquido) | Vazio até a F2.2 gerar recebíveis |
| Quanto tenho a receber? | `vw_fin_contas_receber.saldo_bruto` / líquido previsto | Vazio |
| Quanto gastei? (competência) | `vw_fin_contas_pagar` por `competencia_efetiva` × natureza | Parcial (7 contas antigas) |
| Quanto ainda tenho a pagar? / Quanto devo esta semana? | `saldo` por `data_vencimento` | **Apurável após a migration** |
| Onde gasto mais? / energia? / manutenção? / funcionários? | Categoria e grupo × competência | Apurável para contas novas categorizadas; as antigas aparecem como "legado" |
| Quanto comprei de mercadoria? / de picanha? | `compras_itens` por insumo | Após uso de Compras |
| Quanto o estoque consumiu? / CMV real | Contagens + compras (§5.3) | NÃO APURADO até haver contagem inicial e final |
| CMV teórico | Vendas × fichas × custo médio | F2.2/F2.3 |
| Margem de contribuição / lucro / PE / faturamento diário necessário | DRE (§5.2) | NÃO APURADO / SIMULAÇÃO até haver receita completa |
| Mês × mês anterior | Mesmas views por competência | Conforme a qualidade de cada linha |
| Quanto paguei de taxas? | `fin_recebimentos.valor_taxa_efetiva` + `com_taxa_cartao` avulsa | Após recebíveis |
| Quanto paguei de impostos? | Naturezas `deducao_receita` + `imp_taxas_licencas` | Contas novas categorizadas |
| Quanto perdi? | Razão de estoque (perda) valorizado: F2.3 | — |
| Quanto tenho em caixa? | `vw_fin_saldo_contas_financeiras` | Após você cadastrar contas com saldo inicial **real** |
| Fluxo projetado | `vw_fin_fluxo_caixa` (previsto) | Saídas sim; entradas após recebíveis |

**IA:** as respostas passam a ser consultas a essas views e tabelas, rotuladas com a qualidade (camada da F1.1). Nenhum número fica no código.

---

## 8. Compatibilidade com o HOTFIX FIN-CP-1 e ordem

1. **Hotfix** (já pronto, sem migration): restaura contas a pagar com o schema atual.
2. **F2.1 SQL** (esta proposta): você roda S1, S2 e S5, aprova e executa no SQL Editor.
   - **O app continua funcionando sem mudança.** O hotfix só grava `pendente`/`pago`, valor > 0 e colunas existentes, tudo compatível com os CHECKs novos (testado).
   - Uma conta paga pelo hotfix (sem linha em `fin_pagamentos`) é lida como `pagamento_legado`, como as antigas.
3. **F2.1-telas** (próxima etapa, com sua aprovação): Contas a Pagar passa a usar categoria nova, competência, fornecedor, centro de custo e as RPCs de pagamento (parcial, juros, multa, desconto). O pagamento direto do hotfix é aposentado. RH/Manutenção ganham `origem_tipo`.
4. **F2.2:** vendas canônicas → recebíveis (receita bruta).
5. **F2.3:** compras confirmadas → entrada no razão + custo médio; contagens → CMV real.

---

## 9. Riscos e limitações conhecidos

- **RPCs são `SECURITY DEFINER` com checagem de unidade**, mas **não** checam papel ou permissão (ex.: "só gerente paga"). O sistema de permissões por papel em produção é decisão da trilha de segurança. Hoje qualquer usuário ativo da unidade poderia pagar pela RPC, assim como já pode editar `contas_pagar` direto.
- **`contas_pagar` mantém a policy atual**, provavelmente sem isolamento por unidade: SEC-RH-2.
- **`auth_unidade_id()` devolve uma unidade só.** Usuário com escopo em várias unidades, sem "ver a rede", enxerga só a principal. Isso replica a regra atual.
- **Categorias e centros de custo são globais.** Para várias empresas com planos próprios, acrescenta-se depois `empresa_id` nulo = padrão, sem quebrar.
- **Fuso fixo America/Sao_Paulo** em `fin_hoje()`. Para unidades em outro fuso, vira coluna em `unidades` depois.
- **Entradas do fluxo realizado ficam PARCIAIS até a F2.2.** O PDV ainda grava `lancamentos` (extrato), não recebimentos.
- **Exige Postgres 15+.** O Supabase atual usa 15+, e a verificação prévia confere.
- **O teste é simulação.** A migration foi testada em PGlite (Postgres real em memória) com um schema que imita o de produção. O banco real só será conhecido de fato com S1/S2/S5.
- **Rollback** (`..._ROLLBACK.sql`) desfaz só o que a F2.1 criou e **se recusa** a rodar se qualquer estrutura nova já tiver dado de uso.

---

## 10. Testes executados

`node scripts/test_f2_1_fundacao_financeira.mjs` (PGlite 0.5.8, Postgres em memória): **67/67**.

| Área | O que foi verificado |
|---|---|
| Migration | Roda; **os 7 registros ficam idênticos** nas 11 colunas originais; colunas novas nulas; **rodar 2× não quebra nem duplica** |
| Leitura do histórico | 2 pagos = legado integral; 3 CMO = vencidos; R$ 9 "cmv" = mercadoria a revisar; competência inferida |
| Pagamentos | Parcial 2.000/5.000 → `parcial`; mesma chave → não duplica; acima do saldo e data futura → recusados; 2º pagamento com juros/multa → `pago`, saída 5.060 e valor original 5.000 preservado; estorno → volta a `parcial`; estorno sem motivo/duplo → recusado |
| Proteções | App não grava direto em pagamentos; ninguém apaga pagamento; pagamento é imutável; conta paga antiga não recebe novo pagamento; conta com pagamento não cancela; status/valor inválidos em conta nova recusados; conta antiga continua editável |
| Isolamento | Outra unidade não vê nem paga; não cria compra na unidade alheia; quem vê a rede vê tudo; `anon` não lê tabela, view nem executa RPC |
| Receber | Bruto 100, taxa 3 → líquido 97; taxa não informada → líquido nulo; recebimento de 97 baixa o bruto 100; taxa efetiva 3; fluxo mostra entrada de 97, não 100 |
| Custo médio | 45/kg e 46,666667/kg |
| Compras | Sem itens não confirma; item de outra unidade recusado; quantidade base e custo por grama; confirmada é imutável; NF duplicada recusada; compra não gera conta nem CMV sozinha |
| Inventário | Não fecha sem custo; valor 225,00; fechada imutável (cabeçalho e itens) |
| Verificação prévia | Sem `fornecedores`, CHECK antigo em status ou coluna inesperada → aborta e nada é criado |
| Rollback | Recusa com dado gravado; num banco limpo volta às 11 colunas e aos 7 registros idênticos; a migration roda de novo depois |
| Arquivo | Sem comando DROP/TRUNCATE; nenhum UPDATE/DELETE fora de funções |

**Hotfix nesta mesma base:** `contas-pagar.test.mjs` 64/64.

---

## 11. Aprovação pedida

1. **Schema:** de acordo com as tabelas, colunas, status e regras acima?
2. **Plano de categorias (§4.1):** quer ajustar nomes, grupos ou naturezas antes? Por exemplo: energia como despesa fixa; taxa de serviço repassada como pessoal.
3. **Rodar S1, S2 e S5** e me devolver os resultados. Com eles confirmo a verificação prévia antes de você executar.
4. **Execução** da migration no SQL Editor: só depois dos itens 1–3.

**Parado aqui.** Nenhum SQL executado, nenhuma tela alterada, nada publicado.
