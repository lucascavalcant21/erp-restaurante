# Etiqueta rastreável — banco

A etiqueta deixa de ser um papel impresso e passa a representar **um recipiente
físico**: tem saldo próprio, sabe de onde veio, e cada coisa que acontece com
ela vira evento. O estoque continua sendo o mesmo estoque; nada foi substituído.

## Ordem de aplicação — não inverta

| # | Arquivo | Quando |
|---|---|---|
| 1 | `0001_saldo_e_linhagem.sql` | pode rodar a qualquer momento: é aditivo |
| 2 | *(deploy do app)* | a página `/rastreio` passa a usar `get_etiqueta_publica` |
| 3 | *(teste manual)* | abrir um QR real, em janela anônima, e confirmar |
| 4 | `0002_fechar_leitura_anonima.sql` | **só depois** do passo 3 |

Rodar o `0002` antes do passo 3 **quebra o rastreio público** até o deploy sair.
O `0002` tem um preflight que recusa rodar sem o `0001`, mas ele não tem como
saber se o app já foi publicado — esse passo é humano.

Os dois arquivos são idempotentes: rodar duas vezes não quebra nada. O `0002`
traz um bloco de reversão comentado no fim.

## O que o 0001 faz

**Colunas novas em `etiquetas`** — todas nulas, nenhuma linha antiga é tocada:
`insumo_id`, `estoque_id`, `saldo`, `saldo_unidade`, `condicao_estoque`,
`producao_id`, `rastreavel`, `validade_original_em`, `aberta_em`,
`regra_validade`, `encerrada_em`.

**Coluna nova em `estoque_movimentacoes_multi`**: `etiqueta_id`.

**Tabelas novas**: `etiqueta_relacoes` (linhagem N→1 e 1→N), `etiqueta_eventos`
(timeline), `etiqueta_operacoes` (idempotência), `etiqueta_financeiro_pendente`
(fila de perdas para o financeiro).

**Views**: `vw_estoque_rastreabilidade`, `vw_etiquetas_pendentes_impressao`.

**RPCs**: `etiqueta_registrar_entrada`, `etiqueta_vincular_producao`,
`etiqueta_abrir`, `etiqueta_usar`, `etiqueta_perda`, `etiqueta_fracionar`,
`etiqueta_novo_ciclo`, `etiqueta_reimprimir`, `etiqueta_marcar_impressa`,
`get_etiqueta_publica`.

## Unidades: quem converte o quê

- **A unidade do estoque é a cadastrada no insumo** (`insumos.unidade_medida`).
  Nada no caminho do estoque normaliza nada: `registrar_movimento_estoque_multi`
  soma o número que recebe.
- **A etiqueta é impressa na unidade da cozinha** (`etiquetas.unidade`), que
  pode ser outra: 500 g de um insumo cadastrado em kg.
- **A conversão acontece num lugar só**: `etiqueta_registrar_entrada`, via
  `etiqueta__converter`. A partir daí `etiquetas.saldo` está **sempre** na
  unidade do insumo, e `saldo_unidade` registra qual é.
- É isso que torna legítima a soma `sum(etiquetas.saldo) = estoque_itens.quantidade_atual`.
  Somar saldos em unidades diferentes daria um número sem significado.
- `kg ↔ L`, `g ↔ ml`, `un ↔ kg`, `garrafa ↔ lata` **não convertem**: não existe
  fator cadastrado e inventar um corromperia o estoque. A operação é recusada
  com mensagem explícita.

`etiquetas.quantidade` e `etiquetas.unidade` continuam sendo o que está impresso
no papel, e não são alterados.

## Onde cada fluxo escreve

| Ação | `estoque_atual` (legado) | `estoque_itens` | `estoque_lotes` | `etiqueta.saldo` |
|---|---|---|---|---|
| Recebimento por etiqueta | — | +qtd | +qtd (lote da validade) | = qtd |
| Vincular produção | — | — | — | = qtd (a produção já lançou) |
| Marcar impressa / reimprimir | — | — | — | — |
| Abrir (lacrado → aberto) | — | −qtd no setor, +resto nos preparos | idem, FEFO na saída | mãe → 0, filha = resto |
| Uso | — | −qtd | −qtd (FEFO) | −qtd |
| Perda | — | −qtd | −qtd (FEFO) | −qtd |
| Fracionamento | — | — | — | pai −soma, filhas = partes |
| Novo ciclo | — | — | — | anterior → 0, nova = saldo |

`estoque_atual` **não é tocado por nenhuma função nova**. Ele continua sendo
mantido pelos caminhos legados, e a divergência entre ele e o multiestoque é
assunto de uma fase própria de consolidação — ver "Limitações".

## Idempotência

Toda RPC aceita `p_idempotency_key`. A chave é **reservada em
`etiqueta_operacoes` antes de qualquer efeito colateral**:

```
chave recebida → INSERT ... ON CONFLICT DO NOTHING
   ├─ inseriu  → executa a operação inteira, depois grava o resultado
   └─ conflito → devolve o resultado anterior, sem tocar em estoque
```

Requisição simultânea com a mesma chave **bloqueia** no INSERT até a primeira
terminar, e então cai no segundo caminho. Se a primeira falhar, a reserva volta
atrás junto e o retry segue normalmente. Reaproveitar a mesma chave para outra
operação é erro explícito, não silêncio.

## Impressão

A impressora é um aparelho externo; o banco não fica com transação aberta
esperando WebUSB. Por isso são coisas distintas:

- `criada` — a identidade existe e o estoque já está certo;
- `impressa` — o papel saiu;
- `reimpressa` — segunda via.

Se a impressora falhar, o evento `impressa` não existe e a etiqueta aparece em
`vw_etiquetas_pendentes_impressao`. Nenhuma das três mexe em estoque.

## Perda e financeiro

`etiqueta_perda` tira do estoque **e** grava a pendência em
`etiqueta_financeiro_pendente`, na mesma transação. Ou as duas coisas existem,
ou nenhuma. Quem transforma a pendência em `contas_pagar` é
`app/lib/etiqueta-financeiro.js`, e o índice único por evento impede lançamento
duplicado.

## Testes

```bash
node scripts/test_etiqueta_rastreavel.mjs <caminho do @electric-sql/pglite>
node scripts/test_regressao_estoque_pos_etiquetas.mjs <caminho do @electric-sql/pglite>
```

O segundo monta **duas** bases iguais, aplica o `0001` só numa, roda os fluxos
antigos nas duas e compara item a item — é a prova de que a migration é
aditiva, não a afirmação de que ela é.

No Windows o PGlite imprime uma asserção do libuv ao sair e corrompe o código de
saída; confie na última linha, `RESULTADO: OK` ou `RESULTADO: FALHOU`.

## Aplicar em staging

Nada disto foi aplicado em banco real ainda. O procedimento:

1. snapshot do projeto de staging (Supabase → Database → Backups);
2. `0001_saldo_e_linhagem.sql` no SQL Editor, **de uma vez** (o arquivo é uma
   sequência só; rodar por pedaços deixa estado pela metade);
3. ler os `NOTICE` da execução — as FKs que não puderem ser criadas avisam ali
   o motivo (tabela ausente, tipo incompatível, órfãos);
4. `VALIDACAO_STAGING.sql` deste diretório, bloco a bloco;
5. `0002` **não** — só depois do deploy do app e do teste de QR.

Produção: não, até o relatório de staging ser aprovado.

## Limitações conhecidas

- **`estoque_atual` e o multiestoque divergem** por caminhos que já existiam
  antes desta fase. Nada aqui piora isso e nada aqui corrige: é fase própria.
- **Transformação N→1** (tomate + cebola → molho) tem o modelo de relação
  pronto (`etiqueta_relacoes.tipo_relacao = 'transformacao'`) mas **ainda não
  tem RPC**.
- **O legado não é retroativo**: `rastreavel` nasce `false` e nenhuma etiqueta
  antiga foi inventada. A diferença entre o saldo do estoque e o saldo com
  etiqueta é visível em `vw_estoque_rastreabilidade` e não é erro.
- **A conversão só cobre massa e volume.** Insumo cadastrado em `pct`, `caixa`
  ou `maço` com etiqueta em outra unidade é recusado — falta um fator de
  embalagem cadastrado, que é decisão de produto, não de migração.
