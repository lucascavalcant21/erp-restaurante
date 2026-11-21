# Precificação do delivery (especificação do dono, 21/11/2026)

Fonte: "Héfisto — Delivery Marmitas, especificação v1.0" enviada pelo dono.
Primeira entrega (`hefisto-teste`): o estilo de precificação. Código em
`app/lib/marmitaria/precificacao.mjs` + `nucleo.mjs` (taxaDaFatura,
resultadoPorCanal, precoSugerido). Testes: `precificacao.test.mjs`.

## Fórmulas (por unidade, tudo ESTIMATIVA)

- Cliente paga = preço de lista − desconto da loja − desconto do app.
- Receita = preço de lista − desconto da loja (o do app não sai da loja).
- Repasse = receita − taxas do app/pagamento − impostos.
- Margem de contribuição = repasse − ingredientes − embalagem.
- Lucro estimado = margem − equipe e fixos rateados por marmita.
- Preço mínimo = preço com lucro zero (já pagando equipe e fixos).
- Preço da meta = (custo + fixo/un + lucro-alvo) ÷ (1 − taxas), via `precoSugerido`.

## Taxa do contrato × taxa real da fatura

- Cada app guarda ganhos totais, ofertas pagas pela loja e taxas de uma fatura.
- `taxaDaFatura` dá os % sobre os ganhos. Exemplo 99Food: 799,80 − 85,92 − 107,02 = 606,86; ofertas 10,74%, taxas 13,38%, total 24,12%.
- Só calcula com a taxa da fatura se o dono ligar `usar_fatura`. É média do período (HIPÓTESE), não contrato. Desligado, valem as taxas do contrato.

## Alertas

- Lucro abaixo da meta.
- CMV acima de 30%.
- Desconto acima do teto.
- Ficha sem custo completo: o lucro aparece como "pendente".

## Testes da especificação cobertos

(1), (2), (3), (4), (5), (6), (7), (8), (9) e (10). O (11), preço por app sem mexer no balcão, já era assim.

## Ainda não feito (próximas entregas)

- Conciliação por pedido (importar CSV da fatura).
- Vigência e aprovação de preço.
- Promoções com financiador por SKU.
- DRE por centro de custo.
- Dados da especificação no banco.

Os números do documento são diferentes do cadastro atual (custos fixos R$ 22.120 × R$ 13.809 cadastrados; iFood 26% × 23% + 3,5%). Eles NÃO foram gravados: isso depende de confirmação do dono.

## Carga dos números da especificação (21/11/2026, aprovada pelo dono: "pode passar para o sistema")

Gravado no banco do sistema novo (hefisto-staging, unidade `marmitaria`). Antes foi feito um ensaio em transação desfeita; depois, a gravação de verdade.

- **Custos fixos:**
  - Antes: Pró-labore 3000, Aluguel 5000, Luz 3000, Água 1000, Gás 380, Telefone 79, Internet 150, Contador 800, Sistemas 400 (= 13.809).
  - Agora: Aluguel 5000, Energia 3000, Gás 800, Pró-labore 5000, Internet 120, Água 400, Material de limpeza 300 (= 14.620).
- **Equipe por mês (`cmo_mes`):** antes vazio (RH: 5.989,31); agora 7.500, os 3 × 2.500 da especificação.
- **Marmitas por mês:** 9000 → 2600. **Dias de operação:** 21 → 26.
- **Meta de lucro:** 10, com faixa até 12.
- **Apps:**
  - 99: contrato 8,9% + 3,2%; fatura 799,80 / 85,92 / 107,02 (02/11 a 06/12/2026); calcula com a taxa da fatura (24,12%, HIPÓTESE da especificação).
  - iFood: 26% total (antes 23% + 3,5%).
  - Keeta: 18% total (antes 18% + 3,2%).
  - Ativos e inativos sem mudança.
- **Estrogonofe de frango:** 99 R$ 38,90 (antes 29,90); balcão R$ 32,90 (novo).
- **Bebidas:**
  - estoque "Bebidas da Marmitaria" criado;
  - 9 bebidas: produto, item no estoque e item de venda (categoria Bebidas);
  - custo: refrigerantes R$ 3,50 e águas R$ 1,00;
  - balcão: Coca, Coca Zero, Fanta, Sprite e tônica 11; Guaranás 10; águas 6;
  - 99: refrigerantes 8 e águas 6.

Custo de Guaraná, Fanta e tônica = R$ 3,50 é premissa (a especificação pede confirmar).

Pendências da especificação que continuam abertas:
- não há fichas de Feijoada, Parmegianas, La Minuta e Milanesa no sistema, então os preços delas não foram gravados;
- a embalagem confirmada na especificação é R$ 1,80, mas a cadastrada soma R$ 3,08: foi mantida a cadastrada;
- o regime está como MEI (validar com o contador).
