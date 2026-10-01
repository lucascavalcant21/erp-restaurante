# F2.4A — INVENTÁRIO / CONTAGEM DE ESTOQUE

Data: 2026-10-01 · Branch `fase-f2-4/inventario-cmv`. **Sem migration. Nada executado em produção.**

## 1. Auditoria do banco real (01/10)

Fonte: `db/diagnosticos/F2_4A_AUDITORIA_ESTOQUE.sql`, rodado pelo dono.

### Contagem: o banco já suporta, sem migration

- **Tabelas da F2.1 existem e estão vazias:** `estoque_contagens` e `estoque_contagens_itens`.
- **Isolamento por unidade:** RLS com a regra `pode_ver_todas()` ou a própria unidade.
- **Triggers ativos:** auditoria; item herda a unidade; contagem fechada é imutável; fechar exige custo em todos os itens.
- **Restrições:**
  - tipo `inicial` / `intermediaria` / `final` / `ajuste`;
  - status `aberta` / `fechada` / `cancelada`;
  - unidade base `g` / `ml` / `un`;
  - quantidade maior ou igual a 0;
  - um único fechado por unidade, local, data e tipo;
  - um item por inventário, produto e local.
- **Permissões:** o app não tem DELETE nos itens. Item contado se corrige; não se apaga.

### Cadastro existente

- **Unidade de produção:** só existe uma, `seldeestrela`.
- **Locais:** 11 estoques ativos.
  - Cozinha;
  - Bar (locais Depósito, Expositor 1 e 2, Balcão refrigerado);
  - Pré-preparos da Cozinha, do Bar e do Salão;
  - Limpeza, Materiais variados, Embalagens (geral, Cozinha, Bar), Depósito.
- **Insumos:** 358 no total.
  - unidades: g 34, kg 124, l/L 58, ml 94, un 46, garrafa 2;
  - 307 têm custo unitário e 341 têm preço de embalagem.
- **Vínculos produto × local (`estoque_itens`):** 363.
  - Bar 149, Cozinha 153, Pré-preparos Cozinha 41, Pré-preparos Bar 10, Embalagens 9, Limpeza 1.
- **Custo médio (`estoque_custos`):** 0 linhas. As compras ainda não começaram.

### Regras abertas, sem filtro de unidade

| Tabela | Policy | Situação |
|---|---|---|
| `estoque_itens` | `auth_all`, `estoque_itens_auth_full` | USING true / CHECK true |
| `estoque_lotes` | `estoque_lotes_all` (papel **public**) | USING true / CHECK true |
| `estoques`, `estoque_movimentacoes_multi` | `auth_all` e outras | USING true |
| `estoque_atual`, `insumos`, `produtos`, `fichas_tecnicas` | "Acesso Total …" (public) | USING true |

- **Hoje nada vaza:** só existe uma unidade.
- **A próxima unidade nasceria aberta.**
- **Proposta para as duas tabelas que você citou:** **SEC-EST-1** (seção 4). As demais ficam para uma etapa própria: `insumos`, `produtos` e `fichas` também servem Mesa e KDS, que você pediu para não mexer.
- **Higiene:** o anon ainda tem REFERENCES, TRIGGER e TRUNCATE em várias tabelas de estoque. Não é usável pela API, mas sai na SEC-EST-1 para as duas tabelas.

## 2. O que foi feito

### Tela `/dashboard/operacao/estoque/contagens`

No menu: Operacional → **Inventários / Contagens**.

**Painel**
- última contagem fechada e seu valor;
- próxima contagem;
- contagens em andamento;
- ciclo do mês: 01 inicial; 08, 15, 22 e 29 semanais; 31 fechamento;
- histórico com valor.
- Os registros do ciclo **não são criados automaticamente**.

**Nova contagem**
- data, tipo e observação; o tipo é sugerido pelo ciclo;
- um inventário cobre a unidade inteira, e cada pessoa escolhe o local na hora de contar;
- abrir duas vezes reaproveita o inventário aberto.

**Contar** (pensado para o celular)
- **Local:** Cozinha / Bar / Pré-preparos / Outros, com sub-local quando o grupo tem mais de um.
- **Busca:** por nome, nome interno ou código.
- **Filtros:** categoria; contados e não contados; ordem alfabética.
- **Cada linha:** nome, unidade do cadastro, campo de quantidade, **✓ Contado** e **Zero**. "Enter" grava e pula para o próximo item não contado.
- **Progresso:** "47 / 132 produtos contados · 36% · não contados: 85", geral e do filtro atual.
- **Salvamento progressivo:**
  - cada confirmação vai para uma fila guardada no aparelho e é enviada na hora;
  - sem internet, a fila fica no aparelho e é reenviada a cada 15 s e quando a conexão volta;
  - o navegador avisa antes de fechar com itens não enviados;
  - gravações repetidas do mesmo produto e local, de outro celular ou por retry, corrigem a mesma linha.
- **Zero:** grava 0 de verdade. "Não contado" é a ausência de linha.
- **Produto fora do local:** a busca também mostra produtos do cadastro que não estão vinculados ao local escolhido, para contar lá.
- **+ Produto não cadastrado:** nome, unidade, local e quantidade ficam como **PENDENTE DE CADASTRO** dentro do inventário. **Nenhum insumo é criado.** A pendência pode ser marcada como "cadastrado e contado" ou "descartada".

**Finalizar inventário** (só quem tem a permissão de finalizar)
1. **Resumo:**
   - mostra produtos contados, zerados e não contados (por local) e as pendências;
   - se houver não contados ou pendências, exige marcar **"Estou ciente"**: os não contados ficam fora e **não viram zero**;
   - bloqueia enquanto houver item na fila sem envio.
2. **Valorização:**
   - **custo sugerido por produto, com a origem visível:**
     - **conferido:** o custo unitário do cadastro bate com preço da embalagem ÷ tamanho;
     - **sem conferência:** o cadastro tem só um dos dois valores;
     - **divergente:** os dois não batem; nada é aplicado sozinho, e a pessoa escolhe um ou digita;
     - **sem custo**;
   - quando existir, o **custo médio das compras** (`estoque_custos`) tem prioridade.
   - **Por que a conferência existe:** o cadastro antigo mistura convenções. A própria tela de estoque usa heurísticas para isso, como "custo < 0,50 multiplica pela embalagem".
   - **Fechar:**
     - exige confirmação explícita;
     - grava o custo **por unidade base** e a origem do custo em cada item (`observacao`), depois muda o status para **FECHADO**;
     - o banco recusa fechar se algum item contado estiver sem custo;
     - depois de fechado, nada muda: quantidade, custo, novo item, reabrir e pendência são todos recusados.

**Inventário fechado**
- valor total;
- tabela com quantidade, custo e valor, e a origem de cada custo;
- **comparação com um inventário anterior:** anterior, atual e diferença **física**. A tela avisa que isso **não é consumo**: pode haver compra, produção, perda, transferência, venda ou ajuste no meio.

### Unidades

- **kg↔g e L↔ml:** únicas conversões automáticas. O banco guarda em g ou ml.
- **Garrafa, lata, caixa, pacote etc.:** contados como estão no cadastro (base "un"), **sem conversão inventada**.
- **Exibição:** sempre na unidade do cadastro.

### Saldo esperado × contado

- A primeira gravação guarda o saldo do Controle de Estoque naquele momento (`quantidade_sistema`). O banco calcula `diferenca`.
- **Correções não sobrescrevem o esperado.**
- **Atenção:** o saldo antigo pode estar em outra convenção, por exemplo ml totais em vez de garrafas. Por isso ele ainda não é exibido como divergência.

### O que a contagem NÃO faz

- **Não altera o saldo do Controle de Estoque.** Aplicar o inventário ao saldo é uma decisão sua; vai como ajuste com histórico em outra etapa.
- **Não cria insumo.**
- **Não calcula CMV.** Isso é a F2.4C.

### Permissão

- **Nova entrada no catálogo:** `estoque.counts`, com as ações `view`, `inventory` e `close_inventory`.
  - **Contador** (`estoque.counts.view`): entra na contagem e **não** ganha a tela de estoque com custos.
  - **Finalizar e cancelar:** exigem `close_inventory`.
  - **Admin, super admin e usuários não gerenciados:** como hoje.
- **Para liberar a contagem a um funcionário com perfil gerenciado:** conceder "Contagem de estoque (inventário)" em Configurações → Usuários.

## 3. Arquivos

| Arquivo | O quê |
|---|---|
| `app/lib/contagem-estoque.mjs` | Regras: unidades, ciclo, progresso, resumo, custo sugerido, fila, comparação; gravação, pendências, fechar e cancelar (recebem o `db`) |
| `app/lib/estoque-contagens.js` | Leituras com o cliente do app (só leitura de estoques, itens e insumos) |
| `app/dashboard/operacao/estoque/contagens/page.js` | Painel, contagem, finalizar e fechado |
| `app/lib/permissions-catalog.mjs` | Entrada `estoque.counts` |
| `app/components/layout/TopNavigation.js` | Link "Inventários / Contagens" |
| `db/diagnosticos/F2_4A_AUDITORIA_ESTOQUE.sql` | Auditoria só leitura (já rodada) |
| `db/security/SEC_EST_1_*` | Prévia, correção e rollback (seção 4) |

## 4. SEC-EST-1 (proposta, NÃO executada)

**O que faz:**
1. Troca as 3 policies abertas por `estoque_itens_unidade` e `estoque_lotes_unidade`: `pode_ver_todas()` ou a própria unidade, só para authenticated.
2. Tira do anon tudo o que restava nessas duas tabelas.
3. Tira do authenticated TRUNCATE, REFERENCES e TRIGGER. SELECT, INSERT, UPDATE e DELETE continuam.

**Garantias:**
- **Backup:** as policies atuais vão para `sec_backup_policies_sec_est_1`, que o app não consegue ler.
- **Aborta sem mudar nada se:** faltarem as funções de unidade, ou existir outra policy nessas tabelas.
- **Rollback:** volta exatamente ao estado de 01/10.
- **Prévia:** mostra usuário por usuário quantas linhas cada um vê hoje e depois. Com uma unidade só, o esperado é que ninguém com unidade perca nada; quem não tem unidade nem visão de rede perde o acesso.

## 5. Testes

| Suíte | Resultado |
|---|---|
| `app/lib/contagem-estoque.test.mjs` (puras + PGlite com o SQL real da F2.1, RLS e grants de produção) | **53/53** |
| `scripts/test_sec_est_1_estoque_itens_lotes.mjs` | **20/20** |
| `app/lib/permissions-catalog.test.mjs` | ok (com 3 casos novos de contagem) |
| F2.3 (com e sem SEC-FIN-2) | 104/104 |
| Suíte do repositório | 40/41. A falha é a de navegação, que já existia (`/dashboard/reservas-eventos/eventos`) |

**Cenários da contagem cobertos:**
- **Gravação:**
  - 8,350 kg vira 8350 g;
  - corrigir mantém a mesma linha e o saldo do sistema original;
  - outro celular gravando o mesmo produto não duplica;
  - **zero ≠ não contado**;
  - o mesmo produto em dois locais vira duas linhas.
- **Pendências:**
  - ficam pendentes sem criar insumo;
  - duas ao mesmo tempo não se perdem.
- **Fechamento:**
  - é recusado sem confirmação e sem custo, inclusive pelo trigger;
  - fecha com o custo congelado: 8,350 kg × R$ 46,67 = **R$ 389,69**; total de **R$ 675,69**.
- **Depois de fechado:** tudo recusado; segundo inventário inicial fechado na mesma data recusado.
- **Isolamento:** outra unidade não vê nem grava.
- **Outros:** comparação 8,350 → 6,500 kg = −1,850 kg; cancelamento com motivo.
- **Unidades e ciclo:**
  - outubro: 01, 08, 15, 22, 29 e 31;
  - fevereiro com 29 dias: o dia 29 é o fechamento;
  - garrafa com conteúdo em ml: a embalagem é a própria garrafa.

**Verificação visual:** **não foi feita.** Não consigo logar no app. A página compila no mesmo compilador do Next; a validação no celular fica com você na primeira contagem.

## 6. Pendente / próximas etapas

- **Pendências de cadastro:** ficam no campo `observacao` do inventário, em JSON. É um registro provisório, sem migration. Se quiser uma tabela própria (consultável e com histórico), entra na migration da F2.4B.
- **Aplicar o inventário ao saldo do Controle de Estoque:** ajuste com motivo, responsável e data.
- **F2.4B:** Compras, recebimento pedido × recebido, custo médio (a fórmula única já está no banco), histórico de preço, perdas, transferências, ajustes.
- **F2.4C:** CMV real em R$ e em %:
  - fica **NÃO APURADO** enquanto faltar inventário inicial ou final fechado, compras confiáveis ou receita confiável;
  - semanais por intervalo;
  - análises e médias históricas (os complementos que você mandou).
- **SEC-EST-2:** as demais tabelas com USING true (seção 1), em etapa própria.
