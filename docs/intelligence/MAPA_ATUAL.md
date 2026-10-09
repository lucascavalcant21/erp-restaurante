# HEFISTO INTELLIGENCE — MAPA ATUAL (IC-0)

Auditoria somente leitura feita em 07/10/2026 sobre o código do repositório
(`lucascavalcant21/erp-restaurante`). Não houve acesso ao banco de produção:
os nomes de tabelas, colunas e funções abaixo vêm das migrações versionadas
(`db/`, `docs/*.sql`) e das consultas reais do código (`.from(...)`, `.rpc(...)`).

## 1. Stack e arquitetura

| Item | Achado |
|---|---|
| Framework | Next.js 15.5 (App Router), React 18, Tailwind 3.4, lucide-react |
| Banco/Auth | Supabase (Postgres + Auth + Storage). Cliente público em `app/lib/supabase.js` (anon key, RLS). Cliente de servidor (service role) em `app/lib/server/supabase-server.mjs` |
| Backend | Rotas `app/api/**/route.js`. Express legado em `backend_cloud_code/` (pouco usado) |
| Padrão de domínio | Motores PUROS testáveis em `app/lib/*.mjs` (recebem `db` por parâmetro) + leitura com o cliente em `app/lib/*-dados.js` |
| Testes | Scripts Node (`node app/lib/x.test.mjs`), integração opcional com PGlite (`PGLITE=...`) usando o SQL real das migrações |
| Deploy | Vercel (branch `main`), Android TWA (`android-twa/`), PWA (`RegisterSW`, `InstallPrompt`) |
| Mobile | Layout responsivo, `safe-area-inset`, `TopNavigation` com drawer, telas tablet em tela cheia |

## 2. Autenticação, multi-tenant e permissões

- **Hierarquia**: `empresas` → `unidades` (id texto: `seldeestrela`, `ticotico`, `burguer`…) → dados com `unidade_id`.
- **Usuário do ERP**: `usuarios_erp` (auth_user_id, status, super_admin, perfil_id, unidade_principal_id, tipo_acesso, janelas de horário/validade).
- **Permissões**: catálogo único `app/lib/permissions-catalog.mjs` (`modulo.pagina.acao`), tabelas `perfis_acesso`, `perfil_permissoes`, `usuario_permissoes` (allow/deny), `usuario_escopos` (data_scope unidade/empresa/todos).
- **Funções de banco (1B-01)**: `hefisto_contexto_requisicao(unidade)` (quem é, unidade validada no escopo, empresa da unidade, permissões efetivas), `hefisto_user_can(permissao, unidade)`, `hefisto_unidades_do_usuario`, `hefisto_usuario_valido`.
- **Servidor**: `app/lib/server/contexto.mjs` (`resolverContexto` — RequestContext congelado, token fora do JSON) e `app/lib/server/autorizacao.mjs` (`authorizeAction` — catálogo → contexto → confirmação no banco). **Existem e têm testes, mas nenhuma rota os usava ainda** (as dependências `validarToken/contextoDoBanco/podeFazer` não estavam ligadas).
- **RLS**: maioria das tabelas `pode_ver_todas() OR unidade_id = auth_unidade_id()`. Estoque (EST-MOV-1/SEC-EST-1) e financeiro F2.1 por unidade.

## 3. Tabelas reais por domínio (nomes descobertos)

| Domínio | Tabelas / views / funções reais | Observação |
|---|---|---|
| Vendas / faturamento | `fin_faturamento_diario` (receita = vendas − cancelamentos − descontos, por dia, com `fonte`) | **Fonte oficial** do CMV %, DRE e tela inicial. Tabela OPCIONAL (F2.4C) |
| Vendas (PDV interno) | `vendas`, `venda_itens`, `venda_pagamentos`, `pedidos`, `pedidos_itens`, `comandas` | Auditoria de 01/10: `vendas` = 0 linhas; vendas reais estão no Saipos (sem integração) |
| Estoque | `estoques`, `estoque_itens` (saldo ≥ 0), `estoque_lotes` (validade/FEFO), `estoque_movimentacoes_multi` (histórico imutável, motivo, chave de idempotência), `estoque_custos` (custo médio), `estoque_contagens` + `estoque_contagens_itens` (contado × sistema, custo congelado) | Escrita SÓ por RPC: `estoque_movimentar`, `estoque_estornar`, `estoque_ajustar_inventario` |
| Legado de estoque | `estoque_atual`, `estoque_movimentos`, `estoque_movimentacoes`, `movimentacoes_estoque`, `inventario_*` | Não usar para inteligência |
| Produtos | `insumos` (nome, nome_interno, unidade_medida, departamento, categoria, custo, embalagem) | `ingredientes` é legado |
| Compras | `compras` + `compras_itens` (unidade base g/ml/un), `vw_compras`; `pedidos_compra*`, `recebimentos_compra`, `devolucoes_fornecedor*` | Só `status = 'confirmada'` entra em custo/CMV |
| Fornecedores | `fornecedores`, `insumos_fornecedores`, `insumos_precos_historico` | |
| Fichas técnicas | `fichas_tecnicas`, `fichas_ingredientes`, `fichas_versoes`, `fichas_custo_historico` | |
| Produção | `producao_diaria`, `producoes`, `producao_dia` | |
| Perdas | `estoque_movimentacoes_multi.motivo in ('perda','vencimento','quebra')`; `etiquetas.status = 'perda'` | Não há tabela de perdas própria |
| Financeiro | `contas_pagar` + `vw_fin_contas_pagar` (situação, saldo, vencida, competência, natureza), `fin_pagamentos`, `fin_contas_receber` + `vw_fin_contas_receber`, `fin_recebimentos`, `vw_fin_fluxo_caixa`, `fin_categorias`, `fin_contas_financeiras` | `lancamentos` é legado (1 linha de teste) |
| DRE / CMV | Motores `app/lib/dre-gerencial.mjs`, `app/lib/cmv-real.mjs`, `app/lib/cmo.mjs` | Já seguem "NÃO INVENTAR" |
| RH | `colaboradores` (salário, VA, tipo_contrato), `registro_ponto`, `ponto_marcacao`, `rh_banco_horas` (créditos de intervalo), `rh_recibos_prestacao` (diárias de extras), `rh_*` | "Hora extra" real exige cálculo de jornada (`jornada-calculo.mjs`) |
| Eventos/Reservas | `eventos`, `orcamentos_eventos`, `evento_*`, `reservas` | |
| CRM | `clientes`, `avaliacoes_nps`, `campanhas`, `cupons` | |
| Etiquetas | `etiquetas` (validade_em, status ativa/baixa/perda, custo_unit) | Leitura pública por código (rastreio) |
| Auditoria | `hefisto_auditoria` (policy `using (true)` — aberta a qualquer autenticado), `acessos_auditoria`, `permissoes_auditoria`, `estoque_autorizacoes`, `agent_write_audit_log`, `agent_confirmations` | |
| Configurações | `config_sistema.params` (parâmetros da Pizza do Lucro), `parametros.js` | |

## 4. IA / Copilot existente

| Peça | Situação |
|---|---|
| `app/api/hefisto/route.js` | Intent parser via Anthropic (fetch direto), só classifica |
| `app/api/ia-*` (17 rotas) | Geração de fichas/cardápio/OCR; chamadas diretas ao modelo espalhadas |
| `app/lib/hefisto-intents/actions/analytics/insights/specialists/inbox/routines` | Copilot 100% **no cliente**, auditoria **em memória** (`hefisto-audit.js`), idempotência em memória |
| `HefistoCopilotPanel`, `HefistoAssistantModal`, `HefistoAssistant` | **Não montados** em nenhum layout (código morto na UI) |
| `app/lib/server/channels/whatsapp/adapter.mjs` | **Vivo**: o webhook do WhatsApp chama `processHefistoIntent` (legado) |
| `hefisto-voz.js` | Web Speech API (reconhecimento + síntese) já existe |

## 5. Integrações

Supabase; Anthropic (ANTHROPIC_API_KEY); WhatsApp Cloud API (webhook); iFood (poll/webhook); Saipos (adapter, sem dados de venda no ERP); PagSeguro; e-mail de comprovante; Firebase admin (legado).

## 6. Dados disponíveis × faltantes para a inteligência

| Pergunta | Fonte real | Situação |
|---|---|---|
| Faturamento do dia/semana | `fin_faturamento_diario` | Depende da tabela existir e do dia estar lançado |
| Compras da semana | `vw_compras` + `compras_itens` (confirmadas) | Disponível |
| Maior aumento de preço | `compras_itens` × `compras` (preço por unidade base) | Precisa ≥ 2 compras confirmadas do mesmo produto |
| Próximos do vencimento | `estoque_lotes` (+ `etiquetas` ativas) | Disponível |
| Diferença estranha no estoque | `estoque_contagens_itens.diferenca` (contagem fechada), lotes × saldo | Precisa de contagem fechada |
| Contas a vencer | `vw_fin_contas_pagar` | Disponível |
| CMV | `cmv-real.mjs` (inventário inicial + compras − final ÷ faturamento) | Precisa de 2 inventários fechados (unidade inteira) e faturamento de todos os dias |
| CMO | `cmo.mjs` (folha RH + diárias pagas) ÷ faturamento | Precisa de salários no RH e faturamento |
| Ticket médio | — | **Faltante**: não há quantidade de vendas/clientes no faturamento diário |
| Venda por produto / engenharia de cardápio | `venda_itens` | **Faltante** (vendas no Saipos, sem integração) |
| Hora extra | `registro_ponto` + jornada | Parcial (banco de horas = intervalo não tirado) |

## 7. Riscos encontrados

1. **Números fabricados no Copilot legado**: `app/lib/hefisto-analytics.js` responde "Por que o CMV subiu?" com valores FIXOS no código (CMV 31,2% → 28,7%, "Camarão R$ 72 → R$ 84", "R$ 3.400", perda "R$ 450,00"). `hefisto-actions.js` devolve produto FICTÍCIO (`insumo-mock-*`, saldo 50) quando não acha o item. O caminho ainda está vivo pelo webhook do WhatsApp.
2. **Webhook do WhatsApp aceita POST sem assinatura**: a verificação HMAC só roda se o cabeçalho vier; sem ele, o evento é processado.
3. **Auditoria do Copilot só em memória** (se perde a cada deploy/instância) e `hefisto_auditoria` com policy `using (true)`.
4. **`pode_ver_todas()` trata escopo "empresa" como rede inteira** nas policies antigas: RLS sozinho não basta para isolar empresas. A 1B-01 já corrige isso em `hefisto_unidades_do_usuario`/`hefisto_contexto_requisicao` — a inteligência deve filtrar explicitamente pela unidade validada por essas funções, além do RLS.
5. **Contexto de tenant no cliente**: o Copilot legado usa `unitId` vindo da tela; nada validava no servidor.
6. **Chamadas ao modelo espalhadas** (17 rotas `ia-*` com fetch direto e modelo fixo no código).

## 8. Pontos de conexão da inteligência

- Contexto confiável: `resolverContexto` + `hefisto_contexto_requisicao` (falta só ligar as dependências numa rota).
- Autorização: `authorizeAction` + `hefisto_user_can`.
- Métricas: motores puros `cmv-real.mjs`, `cmo.mjs`, `dre-gerencial.mjs`, `painel-inicio.mjs`, `contas-pagar.mjs`.
- Ação de perda: RPC `estoque_movimentar(p_tipo='saida', p_motivo='perda'|'vencimento'|'quebra', p_chave)` — mesma regra da tela, FEFO, sem saldo negativo, idempotente, confere permissão no banco.
- Voz: `hefisto-voz.js` (Web Speech).
- UI: `app/dashboard/layout.js` (ponto único para o atalho global), `TopNavigation`.
