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

### Fichas dos pratos (21/11/2026, pedido do dono: "pode criar as fichas dos pratos… depois termino de completar")

Fichas criadas sem ingredientes, para o dono completar. Cada uma recebeu as embalagens do estrogonofe (marmita 3 lugares + saco kraft) e os preços da especificação:

| Ficha | Categoria | 99 (R$) | Balcão (R$) |
|---|---|---|---|
| Feijoada do Chef | Marmitas de carne | 41,90 | 34,90 |
| Parmegiana Tradicional | Marmitas de frango | 40,90 | 34,90 |
| Parmegiana ao Molho de Estrogonofe | Marmitas de frango | 42,90 | 36,90 |
| La Minuta | Marmitas | 34,90 | 29,90 |
| Filé à Milanesa | Marmitas | 34,90 | 29,90 |

Sem ingredientes, o custo fica incompleto e o lucro aparece como "pendente", nunca como número.

## Conciliação da fatura (21/11/2026, item F da especificação)

Fica em Financeiro › Conciliação. Código: `app/lib/marmitaria/conciliacao.mjs`, `app/lib/planilha-xlsx.mjs` (lê .xlsx sem dependência, com DecompressionStream) e `components/marmitaria/Conciliacao.js`.

- Lê .xlsx ou .csv (com ; ou ,). Acha sozinho a linha de cabeçalho e as colunas: pedido, data, valor, ofertas da loja, taxas, líquido e itens. O dono pode trocar as colunas.
- Confere pedido por pedido:
  - a taxa real × a do contrato (tolerância de 1 ponto);
  - se valor − ofertas − taxas bate com o líquido;
  - pedido sem data.
- **Gravar como vendas:** vai para `marmitaria_vendas` com fonte "importacao" e referência `fatura:<app>:<pedido>`.
  - O índice único (unidade, fonte, referência) não deixa repetir; testado no banco real em transação desfeita.
  - Não se edita nem se apaga pela tela, porque o valor é histórico.
  - Quantidade de itens: a da planilha ou 1 por pedido, com aviso.
- **Usar como taxa real:** grava os totais na fatura do app (só a coluna `canais`).

Formato real da planilha da 99/iFood: NÃO VALIDADO. A detecção de colunas foi testada com CSV e XLSX montados nos testes.

## Eventos no mesmo modelo (21/11/2026)

Decisão do dono: os eventos usam o **mesmo cadastro do delivery** e precificam **dos dois jeitos**.

- **Cadastro único:**
  - As telas de evento (`eventos/[id]` e o Simulador) carregam as fichas e os ingredientes da unidade dos eventos e também os do delivery (`app/lib/eventos-cadastro.js`).
  - Bebida do delivery (categoria Bebidas) entra na seção Bar.
  - A barra de Eventos ganhou "Fichas e cadastros", que leva às telas do delivery.
- **Porção por pessoa:** como era.
- **Quantidade fechada do evento** (`financeiro.modo_preco = "fechado"`):
  - Cada item vai em gramas, ml, unidades ou porções do evento inteiro (`unidade_total`); `gramasDaPorcao` converte g/ml em porções da ficha.
  - A tela mostra "comida X kg + bebida Y L = R$ Z ÷ N pessoas = custo individual".
  - O preço é por pessoa, igual para todos (criança paga igual), e o total é preço × pessoas.
  - Sugerido e mínimo por pessoa saem do mesmo motor.
- **Testes:** em `evento-orcamento.test.mjs` (4 kg de arroz + 3 L de suco = R$ 80; ÷ 40 = R$ 2; R$ 10 × 40 = R$ 400).
- **Validação:** telas NÃO VALIDADAS no app.

## Sem internet (21/11/2026): cadastros, fichas, estoque e produção

Pedido do dono: "usar offline, fazer cadastros e login; quando conectar, os dados se atualizam". Escopo escolhido: cadastros/fichas + estoque/produção.

- **Fila** (`app/lib/offline/fila.mjs`):
  - Sem rede, ou com erro de rede, a gravação vai para o localStorage e é reenviada na ordem quando a internet volta (evento `online` e abertura do delivery).
  - Para no primeiro erro de rede.
  - Erro de regra tira o item da fila e aparece como "não entrou"; "já existe" conta como enviado.
  - Gravações cobertas (`dados.js`): fichas, pré-preparos, modo de preparo, produto, bebida, descrição, preço de embalagem, preço no app, retirada, produção, conversão, transferência e plano da cozinha. Todas são idempotentes (id/chave/lote da tela, ou nome repetido recusado).
- **Leitura sem internet:** a última base lida fica no aparelho (`contexto.js`), e o aviso mostra de quando é a cópia.
- **Login:** a primeira entrada precisa de internet. Depois, a sessão do aparelho segue sem rede (já existia), e as permissões da última entrada ficam guardadas (`auth.js`).
- **Limites:**
  - item cadastrado sem internet só aparece nas listas depois de enviado;
  - produto novo sem internet não entra na ficha na hora (não tem id).
- **Validação:** testado em `fila.test.mjs`; NÃO VALIDADO no aparelho.
