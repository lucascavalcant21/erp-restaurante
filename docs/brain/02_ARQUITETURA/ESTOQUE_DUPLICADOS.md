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
