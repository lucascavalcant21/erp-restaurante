# HI-02: evidências da ativação real (07/10/2026)

Ambiente:
- Supabase `sezccspqxgklicfndwxx` (Postgres 17.6, sa-east-1).
- Uma empresa e uma unidade em produção (`seldeestrela`).

Todos os testes que escrevem foram feitos numa transação desfeita no fim. Depois de cada um, foi conferido que nada ficou no banco.

## 1. Migração IC_01 (ic-01.2)

| Item | Resultado |
|---|---|
| Preflight (`IC_01_PREFLIGHT.sql`) | sem BLOQUEIA depois do contexto legado (seção 2) |
| Arquivo aplicado | `IC_01_INTELLIGENCE_CORE.sql`, sha256 `95b3b861…e9c3` |
| Como | uma transação (`begin … commit`) pelo SQL do conector Supabase |
| Diferença do arquivo | sem as 9 linhas `drop … if exists` |
| `IC_01_VERIFICACAO.sql` | **todas as linhas OK**: 4 tabelas com a versão, RLS, 4 policies sem extras, 2 triggers, 6 índices, matriz de grants 3×4×5, FKs e checks |
| Impressão digital das colunas | **`d55eda66f4eddaf4d90ce66743131071`** (igual à do teste) |
| Advisors de segurança | nenhum achado nas tabelas `intelligence_*` |

Por que as 9 linhas `drop … if exists` ficaram de fora:
- São de constraint, trigger e policy da própria migração.
- Num banco sem nenhum objeto `intelligence_*` (conferido antes), elas não fazem nada.
- O conector trava em qualquer `DROP` esperando confirmação manual. Por isso, as duas primeiras tentativas expiraram sem aplicar nada (também conferido).

## 2. Contexto da requisição sem a Fase 1B

O banco real **não tem** `hefisto_contexto_requisicao`: a Fase 1A/1B de segurança não foi aplicada. Sem isso, toda chamada autenticada daria 503.

Quando o RPC não existe, o servidor monta o mesmo contexto com funções que já existem:
- `hefisto_session_context()`;
- `hefisto_user_in_unit()`;
- `unidades.empresa_id`.

O código está em `app/lib/intelligence/context/contexto-legado.mjs`.
- Qualquer outro erro continua falhando fechado.
- A decisão de cada ação continua em `hefisto_user_can`.

## 3. Quem abre a Central

Valores de `hefisto_user_can` com a identidade real de cada perfil:

| Perfil | Usuários | Central | Configurações | Registrar perda | Unidade forjada |
|---|---|---|---|---|---|
| dono / super admin | 1 | 200 | sim | sim | recusada pelo código (unidade não existe) |
| gerente-geral (`dashboard.*`) | 2 | 200 | sim | sim | recusada |
| somente-consulta | 11 | **403** | não | não | recusada |
| cozinheiro | 2 | **403** | não | não | recusada |
| sem cadastro | – | **403** | não | não | recusada |

Nenhuma permissão foi concedida ou alterada.

## 4. As 10 perguntas com dados reais

**Método:**
- **Código:** a casca HTTP real (`atenderInteligencia`) e o motor real.
- **Contexto e permissões:** lidos no banco para um gerente real.
- **Linhas:** lidas no banco **sob RLS, com a identidade desse gerente** (`set role authenticated` + claims), nas colunas que o motor pede.

**Transcrição conferida contra o banco:**
- contagens;
- somas de saldo, mínimo, lotes, contas, folha e recibos;
- md5 dos nomes de produto e dos códigos de etiqueta.

**Todas iguais.**

| Pergunta | Resposta (resumo) | Conferência |
|---|---|---|
| Como foi minha empresa hoje? | 2 situações; 3 indicadores sem dados suficientes | ok |
| Quanto vendi hoje? / esta semana? | DADOS INSUFICIENTES (faturamento não lançado) | 0 linhas em `fin_faturamento_diario` |
| Quanto comprei esta semana? | DADOS INSUFICIENTES (nenhuma compra em 90 dias) | 0 compras |
| Maior aumento de preço | DADOS INSUFICIENTES | 0 compras |
| Próximos do vencimento | lotes sem validade + etiquetas ativas vencidas | **corrigido nesta fase** (seção 4.1) |
| Diferença estranha no estoque | 2 produtos com saldo ≠ soma dos lotes | **corrigido nesta fase** (seção 4.1) |
| Contas a vencer | 5 vencidas, R$ 7.930,98 | soma conferida linha a linha |
| CMV | DADOS INSUFICIENTES (nenhum inventário fechado) | 1 contagem, aberta |
| CMO | R$ 14.427,14 (folha R$ 13.607,14 + extras R$ 820,00) | conferido à mão |

Nenhum número foi preenchido: o que não tem base sai DADOS INSUFICIENTES, com o motivo.

O **Daily Brief** com os mesmos dados:
- **CRÍTICO:** 5 contas vencidas, com a pergunta "Essas contas já foram pagas?".
- **IMPORTANTE:** 8 itens abaixo do mínimo.
- **INFORMAÇÃO:** saldo × lotes.

### 4.1 Corrigido com o dado real

- **Validade:** com 55 lotes sem validade, a resposta era DADOS INSUFICIENTES, mas havia 653 etiquetas ativas vencidas.
  - As etiquetas agora são lidas antes, com o total via `count`.
  - A resposta diz que os lotes estão sem validade e quantas etiquetas vencem.
- **Divergências:** lote com saldo num local/produto sem linha de saldo não era conferido (2 lotes, 54.036 un). Agora entra como saldo 0.

## 5. Perda controlada (produto de teste, transação desfeita)

O fluxo real foi:
1. "Perdi 2 kg de Produto Teste Héfisto HI-02."
2. A conversa pergunta o motivo.
3. A prévia mostra: Cozinha, 2 kg, saldo 5 → 3 kg. **Nada é gravado antes de CONFIRMAR.**
4. CONFIRMAR gera **uma** chamada a `estoque_movimentar`.
5. CONFIRMAR de novo devolve `repetido`, sem nova chamada.

A mesma chamada foi executada na **função real**, com o gerente real e um produto de teste criado dentro da transação:

| Conferência | Resultado |
|---|---|
| Saldo | 5 → **3** kg |
| Movimento | `saida/perda`, origem `movimentacao`, registrado pelo usuário logado, observação "Via Héfisto Intelligence — limpeza/aparas" |
| Mesma chave de novo | `idempotente: true`, mesmo `movimento_id`, **1** movimento com a chave, saldo continua 3 |
| Somente-consulta tenta a perda | recusado pelo banco: "Sem permissão para lançar retirada de estoque nesta unidade." |
| Auditoria (linhas exatas do store de produção, pela service role) | 1 ação + 5 eventos: pedido, proposta, confirmação, execução |
| Ação repetida | `unique_violation` (chave de idempotência) |
| RLS da auditoria | o dono lê 1 ação e 5 eventos; somente-consulta lê 0 e 0; o app ao inserir recebe `permission denied` |
| Depois | produto de teste, movimentos e linhas de auditoria: **0**. Totais originais iguais (363 produtos, 345 movimentos) |

## 6. Isolamento com um segundo tenant real (transação desfeita)

Foram criadas a empresa B e a unidade B (marcador 999999), com o saldo de B gravado pela função real.

| | gerente A | somente-consulta A | super admin |
|---|---|---|---|
| Central na unidade B | **403** (`in_unit` e `user_can` falsos) | **403** | permitido (por desenho) |
| `intelligence_eventos` / `intelligence_preferencias` de B | **0 / 0** | **0 / 0** | vê |
| Faturamento, saldo, lotes e movimentos de B | 0 | 0 | vê |
| `insumos`, `estoques`, `etiquetas` e `unidades` de B | **vê** | **vê** | vê |

O motor real foi rodado com as linhas de B que o banco deixa o gerente A ler, misturadas às de A:
- 10/10 respostas e o brief com 200;
- **nenhum** 999999, "Marcador B" ou unidade B em resposta, métrica ou auditoria;
- todas as métricas e eventos na unidade A.

**Conclusão:** a inteligência não vaza.

A última linha da tabela é exposição **anterior** do ERP: policies `using (true)` nessas tabelas e em `colaboradores`, `registro_ponto`, `rh_recibos_prestacao` e `usuarios_erp`. Ver a seção 8.

## 7. Vercel

- Preview do branch: **READY**.
- `SUPABASE_SERVICE_ROLE_KEY` existe em preview e produção (tipo *sensitive*, fora de `NEXT_PUBLIC_`).
- `ANTHROPIC_API_KEY` existe, mas o Vercel aponta `readable-secret`: marque como *Sensitive*.
- Build local OK, sem segredo no bundle.

## 8. Achados anteriores ao Intelligence Core (não corrigidos sem autorização)

- **CRÍTICO:** `colaboradores` e `registro_ponto` estão com RLS **desligado**. Qualquer usuário logado lê tudo (advisor ERROR).
- **CRÍTICO para multiempresa:** as policies `using (true)` deixam qualquer usuário logado ler, de outras unidades:
  - `insumos`, `estoques`, `etiquetas` e `unidades`;
  - `usuarios_erp`, `rh_recibos_prestacao` e `colaboradores`.

  Hoje não vaza entre empresas porque só existe uma.
- A Fase 1A/1B de segurança não está aplicada.
- O teste `app/lib/permissions-catalog.test.mjs` falha também na `main`: 4 telas de eventos/orçamento caem na entrada genérica.
