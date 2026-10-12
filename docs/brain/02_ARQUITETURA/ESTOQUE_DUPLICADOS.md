# Estoque — auditoria de produtos duplicados (HDEV-EST-001, 2026-10-11)

TESTADO NO SUPABASE REAL (só leitura). Nada foi unido, renomeado nem excluído.

## Limites da comparação

- **Código de barras:** não existe no cadastro de insumos; só em `produtos` (venda), e nenhuma Heineken/Corona tem produto de venda. Não deu para comparar.
- **Fornecedor:** vazio em todos. **Custo médio:** vazio em todos (nenhuma compra registrada pelo módulo Compras).
- Comparado: nome, marca, unidade, embalagem, saldo por local, movimentos, fichas, compras, histórico de preço, data de criação.

## Heineken

| id (início) | nome | unidade / embalagem | saldo (Bar) | mov. | criado | veredito |
|---|---|---|---|---|---|---|
| d48708f1 | Heineken | ml · 600 | 28.800 ml = **48 garrafas 600 ml** | 7 | 06/07 | **principal (600 ml)** |
| 47ca891c | Heineken - 600ml | un · 1 · R$ 7,60 | 0 | 0 | 30/07 | **duplicado real** do d48708f1 (mesma garrafa 600 ml, cadastro em "un", nunca usado) |
| dda5ada5 | "Heineken " (espaço no fim) | ml · 330 | 9.900 ml = **30 long necks** | 9 | 06/07 | **variação legítima** (330 ml ≠ 600 ml); nome confuso → renomear para "Heineken Long Neck 330 ml" |
| 79a931da | Heineken zero | ml · 330 · lata | 15.840 ml = **48 latas** | 8 | 06/07 | **principal (zero 330)** |
| 7d57e434 | Heineken zero - Long neck 330ml | un · 1 · R$ 5,70 | 0 | 0 | 30/07 | **duplicado real** do f8877024 (mesmo produto, palavras trocadas, mesmo custo e dia). Em relação ao 79a931da: lata × long neck — **confirmar com o dono** |
| f8877024 | Heineken - Long neck zero 330ml | un · 1 · R$ 5,70 | 0 | 0 | 30/07 | ver linha acima |

## Corona

| id (início) | nome | unidade / embalagem | saldo (Bar) | mov. | criado | veredito |
|---|---|---|---|---|---|---|
| 9d75bef9 | Corona | ml · 330 · garrafa | 3.960 ml = **12 garrafas** | 4 | 06/07 | **principal** |
| 79220b02 | Corona Long Neck | ml · 330 | 0 | 0 | 30/07 | **duplicado real** do 9d75bef9 (a Corona 330 é a long neck), nunca usado |
| ac01cd2e | Corona zero | ml · 330 · garrafa | 11.880 ml = **36 garrafas** | 3 | 06/07 | **principal (zero)** |
| 1ce6cc2d | "Coroa zero" (erro de digitação) | un · 1 · R$ 1,00 | **24 un** | 1 (08/10, Lucas) | 28/07 | **duplicado real** do ac01cd2e. Tem saldo: unir exige mover as 24 un (= 7.920 ml) |

Nenhum dos 10 está em ficha técnica, compra ou produto de venda: unir não quebra receita nem CMV.

## Proposta (só com aprovação, item a item)

1. **Sem saldo e sem movimento** (47ca891c, 7d57e434 ou f8877024, 79220b02): marcar como inativos/arquivados. Não excluir (o histórico de preço aponta para eles). *Não existe campo "ativo" em insumos*: precisa de migração aditiva (`insumos.arquivado_em`) ou de renomear com prefixo "[ARQUIVADO]".
2. **"Coroa zero" (24 un):** decidir se a entrada de 08/10 foi teste.
   - Se foi teste: estornar a entrada (admin + PIN pelo Histórico). O saldo vai a 0 e o item cai no passo 1.
   - Se é estoque real: lançar a retirada "ajuste autorizado" de 24 un no Coroa zero e a entrada de 24 garrafas na Corona zero, ambas com a mesma justificativa.
3. **"Heineken " (330):** renomear para "Heineken Long Neck 330 ml" (só o nome; o id e o histórico ficam).
4. **Lata × long neck da Heineken zero:** o dono diz se vende os dois.

## Outros nomes repetidos (fora de Heineken/Corona)

São 30 grupos com o mesmo nome normalizado, por exemplo Açúcar (kg/g/L), Maniçoba ×3, Carne de sol ×3, Arroz branco (5 kg / 1 kg) e Gin (900/750 ml).

Parte deve ser legítima:
- embalagens diferentes (Gin 900 × 750);
- insumo cru × pré-preparo da ficha.

Parte é duplicado real: "Açúcar" em kg, g e L ao mesmo tempo. Precisa da mesma análise, item a item, antes de qualquer união.

## Tabela de correspondência (proposta, NÃO executada)

Referências conferidas em TODAS as tabelas com `insumo_id` (fichas, compras, contagens, custo médio, custo histórico, fornecedores, embalagens, lotes, movimentos, preços, estoque_atual legado). Custo = `custo_compra` do cadastro convertido para a embalagem (não há custo médio: nenhuma compra pelo módulo Compras).

| Duplicado (id) | Unidade | Saldo | Custo cadastro | Referências | → Fica (id) | Unidade | Saldo | Custo cadastro | Referências |
|---|---|---|---|---|---|---|---|---|---|
| Heineken - 600ml (47ca891c-4503-492e-adc7-ddf5d90afe53) | un | 0 | R$ 7,60/un | estoque_itens 1, preços 1, legado 1 | Heineken (d48708f1-5ece-4b63-a933-7abe58be4806) | ml · 600 | 48 garrafas (28.800 ml) | R$ 7,60/garrafa | itens 1, lotes 1, mov 7, preços 1, legado 1 |
| Heineken zero - Long neck 330ml (7d57e434-e058-4064-87b6-74996ab847b3) | un | 0 | R$ 5,70/un | estoque_itens 1, preços 1, legado 1 | Heineken - Long neck zero 330ml (f8877024-3790-4e9e-85f4-57f3968b517b) **ou** Heineken zero (79a931da-…) — dono decide (long neck × lata) | un / ml · 330 | 0 / 48 latas | R$ 5,70 / R$ 7,00 | itens 1, preços 1 / mov 8, lotes 1, preços 3 |
| Corona Long Neck (79220b02-d974-4f03-aa19-12b9eed85480) | ml · 330 | 0 | R$ 2,00 (valor suspeito) | estoque_itens 1, preços 1, legado 1 | Corona (9d75bef9-1559-4228-b419-977ee68a683a) | ml · 330 | 12 garrafas (3.960 ml) | R$ 6,90/garrafa | itens 1, lotes 1, mov 4, preços 3, legado 1 |
| Coroa zero (1ce6cc2d-5098-4c93-a629-51bae64f35db) | un | **24 un** | R$ 1,00/un (valor suspeito) | itens 1, lotes 1, mov 1 (08/10), preços 1, legado 1 | Corona zero (ac01cd2e-426d-42d3-bd32-bd9d7fb2f4bd) | ml · 330 | 36 garrafas (11.880 ml) | R$ 6,90/garrafa | itens 1, lotes 1, mov 3, preços 3, legado 1 |
| — (variação legítima) "Heineken " (dda5ada5-f856-431a-acdd-b623c0a240f4) | ml · 330 | 30 long necks (9.900 ml) | R$ 6,40/un | itens 1, lotes 1, mov 9, preços 1, legado 1 | fica como está; só renomear para "Heineken Long Neck 330 ml" | | | | |

Como unir sem perder histórico (quando aprovado): o duplicado NÃO é apagado (movimentos e histórico de preço apontam para ele). Saldo > 0 vai para o que fica por movimentação auditada (retirada "ajuste autorizado" no duplicado + entrada no que fica, mesma justificativa); depois o duplicado é arquivado. Nenhum UPDATE em movimentos antigos.

## Executado em 12/10/2026 (aprovado pelo dono)

TESTADO NO SUPABASE REAL. Migração `db/EST_DUP_1_ARQUIVAR_DUPLICADOS.sql`, ensaiada antes numa transação desfeita.

- Backup externo conferido por md5: `Meu ERP/backups/2026-10-12-pre-limpeza` (14 tabelas). Cópia no banco: `backup_insumos_est_dup_1_20261012`.
- Novas colunas em `insumos`: `arquivado_em`, `arquivado_motivo`, `unido_a`. Produto arquivado some das listas de escolha (estoque, compras, inventário, cadastro, eventos); histórico e saldo continuam ligados ao id.
- Arquivados e unidos:
  - Heineken - 600ml (47ca891c) → Heineken (d48708f1);
  - Corona Long Neck (79220b02) → Corona (9d75bef9);
  - Heineken zero - Long neck 330ml (7d57e434) → Heineken - Long neck zero 330ml (f8877024).
- Renomeado: "Heineken " (dda5ada5) → "Heineken Long Neck 330 ml".
- Conferência: 346 movimentos antes e depois; saldos iguais.

**Ainda com o dono:**
- "Coroa zero" (24 un, 08/10): se foi teste, estorna; se é estoque real, as 24 passam para a Corona zero.
- Heineken zero long neck (f8877024) × lata (79a931da): vende os dois?
