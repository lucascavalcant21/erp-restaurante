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
