# Estoque — auditoria e mapa (HDEV-EST-001, 2026-10-11)

Evidência: código do branch `claude/estoque-unico` + leitura do Supabase real (`sezccspqxgklicfndwxx`). TESTADO NO SUPABASE REAL (só leitura).

## 1. Fonte de verdade (fica)

| Papel | Onde |
|---|---|
| Cadastro mestre | `insumos` (363) |
| Locais | `estoques` (11, unidade `seldeestrela`) |
| Saldo por local | `estoque_itens` (368) — `quantidade_atual` na **unidade base** (g, ml, un) |
| Movimentos auditáveis | `estoque_movimentacoes_multi` (346) — imutável por trigger, sem TRUNCATE |
| Lotes / validade | `estoque_lotes` (56) |
| Custo médio | `estoque_custos` + `estoque_custos_historico` |
| Inventário | `estoque_contagens` + `estoque_contagens_itens` |
| Motor | RPC `estoque_movimentar` (permissão, PIN no ajuste, idempotência, lotes, custo) · `estoque_transferir` · `estoque_estornar` · `estoque_ajustar_inventario` |
| Compras | RPC `compras_confirmar` / `compras_cancelar` (usam o motor; estorno por trigger `estoque_estorno_compra`) |

## 2. Estruturas paralelas / mortas

| Estrutura | Estado | Quem ainda usa |
|---|---|---|
| `estoque_atual` (290) | espelho legado, sincronizado no cliente depois de cada movimento | `lib/estoque.js` → **EstoqueHub (dashboard)**, ERPContext, CozinhaHub, produção, etiquetas, relatórios, rede, `central-comando.js`, devolução em `compras.mjs` |
| `estoque` (4) / `estoque_movimentacoes` (0) | legado | `cervejas/tablet` |
| `cervejas` (0) | estoque próprio vazio | `/dashboard/cervejas` |
| `operacao_embalagens` (5) | estoque próprio | `/dashboard/operacao/embalagens` |
| `inventario_itens` (2) | patrimônio/utensílios | `/dashboard/gestao/inventario` |
| `ingredientes` (4) | legado | — |
| RPC `registrar_movimento_estoque`, `confirmar_producao_integrada`, `prever_producao_integrada`, `confirmar_recebimento_integrado` | **não existem no banco** | `lib/estoque.js`, `lib/compras.mjs` (caminhos quebrados) |
| tabela `estoque_movimentos`, `pedidos_compra`, `recebimentos_compra` | **não existem** | `lib/compras.mjs` (devolução e pedido antigos) |

## 3. Telas de estoque hoje

| Rota | O que é | Destino |
|---|---|---|
| `/operacao/estoque` (padrão) | `EstoquePrincipal` — 3ª tela de movimento; **bug de unidade** (ver §4) e busca com regex quebrada | substituída pela tela única |
| `/operacao/estoque?gestao=1` | `EstoqueRunner` 2.400 linhas: dashboard `EstoqueHub` + **Modo quiosque** + abas | vira aba Dashboard, sem quiosque |
| `/operacao/estoque/movimentar` | Entrada/retirada EST-MOV (motor correto, `quantidadeDoLancamento`) | base da tela única |
| `/operacao/estoque/tablet` | **Modo Operação** (`TabletSetor`, 1.363 linhas) | removido → redireciona |
| `/operacao/estoque/contagens` | Inventário | aba Inventário |
| `/operacao/estoque/compras`, `/cmv`, `/calendario` | relatórios | mantidos (secundários) |
| `/configuracoes/estoque` | PIN e contagem cega | mantido |
| Menu Operacional → Estoque | aponta para `?gestao=1` (abre o dashboard) | aponta para a tela única |

`TabletSetor` também é usado em `/bar/tablet` e `/operacao/cardapio/tablet` (fora do escopo: não removido).

## 4. Erro das unidades (causa)

Bebidas estão cadastradas com `unidade_medida = 'ml'` e `tamanho_embalagem = 330`. O saldo fica em ml (correto e consistente com o motor). Mas:

1. `EstoquePrincipal` chama a unidade base de "unidade de estoque": **24 digitado em "ml" grava 24 ml**, não 24 garrafas; e "Caixa (x330 mls)" é o rótulo da garrafa.
2. `saldo_fechado` (garrafas) só muda quando a tela manda `detalhe.embalagens`; os caminhos antigos não mandam → diverge. Real: Corona 3.960 ml (12 garrafas) com `saldo_fechado = 8`; Heineken zero 15.840 ml (48 latas) com 3.
3. Não há fator de **compra** (caixa com 12): `tamanho_embalagem` é o conteúdo da garrafa.
4. Cadastro duplicado: "Heineken " / "Heineken - Long neck zero 330ml" (un) / "Heineken zero"; "Corona" / "Corona Long Neck". Limpeza do cadastro = decisão do dono (não feita).

**Correção sem migrar dados:** o saldo continua em unidade base (`quantidade_atual`, fonte de verdade). A tela converte com perfil explícito (`app/lib/estoque-unidades.mjs`): base (ml) ↔ operacional (garrafa = 330 ml) ↔ compra (caixa = N garrafas). `saldo_fechado` deixa de ser exibido como verdade.

## 5. Integrações

- Compras → `compras_confirmar` (motor, origem `compra`): não duplica; a tela de movimento não oferece "recebimento de compra" manual quando a compra já entrou.
- Produção → `registrarProducaoNoEstoquePreparo` (motor). `lib/estoque.js` de produção integrada chama RPC inexistente.
- Etiquetas → motor (origem `etiqueta`).
- CMV → contagens (`contagem-estoque.mjs`).
- Inventário → `estoque_ajustar_inventario` (PIN).
