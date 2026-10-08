# Aprovações pendentes

Pedidos do agente que **só o dono decide** (risco HIGH/CRITICAL, produção, banco real, ações da lista do CLAUDE.md).
O agente para só a etapa pedida e segue no resto. Regras em [[POLITICA_PUBLICACAO]].

- Ver: `npm run hefisto:aprovacoes`
- Decidir: `npm run hefisto:aprovacoes -- aprovar APR-001` ou `-- rejeitar APR-001 "motivo"`
- Depois de executar: `npm run hefisto:aprovacoes -- executado APR-001`

Status: PENDENTE → APROVADO / REJEITADO → EXECUTADO. Não apague seções: é o histórico.

**Pendentes agora: 1**

### APR-001 · PENDENTE

- **Missão:** HDEV-SEC-001
- **Ação:** Aplicar db/security/SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql no Supabase real (isolamento por unidade em 88 tabelas; liga RLS em colaboradores e registro_ponto)
- **Ambiente:** supabase (produção)
- **Risco:** HIGH
- **Motivo:** Mudança de RLS/policy em produção (CLAUDE.md: confirmação do dono). Corrige S-01 e S-02: hoje qualquer usuário logado de qualquer empresa lê e grava 88 tabelas, inclusive salário, CPF e ponto.
- **Impacto:** Hoje (1 unidade, 16 usuários): ninguém perde acesso (conferido no banco real, só leitura). Muda: outra empresa/unidade não vê nem grava. Trava ACCESS EXCLUSIVE breve em 88 tabelas (rodar fora do horário de pico). Insert sem unidade_id recebe a unidade do usuário.
- **Rollback:** db/security/SEC_RLS_1_ROLLBACK.sql (recria as policies guardadas em sec_backup_policies_sec_rls_1; testado no PGlite: volta exatamente ao estado anterior)
- **Evidências:** PGlite com as policies reais de produção: 8/8 (antes vaza; depois cada usuário só a sua unidade nas 88 tabelas; preflight aborta sem mudar nada com dado órfão, policy desconhecida e usuário sem unidade; rollback exato). Banco real (só leitura): 16/16 usuários passam; 0 linhas órfãs nas 88. Política: REVIEW/HIGH.
- **Comando/alteração:** `Rodar o arquivo inteiro (SQL Editor ou apply_migration). Depois: db/security/AUDITORIA_RLS.sql deve mostrar 0 'aguarda SEC-RLS-1' e 0 'NOVO'.`
- **Status:** PENDENTE
- **Criado em:** 2026-10-08 22:13
- **Chave:** migracao:db/security/SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql
