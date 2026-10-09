# Aprovações pendentes

Pedidos do agente que **só o dono decide** (risco HIGH/CRITICAL, produção, banco real, ações da lista do CLAUDE.md).
O agente para só a etapa pedida e segue no resto. Regras em [[POLITICA_PUBLICACAO]].

- Ver: `npm run hefisto:aprovacoes`
- Decidir: `npm run hefisto:aprovacoes -- aprovar APR-001` ou `-- rejeitar APR-001 "motivo"`
- Depois de executar: `npm run hefisto:aprovacoes -- executado APR-001`

Status: PENDENTE → APROVADO / REJEITADO → EXECUTADO. Não apague seções: é o histórico.

**Pendentes agora: 1**

### APR-001 · EXECUTADO

- **Missão:** HDEV-SEC-001
- **Ação:** Aplicar db/security/SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql no Supabase real (isolamento por unidade em 88 tabelas; liga RLS em colaboradores e registro_ponto)
- **Ambiente:** supabase (produção)
- **Risco:** HIGH
- **Motivo:** Mudança de RLS/policy em produção (CLAUDE.md: confirmação do dono). Corrige S-01 e S-02: hoje qualquer usuário logado de qualquer empresa lê e grava 88 tabelas, inclusive salário, CPF e ponto.
- **Impacto:** Hoje (1 unidade, 16 usuários): ninguém perde acesso (conferido no banco real, só leitura). Muda: outra empresa/unidade não vê nem grava. Trava ACCESS EXCLUSIVE breve em 88 tabelas (rodar fora do horário de pico). Insert sem unidade_id recebe a unidade do usuário.
- **Rollback:** db/security/SEC_RLS_1_ROLLBACK.sql (recria as policies guardadas em sec_backup_policies_sec_rls_1; testado no PGlite: volta exatamente ao estado anterior)
- **Evidências:** PGlite com as policies reais de produção: 8/8 (antes vaza; depois cada usuário só a sua unidade nas 88 tabelas; preflight aborta sem mudar nada com dado órfão, policy desconhecida e usuário sem unidade; rollback exato). Banco real (só leitura): 16/16 usuários passam; 0 linhas órfãs nas 88. Política: REVIEW/HIGH.
- **Comando/alteração:** `Rodar o arquivo inteiro (SQL Editor ou apply_migration). Depois: db/security/AUDITORIA_RLS.sql deve mostrar 0 'aguarda SEC-RLS-1' e 0 'NOVO'.`
- **Status:** EXECUTADO
- **Criado em:** 2026-10-08 22:13
- **Decidido em:** 2026-10-09 00:17
- **Decidido por:** lucas
- **Nota:** Aplicada em 08/10/2026 ~21:20 (horário de Brasília) em sessão acompanhada. Verificação OK; impressão digital dd885d7643ca73191ec17bc356fed4c1; AUDITORIA_RLS: 0 aguarda, 0 NOVO, 33 fase 2
- **Chave:** migracao:db/security/SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql

### APR-002 · EXECUTADO

- **Missão:** HDEV-SEC-002
- **Ação:** Aplicar db/security/SEC_RLS_2_FASE2.sql no Supabase real (fase 2 do isolamento: 31 tabelas, dados sensíveis de colaboradores, pode_ver_todas só super admin, token_nfe sem leitura pelo navegador)
- **Ambiente:** supabase (produção)
- **Risco:** HIGH
- **Motivo:** Mudança de RLS, policies, funções de acesso e privilégio de coluna em produção (CLAUDE.md: confirmação do dono). Fecha S-14, S-16 (token_nfe legível por qualquer logado) e S-17 (CPF/salário/documentos de RH legíveis na unidade); isola 33 tabelas restantes.
- **Impacto:** Hoje: gerente-geral (2) e super admin sem mudança. Cozinheiro (2) e somente-consulta (11) deixam de ver CPF, salário, endereço e documentos de RH dos colegas; as telas continuam com nome, cargo e horários (app atualizado). Registros legados (burguer, ticotico, todas, sem unidade) ficam só para o super admin, sem apagar nem mover. Exige o app novo (commit b5ba58b) no ar junto: unidades sem select * e tela fiscal sem ler o token. Trava ACCESS EXCLUSIVE breve em ~31 tabelas, lock_timeout 5s.
- **Rollback:** db/security/SEC_RLS_2_ROLLBACK.sql: recria as 37 policies e as 3 funções guardadas (sec_backup_policies_sec_rls_2 / sec_backup_funcoes_sec_rls_2) e devolve a leitura de token_nfe; testado no PGlite: volta exatamente ao estado da fase 1. Não apaga sec_dados_legados nem as 2 colunas unidade_id novas (aditivas).
- **Evidências:** PGlite com 2 empresas e as policies reais: os 15 testes obrigatórios + token_nfe + preflight + rollback (test:seguranca 24/24). test:agent 56/56, test:intelligence 130/130, test:qa 6/6, permissões OK, 55 testes do app OK, build OK. Simulação do preflight no banco real (só leitura): 0 tabelas faltando, 88 sec_unidade, 0 usuários sem unidade, 0 policies desconhecidas, 37 a trocar.
- **Comando/alteração:** `Rodar o arquivo inteiro (transação única; preflight aborta sem mudar nada). Depois: AUDITORIA_RLS.sql deve mostrar só as 3 linhas GLOBAL. NÃO inclui a reatribuição do evento (SEC_RLS_2_REATRIBUIR_EVENTO.sql precisa de aprovação própria).`
- **Status:** EXECUTADO
- **Criado em:** 2026-10-09 02:02
- **Decidido em:** 2026-10-09 02:05
- **Decidido por:** lucas
- **Nota:** Aplicada em 09/10/2026 ~00:05 (horário de Brasília) em sessão acompanhada, pelo conector Supabase, arquivo inteiro numa transação; preflight e verificação internos passaram (commit). Produção no ar antes: `5dea452` (contém `b5ba58b`). AUDITORIA_RLS depois: só as 3 linhas GLOBAL, 0 aguarda, 0 NOVO (TESTADO NO SUPABASE REAL). Smoke HTTP de produção sem sessão OK (TESTADO EM PRODUÇÃO). **Validação no Supabase real (09/10 ~00:20, só leitura, papel `authenticated` com o `sub` de um usuário real de cada perfil), TESTADO NO SUPABASE REAL:** backup 37 policies + 3 funções; impressão `9810b27e3d9a604b28933f84751db167`; legados classificados 46 (AMBIGUO 28, LEGADO 17, ORFAO 1), nada apagado; `token_nfe` sem SELECT para authenticated e anon, `hefisto_token_nfe_configurado` = true. Cozinheiro e somente-consulta: 0 linhas diretas de colaboradores, 0 CPF/salário, 0 documentos de RH; lista operacional 23 sem campo sensível; escala 1, registro_ponto 392 (iguais ao gerente); 1 unidade; 0 linha fora da unidade. Gerente geral: 23 colaboradores com dados de RH, 1 documento de RH, 1 unidade, 0 fora da unidade. Super admin: vê os 15 registros legados de notas e os 16 usuários. Entre empresas: produção tem 1 empresa só; isolamento entre empresas TESTADO LOCAL (PGlite, 2 empresas, test:seguranca 24/24). Smoke HTTP de produção sem sessão OK depois da aplicação. **SEC-RLS-2 CONCLUÍDA EM PRODUÇÃO.** Pendente fora do banco: smoke com sessão (`HEFISTO_QA_TOKEN`).
- **Chave:** migracao:db/security/SEC_RLS_2_FASE2.sql

### APR-003 · PENDENTE

- **Missão:** HDEV-WA-001
- **Ação:** Aplicar db/whatsapp/WA_001_FILA.sql no Supabase real (fila dos comandos do agente pelo WhatsApp: 2 tabelas novas e 1 função, só o servidor acessa)
- **Ambiente:** supabase (produção)
- **Risco:** MEDIUM
- **Motivo:** Escrita de esquema em produção (aditiva). Sem ela, os comandos do agente pelo WhatsApp respondem fila indisponível; perguntas sobre a empresa funcionam sem ela
- **Impacto:** –
- **Rollback:** db/whatsapp/WA_001_ROLLBACK.sql (apaga só a fila nova)
- **Evidências:** –
- **Comando/alteração:** `–`
- **Status:** PENDENTE
- **Criado em:** 2026-10-09 02:57
- **Chave:** migracao:db/whatsapp/WA_001_FILA.sql
