# Segurança

## Achados abertos (por gravidade)

| # | Achado | Gravidade | Evidência | Situação |
|---|---|---|---|---|
| S-01 | `colaboradores` e `registro_ponto` com **RLS desligado**: qualquer usuário logado lê salário, CPF e ponto | CRÍTICO | TESTADO NO SUPABASE REAL (advisor ERROR, 07/10; inventário 08/10) | **RLS ligado e isolado por unidade em 08/10** (SEC-RLS-1, TESTADO NO SUPABASE REAL). Aberto: salário/CPF continuam visíveis para quem é da mesma unidade (fase 2, BLQ-008) |
| S-02 | Policies abertas em **121 tabelas** (`using (true)`, `with check (true)`, `auth.role() = 'authenticated'`, `… or unidade_id is null`): um usuário de uma empresa lê e grava as outras. Anon sem grant | CRÍTICO para multiempresa (hoje só há 1 empresa) | TESTADO NO SUPABASE REAL (inventário só leitura, 08/10; `db/security/AUDITORIA_RLS.sql`) | **88 tabelas corrigidas em 08/10** (SEC-RLS-1, TESTADO NO SUPABASE REAL: outra unidade recusada, sem cadastro vê 0). Faltam 33 (fase 2): dados órfãos, tabelas-filhas e catálogos (BLQ-008, [[HDEV-SEC-001]]) |
| S-03 | Fase 1A/1B de segurança não aplicada; os arquivos da 1A nem estão no repositório | ALTO | Banco sem `hefisto_contexto_requisicao` | Planejar |
| S-04 | Rotas `app/api/ia-*` (17) sem checagem de sessão | ALTO (custo de API e abuso) | Leitura do código, 08/10 | Backlog |
| S-05 | `app/api/saas/export` sem autenticação (cliente anon) | ALTO | Leitura do código | Backlog |
| S-06 | Webhook do WhatsApp aceita POST sem assinatura; token de verificação com padrão literal | ALTO quando ativado | Leitura do código | Refazer no HI-06 |
| S-07 | `ANTHROPIC_API_KEY` no Vercel não marcada Sensitive (`readable-secret`) | MÉDIO | Vercel, 07/10 | Dono marca Sensitive |
| S-08 | Funções SECURITY DEFINER executáveis por `anon` (ex.: `hefisto_session_context`, `excluir_insumo_cascata`) | MÉDIO | Advisor. `excluir_insumo_cascata` confere `auth.role()` e recusa anon | Revisar caso a caso |
| S-09 | Guarda de página só vale para sessão `gerenciado` | MÉDIO | `app/dashboard/layout.js` | Backlog |
| S-10 | PIN do estoque começa como `1234` | MÉDIO | EST-MOV-1 | Exigir troca |
| S-11 | `CRON_SECRET` com valor padrão no código legado | MÉDIO | `api/hefisto/automation/cron` | Backlog |
| S-12 | Proteção contra senha vazada desligada no Supabase Auth | BAIXO | Advisor | Dono liga no painel |
| S-13 | 29 arquivos de `db/` criam policy aberta ou desligam RLS (incluindo SQL dinâmico e o rollback da SEC-RLS-1) (ex.: `migracao_central_comando.sql`, `migracao_compras_recebimento.sql`, `TODAS_AS_MIGRACOES.sql`). Reaplicar algum reabre o S-02 | MÉDIO (só se reaplicado) | Análise estática da política ([[POLITICA_PUBLICACAO]]), 08/10. Estado no banco: o S-02, não esta linha | Congelados: `npm run test:seguranca` falha se surgir arquivo NOVO inseguro (lista só diminui); a política os marca BLOCKED |
| S-14 | Escopo `empresa` em `pode_ver_todas()` dá **todas as unidades** (não existe `empresa_id` em `unidades`). Com a 2ª empresa, vira vazamento | ALTO quando houver 2ª empresa (hoje nenhum usuário tem escopo) | Leitura da função no banco real, 08/10 | **Corrigido em produção 09/10** (SEC-RLS-2, APR-002): `pode_ver_todas()` só super admin; escopo `empresa` = só a própria empresa. TESTADO LOCAL (PGlite, 2 empresas) |
| S-15 | Dados com unidade inexistente ou nula (`burguer`, `ticotico`, `todas`, nulos) em 7 tabelas. `app/lib/notas.js` grava `unidade_id = "todas"` | MÉDIO (bloqueia o isolamento dessas tabelas) | TESTADO NO SUPABASE REAL (só leitura), 08/10 | Classificados (LEGADO/ORFAO/AMBIGUO) em [[SEC_RLS_2_MAPA]]; na SEC-RLS-2 ficam só para o super admin, sem apagar nem mover; `notas.js` deixa de gravar `todas` |
| S-16 | `unidades.token_nfe` (credencial da NF-e) **legível e editável por qualquer usuário logado** (`using (true)`, `unidades_all`) | **CRÍTICO** | TESTADO NO SUPABASE REAL (só leitura), 08/10. O valor não é registrado em lugar nenhum | **Corrigido em produção 09/10** (SEC-RLS-2, APR-002; TESTADO NO SUPABASE REAL): o navegador grava, não lê. **Dono: rotacionar a credencial no provedor da NF-e** (esteve exposta) |
| S-17 | `documentos_rh`, `usuarios_erp` (e-mail, telefone, IPs permitidos) e `colaboradores` (CPF, salário) legíveis por qualquer logado da unidade | ALTO | TESTADO NO SUPABASE REAL (só leitura), 08/10 | **Corrigido em produção 09/10** (SEC-RLS-2, APR-002; TESTADO NO SUPABASE REAL): só o próprio, RH/gestão autorizados, dono e super admin |
| S-18 | Webhook WhatsApp da fase 3A (`app/api/channels/whatsapp/webhook`, em produção): aceitava POST **sem assinatura**, verify token padrão no código, número de teste fixo (`+5511987654321`) como ADMIN em `identity.mjs`, e botão `CONFIRM_…` executava ação. Sem variáveis WHATSAPP_* em produção, não enviava nada | ALTO (latente) | Leitura do código e das variáveis da Vercel, 09/10 | HDEV-WA-001: rota substituída pelo gateway novo (assinatura obrigatória, sem token padrão, números do dono por variável, sem ações). Os módulos antigos `app/lib/server/channels/whatsapp/*` ficam sem uso: apagar com o dono. Canal novo lê como o usuário do dono (super admin) só na unidade `WHATSAPP_DONO_UNIDADE`, sem ações |

| S-29 | Migrações do Héfisto Experience (`db/MIGRACAO_EXPERIENCE_CAMPANHAS.sql` de `ff18b9e`, `db/MIGRACAO_EXPERIENCE_HEXP_001.sql` de `27732ad`) criavam **policy aberta**: `experience_campanhas` legível por qualquer pessoa (`select using (true)` para public) e gravável por qualquer logado de qualquer empresa; `experience_chamados` (nome do cliente, observação) legível e alterável por qualquer logado. A trava `seguranca-rls.test.mjs` falhava na `main` | ALTO se aplicadas (multiempresa); **sem exposição em produção** | Banco real, 18/10 (só leitura, catálogo): `experience_campanhas`, `experience_chamados` e as 8 colunas novas de `produtos`/`pedidos` **não existem**; nenhuma policy `experience*`; nenhuma migração registrada. TESTADO NO SUPABASE REAL | **Corrigido no repositório 18/10** (`f3a320a`): `sec_unidade` (padrão SEC-RLS-1), anon sem grant, navegador não cria nem apaga chamado, FK de unidade, preflight/verificação/rollback. TESTADO LOCAL (PGlite, funções de acesso como em produção: 2 unidades, anon, versão antiga, preflight). Aplicar em produção: só com o dono, e **depois de fechar S-30 e S-31** |
| S-30 | `/api/public/experience/[unidade]/chamados` **GET e PATCH sem login, com service_role**: GET lista os chamados ativos de qualquer unidade (nome do cliente, observação); PATCH muda o status de **qualquer** chamado pelo id, sem conferir a unidade. A unidade vem da URL | ALTO (latente: hoje a tabela não existe em produção, GET devolve lista vazia e PATCH dá 503) | Leitura do código, 18/10. Rota no deploy de produção: NÃO VALIDADO (conector Vercel 403, rede sem acesso ao domínio) | Aberto. Exigir sessão e vínculo com a unidade (padrão SEC-API-1: `exigirSessao` + `autorizarLeituraDaUnidade`) antes de aplicar a HEXP-001 |
| S-31 | `/api/dashboard/experience/intelligence?unidade=` **sem login, com service_role, unidade pela query string** (tenant do pedido, não do banco): lê pedidos, faturamento, ticket e campanhas de qualquer unidade | ALTO (CRÍTICO com a 2ª empresa); latente: em produção `pedidos.origem_experience` não existe, a consulta falha e a rota devolve zeros e números fixos (B-019) | Leitura do código, 18/10; colunas conferidas no banco real (TESTADO NO SUPABASE REAL). Deploy: NÃO VALIDADO | Aberto. Mesmo tratamento do S-30; com a HEXP-001 aplicada, a rota passa a expor o faturamento real |

## O que já protege (validado)

- **Intelligence Core:**
  - contexto resolvido no banco;
  - banco escopado com verificação linha a linha;
  - auditoria imutável;
  - service role só no servidor e fora do bundle (TESTADO LOCAL: varredura do `.next/static`);
  - isolamento com segundo tenant (TESTADO NO SUPABASE REAL).
- **Estoque:**
  - `estoque_movimentar` recusa quem não tem permissão (TESTADO NO SUPABASE REAL);
  - histórico imutável (EST-MOV-1).
- **Catálogo de rotas:** nenhuma tela cai na entrada genérica `/dashboard` (trava em teste, TESTADO LOCAL).

## Regras permanentes

- `SUPABASE_SERVICE_ROLE_KEY` nunca vai ao navegador, a `NEXT_PUBLIC_`, a log ou ao bundle.
- Segredo nunca entra no chat, no código, em commit ou neste cérebro. Só o NOME da variável.
- Tenant vem do banco, nunca do corpo da requisição.
- Mudança de RLS, policy ou grant em produção é **ação crítica**: precisa de aprovação do dono e de transação com verificação. Ver [[REGRAS_DO_PROJETO]].
