# F2.4C — RELATÓRIO

Data: 2026-10-01 · Branch `fase-f2-4c/cmv-real`. **Não publicado. Nenhum SQL executado.**

## Auditoria (banco real, 01/10)

Fonte: `db/diagnosticos/F2_4C_AUDITORIA_FATURAMENTO.sql`, rodada pelo dono.

1. **Inventários:** `estoque_contagens` + `estoque_contagens_itens`. Hoje: **0 contagens**.
2. **Contagem fechada:** `status = 'fechada'` (`fechada_em`), imutável por trigger. Entram as da unidade inteira dos tipos inicial, semanal e fechamento.
3. **Valor do inventário:** `estoque_contagens_itens.valor_total`, que é quantidade × custo **congelado** no fechamento.
4. **Compras confirmadas:** `compras` com status `confirmada` + `compras_itens`; o total com frete e desconto vem da `vw_compras`. Hoje: **0 compras**.
5. **Custo médio:** `estoque_custos` e `estoque_custos_historico` (F2.4B). Usado só nas análises de preço. O CMV usa o valor congelado do inventário e o valor das compras.
6. **Faturamento:** **o Héfisto não tem fonte de faturamento.**
   - `vendas`: 0 linhas.
   - `pedidos`: 8 linhas (jun–ago), R$ 29,90.
   - `comandas`: 14 linhas (jun–ago).
   - `lancamentos`: 1 linha.
   - As vendas reais estão no **Saipos**, que não está integrado.
   - O "Fechamento do mês" antigo não grava o faturamento digitado.
7. **Perdas:**
   - **Caminho existente:** etiqueta com status "perda" gera uma saída no Controle de Estoque e, no caminho antigo, uma conta "Perda de Validade".
   - **Hoje:** **nenhuma** etiqueta está como perda, 0 saídas de perda e 0 contas.
   - **Data:** a etiqueta **não guarda quando** virou perda.
8. **Transferências:**
   - **Onde ficam:** em `estoque_movimentacoes_multi` (tipos `transferencia_*`). Hoje são 0.
   - **Unidades:** as do Controle de Estoque antigo são pouco confiáveis.
   - **No CMV:** como o cálculo é da unidade inteira, transferência entre locais não muda o total.
9. **Estrutura de períodos:** não existia. Agora os períodos são derivados das contagens fechadas, sem tabela.
10. **SQL:**
    - **CMV R$:** nenhum.
    - **CMV %:** depende de uma fonte de faturamento. Há uma proposta **opcional**, sem execução.

## Respostas

**Fonte do estoque inicial:** inventário fechado da unidade inteira (`estoque_contagens` + `estoque_contagens_itens.valor_total`, custo congelado) que abre o período.

**Fonte das compras:** `vw_compras` / `compras_itens`.
- Só compras **confirmadas**.
- A data é a do recebimento (ou da compra).
- O valor inclui frete e desconto rateados (o mesmo do custo médio).

**Fonte do estoque final:** inventário fechado da unidade inteira que fecha o período (valor congelado).

**Fonte do faturamento:**
- **Hoje: NENHUMA.** O CMV % aparece NÃO APURADO, com o motivo na tela.
- **Opcional:** "faturamento diário informado no Héfisto" (`fin_faturamento_diario`). Você lança, por dia, vendas brutas − cancelamentos − descontos e a fonte (por exemplo, relatório do Saipos).
- Só passa a valer se você aprovar e aplicar `db/F2_4C_FATURAMENTO_DIARIO_OPCIONAL.sql`. A tela detecta a tabela sozinha.

**Fórmula do CMV:** CMV R$ = estoque inicial + compras confirmadas do período − estoque final.
- Mercadoria + embalagens.
- Limpeza fica à parte, como consumo operacional.

**Fórmula do CMV %:** CMV R$ ÷ faturamento do mesmo período × 100.
- Faturamento = vendas − cancelamentos − descontos.
- Não é entrada bancária nem valor líquido de taxa.

**Como define períodos:**
- Entre contagens fechadas consecutivas. A mesma contagem fecha um período e abre o próximo; depois da última, o período fica EM ANDAMENTO.
- **Momento da contagem**, centralizado em `CONFIG_CMV`:
  - **Inicial e semanal:** na **abertura** do dia. O dia entra no período que começa nela (como no seu exemplo das 08:00).
  - **Fechamento do mês:** no **fim do dia**, para outubro ir de 01/10 a 31/10 inteiro.
  - **Fim de mês e início do mês seguinte:** "Fechamento de 31/10" e "Inicial de 01/11" são o mesmo momento, sem período vazio.
- **Filtros de semana e mês:** só apuram quando começam e terminam exatamente em inventários fechados. Fora disso, NÃO APURADO com o motivo, mas a análise de compras continua.

**Como trata compra cancelada:** não entra. Aparece no detalhe como "não entram (canceladas)". Rascunho também não entra.

**Como trata perdas:**
- O consumo por produto é **aparente** (inicial + compras − final). Inclui venda, produção, perda e desperdício, e a tela diz isso.
- Nunca é apresentado como venda.
- Não há perda datada por produto para separar: a etiqueta não guarda a data da perda, e não há nenhuma registrada.

**Como trata movimentações:** transferência entre locais não altera o CMV da unidade; o produto é somado em todos os locais. Testado.

**Como trata falta de dado:**
- Faltou inventário inicial ou final → NÃO APURADO.
- Produto com estoque ou compra no período e **sem contagem na outra ponta** → NÃO APURADO, com o nome do produto, e nunca zero. A tela mostra o valor parcial dos produtos contados nas duas pontas, avisando que **não é o CMV**.
- Mesmo produto em unidades diferentes → NÃO APURADO.
- Faltou um dia de faturamento → CMV % NÃO APURADO, com os dias que faltam.

**SQL novo:**
- **CMV R$: NÃO.**
- **CMV %:** opcional e **não executado**, `db/F2_4C_FATURAMENTO_DIARIO_OPCIONAL.sql`:
  - uma tabela, RLS por unidade;
  - sem DELETE para o app;
  - UPDATE só nos campos de valor e fonte;
  - auditoria de quem lançou;
  - rollback.

**Arquivos alterados:**

| Arquivo | O quê |
|---|---|
| `app/lib/cmv-real.mjs` | Motor puro: períodos, apuração, compras da janela, faturamento por dia, análises, comparação, médias, alertas, estoque parado, `cmvRealPeriodo` (para o DRE futuro). Convenções e limites em `CONFIG_CMV` |
| `app/lib/cmv-dados.mjs` | Leitura (inventários, itens, compras, insumos, fornecedores, faturamento opcional) e lançamento do faturamento diário |
| `app/dashboard/operacao/estoque/cmv/page.js` | Tela CMV Real |
| `app/lib/cmv-real.test.mjs` | Testes |
| `app/lib/permissions-catalog.mjs` (+ teste) | Permissão `estoque.cmv` (view; edit = lançar faturamento) |
| `app/components/layout/TopNavigation.js` | Operacional → "CMV Real" |
| `db/diagnosticos/F2_4C_AUDITORIA_FATURAMENTO.sql` | Auditoria só leitura (rodada) |
| `db/F2_4C_FATURAMENTO_DIARIO_OPCIONAL.sql` | Proposta opcional (não executada) |

Nenhum arquivo da F2.4A ou da F2.4B foi alterado.

**Tela** (Operacional → CMV Real):
- **Período:** entre contagens, duas contagens à escolha, esta semana, semana anterior, este mês, mês anterior, últimos 30 dias, personalizado.
- **Status:** APURADO / NÃO APURADO / EM ANDAMENTO, com os motivos.
- **Cards clicáveis com auditoria:**
  - **estoque inicial / final:** qual inventário, data, momento e valor por grupo, com link para o inventário;
  - **compras:** a lista de compras que forma o número, mais canceladas e rascunhos que não entram;
  - **CMV:** EI + C − EF, com mercadoria, embalagens e operacional;
  - **faturamento:** origem e dias que faltam;
  - **CMV %:** a conta.
- **Seções recolhíveis:**
  - evolução entre contagens, com histórico e valor de cada inventário;
  - análise de compras: total, nº, itens, fornecedores, ticket médio e rankings por valor e por quantidade, separados por kg / L / un, mais os maiores custos;
  - produtos mais consumidos;
  - variação de preço com histórico;
  - categorias;
  - alertas, com média, base, fonte e limite;
  - estoque com baixo giro;
  - médias históricas: "HISTÓRICO INSUFICIENTE" abaixo de 2 períodos e "baseada em N períodos" a partir disso;
  - faturamento (se habilitado);
  - "Como o CMV é calculado".

**Entradas e saídas por produto (pedido do dono durante a fase):**
- **Seção nova na tela**, com média por dia, por semana (×7) e por mês (×30).
- **Entrada** = compras confirmadas.
- **Saída** = inicial + entradas − final, a saída física apurada entre contagens.
- **Grupos:** inclui **embalagens e limpeza**, com filtro por grupo.
- **Média:** ponderada pelos dias, só nos períodos apurados.
- **"Estoque cobre N dias":** último estoque final ÷ saída média diária.
- **A contagem não registra entrada e saída item a item.** Ela é a foto do estoque. As entradas vêm de Compras e a saída é apurada entre duas fotos.

**Testes:** `app/lib/cmv-real.test.mjs` → **48/48**.

| Caso | Resultado |
|---|---|
| A) EI 1000 + C 500 − EF 800 | 700 ✓ |
| B) 700 ÷ faturamento 2000 | 35% ✓ |
| C) sem estoque final | NÃO APURADO (não zero) ✓ |
| D) sem faturamento | CMV 700, CMV % NÃO APURADO com motivo ✓ |
| E) compra cancelada | não entra ✓ |
| F) compra confirmada dentro do período | entra ✓ |
| G) compra fora do período (antes, ou no dia da contagem que abre o próximo) | não entra ✓ |
| H) contagens consecutivas | 01→08, 08→15, mais o período em andamento ✓ |
| I) transferência entre locais, limpeza e consumo | transferência não vira consumo; limpeza fora do CMV; consumo "aparente" ✓ |
| J) recarregar | mesmo resultado lido do banco duas vezes ✓ |

**Cenários extras:**
- **Cobertura:** produto sem contagem final ou inicial; produto zerado no início não exige contagem final; unidades misturadas.
- **Faturamento:** dia faltando; faturamento zero.
- **Mês:** inventário de 01/10 + fechamento de 31/10 = outubro inteiro, com a compra de 31/10 em outubro; fechamento de 31/10 + inicial de 01/11 sem período vazio; semana desalinhada.
- **Análises:**
  - rankings por unidade;
  - variação de preço (R$ 39,90 → R$ 42,50 = +R$ 2,60, +6,52%);
  - comparação semanal;
  - médias;
  - categorias;
  - estoque parado;
  - alerta de preço com média e limite.
- **Integração** (PGlite com F2.1 + SEC-FIN-2 + F2.4B):
  - inventários e compras criados pelas próprias telas;
  - cancelada fora;
  - limpeza à parte;
  - sem tabela de faturamento, mostra o motivo da auditoria;
  - com a tabela opcional: 7 dias lançados dão 33,33%; correção não duplica; validações; isolamento entre unidades; sem DELETE.

**Demais suítes:**

| Suíte | Resultado |
|---|---|
| Compras | 46/46 |
| Contagem (com F2.4B) | 53/53 |
| Contas a Pagar | 74/74 |
| F2.3 | 104/104 |
| Permissões | ok |
| Suíte do repositório | 44/45 (a falha de navegação já existia) |

**Build:** compila no compilador do Next (SWC). O build da Vercel roda ao enviar a branch (preview, não produção).

## Observações

- **Momento da contagem e saldo do custo médio:** a F2.4B considera que uma compra recebida no próprio dia da contagem já entrou nela. O CMV considera que a contagem inicial e a semanal acontecem na abertura do dia. Isso **não afeta o CMV**: só o peso do saldo no custo médio, para compras recebidas no dia de uma contagem. Pode ser alinhado depois (mudar uma comparação na função da F2.4B), se você quiser.
- **Contagem de 01/10 feita durante o dia:** ela vale como contagem na abertura do dia. Compras e vendas de 01/10 anteriores à contagem ficam no período 1; é imprecisão só do primeiro dia.
- **"Compras do mês" antiga e o DRE antigo:** continuam como estavam. O CMV real não usa nenhum dos dois.
- **DRE:** `cmvRealPeriodo()` já devolve o resultado estruturado: EI, compras, EF, CMV, faturamento, % e motivos.
