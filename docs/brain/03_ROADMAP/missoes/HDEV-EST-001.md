---
id: HDEV-EST-001
titulo: Estoque — reconstrução e unificação (tela única, unidades, painel)
fase: EST
status: VALIDATING
prioridade: 1
dependencias: []
bloqueadores: [aprovacao-merge, aprovacao-EST_UNI_1]
tentativas: 1
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-11
---

# HDEV-EST-001 — Estoque único

Pedido do dono (2026-10-11): auditar, consolidar numa experiência só, tirar Modo Quiosque e Modo Operação, corrigir unidades (24 garrafas de Corona ≠ 24 ml), painel secundário honesto.

Mapa da auditoria: [[ESTOQUE_AUDITORIA]] (`docs/brain/02_ARQUITETURA/ESTOQUE_AUDITORIA.md`).

## Feito (branch `claude/estoque-unico`, empilhado em `claude/paleta-clara`)

- Tela única `/dashboard/operacao/estoque`: Entrada/Retirada → área (Cozinha, Bar, Salão, Limpeza, Outros) → busca → saldo → quantidade + motivo → confirmar. Extras em "Mais opções".
- Unidades: `app/lib/estoque-unidades.mjs` (caixa → garrafa → ml com fator explícito; saldo mostrado como "24 garrafas"; mínimo do local convertido de garrafas para ml).
- Transferência pelo `estoque_transferir` (atômica). Antes "Retirada → Transferência" só tirava da origem.
- Abas: Movimentar · Inventário · Histórico · Painel · Produtos e locais.
- Painel: Não conferido / Zerado / Abaixo do mínimo / Normal / Inativo; "conferido" só sem pendências.
- Removidos: `EstoquePrincipal` (bug das unidades), `EstoqueHub` (lia `estoque_atual`), `TabletSetor` (Modo Operação; também em /bar/tablet e /operacao/cardapio/tablet), Modo quiosque. Rotas antigas redirecionam.
- Permissões: movimentação para `estoque.operation`/`estoque.movements`/saída/transferência/perdas; painel e produtos (custo) só `estoque.overview`.
- Migração proposta (não aplicada): `db/EST_UNI_1_UNIDADE_DE_COMPRA.sql`.

## Evidência

- TESTADO LOCAL: `estoque-unidades` + `estoque-areas` 21/21; permissões OK; intelligence 113/113 (18 pulados); build OK.
- TESTADO LOCAL (SQL real em PGlite): estoque-movimento 108, compras-estoque 46, contagem-estoque 57, cmv-real 48 — 0 falhas.
- TESTADO NO SUPABASE REAL (só leitura): auditoria, causa do erro de unidade, mínimo em garrafas.
- NÃO VALIDADO: telas no navegador (preview pede login; validar em produção depois do merge), celular.

## Rodada 2 (2026-10-11)

- PRs #144 e #145 sem conflito (main não andou). Testes repetidos: tudo verde exceto navegacao e folgas-domingo (RH, já falhavam na main).
- contas-pagar: 2 falhas por data real corrigidas com "hoje" fixo (fin_hoje = 2026-10-05) → 74/74.
- Plano Supabase FREE: sem backup automático/PITR → migrações fazem cópia na mesma transação (RLS ligado, sem grant).
- Preparados, NÃO executados: `db/EST_UNI_1`, `db/EST_LOCAL_1_SALAO`, `db/LIMPEZA_TESTES_FIN_20261011` (16 casos em PGlite para as migrações).
- Duplicados: [[ESTOQUE_DUPLICADOS]].

## Pendente (decisão do dono)

1. Merge dos PRs (paleta #144 e este) — produção.
2. Aplicar `EST_UNI_1` (aditiva) e preencher "caixa com N" nos produtos.
3. Cadastro duplicado (Heineken ×4, Corona ×3…) — unificar exige mover saldo/histórico.
4. Não existe local "Salão" (só "Pré-preparos do Salão"): criar em Produtos e locais.
5. Estoques paralelos ainda com dado: `operacao_embalagens` (5), `inventario_itens` (patrimônio, 2), `suprimentos_*`, `estoque_atual` (espelho legado lido por ERPContext, produção, etiquetas, relatórios). Migrar = mudança de dado planejada.
6. `lib/estoque.js` e `lib/compras.mjs` chamam funções/tabelas que não existem (produção integrada, devolução ao fornecedor): caminhos quebrados, fora desta tela.
7. `saldo_fechado`/`saldo_aberto` divergem do saldo real (Corona: 12 garrafas no saldo, 8 no fechado). A tela usa só `quantidade_atual`; o campo antigo continua no banco.
