# iFood · pedidos, cozinha, estoque e financeiro (14/10/2026)

Branch `claude/ifood-2-pedidos`. Continuação do [[MARMITARIA_V2_2026-10-14]] e da APR-006 (cadastro do iFood).

## Decisões do dono (14/10)

- **A Marmitaria, o restaurante Seldeestrela e Eventos são negócios separados**, que não se conectam. A Marmitaria vira **unidade própria** no Héfisto (preparação em PR separado, aplicação só com aprovação).
- **A loja do iFood é só da Marmitaria.** Os pedidos entram apenas no estoque, nas vendas e no DRE da Marmitaria.

## O que a análise mostrou

| Achado | Consequência |
|---|---|
| Não existe integração da Saipos em produção: o servidor antigo usa dados em memória; `vendas` = 0 linhas e nenhuma tabela Saipos | "Não alterar a Saipos" = o Héfisto **nunca age sobre o pedido**. Ele só lê eventos e detalhes e envia o ACK com credencial própria. A documentação diz que cada credencial é um "dispositivo" com ACK próprio. |
| Rotas antigas `/api/ifood/poll` e `/webhook` gravavam em colunas de `vendas` que não existem e caíam em credencial de ambiente | Substituídas. |
| `estoque_movimentar` exige usuário logado (`auth.uid()`) | A baixa por pedido é feita por um usuário pela tela (mesma função, permissões e auditoria do estoque). |
| A produção do lote já baixa ingredientes e embalagens | Por padrão os pedidos **não** baixam estoque, para não baixar duas vezes. A baixa por pedido é opcional por unidade, para quem monta na hora. |

## Documentação oficial usada (lida em 14/10)

- Eventos: `GET /events/v1.0/events:polling` (header `x-polling-merchants`), ACK `POST /events/v1.0/events/acknowledgment` com corpo `[{id}]`, polling a cada 30 s, eventos retidos por 8 h, sem ordem garantida, com repetição. Throttling por strikes para evento sem ACK.
- Pedido: `GET /order/v1.0/orders/{id}`; o PLACED pode chegar antes dos detalhes (404, nova tentativa por até 10 min). Os detalhes não mudam.
- Benefícios: patrocínio MERCHANT é desconto da loja; IFOOD/EXTERNAL/CHAIN não reduz a receita da loja. `additionalFees` são receita do iFood.
- Webhook: só para app centralizado, resposta 202 em menos de 2 s, assinatura sobre o corpo cru.
- Homologação: só conta CNPJ; o app inteiro é avaliado.

**A CONFIRMAR NA HOMOLOGAÇÃO** (as páginas mudaram de endereço e não abriram):
- formato exato do `X-IFood-Signature` (implementado: HMAC-SHA256 em hexadecimal com o Client Secret);
- caminho e campos completos da API financeira (Settlement/Reconciliation);
- limite do ACK por chamada (a página diz 2.000 e 10.000; usamos 1.000).

## O que foi implementado

| Parte | Onde | Evidência |
|---|---|---|
| Migração IFOOD-2 (aditiva): `delivery_pedidos`, `delivery_itens_mapeamento`, `delivery_repasses`, colunas de fila em `integration_events`, `delivery_gravar_pedido` (só servidor) e `marmitaria_baixar_pedidos` (usuário, via `estoque_movimentar`) | `db/integracoes/IFOOD_2_PEDIDOS.sql` | 26 casos com SQL real: TESTADO LOCAL (PGlite). **Não aplicada**: APR-007 |
| Núcleo: eventos, situação do pedido, LGPD, vendas por marmita, taxas estimadas, consumo pela ficha, ajuste de estoque idempotente, duplicidade, conciliação, cozinha, repasses | `app/lib/ifood/nucleo.mjs` | 22 testes: TESTADO EM MOCK |
| Sincronização: fila, polling, ACK depois de guardar, detalhes com nova tentativa, espera crescente, FALHA e reprocessar, webhook assinado, preferências | `app/lib/server/ifood-sync.mjs` | 37 casos de ponta a ponta (SQL real + iFood dublê): TESTADO LOCAL |
| Rotas: `/api/ifood/webhook`, `/api/ifood/poll` (CRON_SECRET), `/api/ifood/sincronizacao` (sessão + unidade + permissão) | `app/api/ifood/*` | build OK. NÃO VALIDADO em preview |
| Telas: Configurações → iFood (buscar agora, falhas, baixa, itens → marmita, histórico); Estoque e Produção → Pedidos do iFood; Financeiro → DRE (aviso de duplicidade e conciliação) | `app/components/...` | build OK. NÃO VALIDADO no navegador |

Regras de integridade garantidas por teste:
- um pedido por unidade + canal + id;
- status só avança e o cancelamento é final;
- evento só de status não mexe nas vendas;
- item retirado do pedido fica zerado, não apagado;
- repasse real nunca é sobrescrito por estimativa;
- ACK só depois de guardar;
- reprocessar não duplica;
- a baixa por pedido não baixa de novo (versão por pedido);
- a unidade do webhook vem do segredo, não do corpo;
- só o primeiro nome do cliente é guardado (sem telefone, documento ou endereço);
- nenhum segredo nem token aparece em erro ou resposta.

## Natureza dos valores

| Valor | Natureza |
|---|---|
| Itens, preço, desconto da loja, cancelamento | REAL (vem do pedido) |
| Comissão, taxa de pagamento e taxa fixa | ESTIMATIVA pelas taxas do canal em Configurações (`taxas_estimadas`); sem taxa configurada, ficam zeradas com aviso |
| Repasse | REAL só quando vier do financeiro do iFood (`delivery_repasses`); até lá a conciliação mostra "aguardando" |

## Pendências

1. **APR-007**: aplicar IFOOD-2 em produção e fazer o merge.
2. **Credenciais do iFood** (dono): app centralizado no Portal do Desenvolvedor (conta CNPJ), Merchant ID e autorização da loja.
3. **Frequência do polling**: a Vercel só agenda de minuto em minuto, e o plano pode limitar mais. O caminho recomendado é o webhook (cadastrar `https://app.hefisto.com.br/api/ifood/webhook` no portal), com polling de segurança e o botão "Buscar pedidos agora". O agendamento do `/api/ifood/poll` precisa de decisão (Vercel Cron, pg_cron do Supabase ou agendador externo) e da variável `CRON_SECRET`.
4. **Homologação**: confirmar assinatura, API financeira e limite do ACK, e só então ligar a importação de repasses.
5. **Separar a Marmitaria em unidade própria** (decisão do dono 14/10): PR separado.
