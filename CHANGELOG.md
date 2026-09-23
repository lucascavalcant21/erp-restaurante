# CHANGELOG — HÉFISTO ERP

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

## [1.0.0-rc.1] - 2026-09-22

### 🛡️ Segurança & Multi-Tenant
- **FASE 0 — Fix de Segurança na RPC da Central de Comando:** Removido parâmetro booleano público `p_pode_ver_financeiro`. A autorização é resolvida obrigatoriamente no servidor via `auth.uid()` e `hefisto_user_has_permission(v_uid, 'financeiro.cashflow.view')`.
- **Lockdown de `search_path`:** Adicionado `SET search_path = public, pg_temp` em 100% das 20 funções `SECURITY DEFINER` do repositório SQL (`db/`).
- **Isolamento de Tenant & RLS:** Aplicadas políticas RLS rigorosas por `unidade_id` em todas as tabelas operacionais e financeiras, prevenindo acessos cruzados por UUID.

### ⚙️ Infraestrutura & Multi-Tenant SaaS
- **RPC `provisionar_novo_tenant`:** Adicionado serviço de provisionamento automatizado de novas empresas e unidades em `db/migracao_tenant_provisioning.sql`.
- **Prevenção de Contaminação:** Garantia técnica de zero vazamento de dados privados do restaurante original (Seldeestrela) para novas instâncias SaaS.

### 🧪 Suíte de Testes Automatizados & Disaster Recovery
- **Restore Drill Real (`scripts/test_restore_drill_hefisto.mjs`):** Validação de backup, restauração e integridade referencial para 11 entidades críticas (empresa, unidade, usuário, ingrediente, estoque, ficha, produção, compra, conta_pagar, venda, recebível).
- **Varredura de Segredos & Bundle (`scripts/test_env_bundle_security.mjs`):** Confirmação de que `SUPABASE_SERVICE_ROLE_KEY` não atinge componentes frontend.
- **Validação de Impressão TSPL (`scripts/test_hardware_tspl_validation.mjs`):** Testes de layout e formatação de etiquetas térmicas de validade 60x40 mm.
- **Concorrência & Idempotência (`scripts/test_concurrency_idempotency_hefisto.mjs`):** Simulação multiusuário simultâneo (Estoque vs Produção) e trava contra duplo clique.
- **Corte & Inventário Inicial (`scripts/test_inventario_inicial_hefisto.mjs`):** Rotina de carga de inventário com histórico auditável `SALDO_INICIAL`.

### 📑 Documentações e Manuais de Produção
- Criado [`RUNBOOK_PRODUCAO_HEFISTO.md`](file:///c:/Users/lucas/OneDrive/%C3%81rea%20de%20Trabalho/Meu%20ERP/Meu%20ERP/RUNBOOK_PRODUCAO_HEFISTO.md)
- Criado [`ARCHITECTURE_HEFISTO.md`](file:///c:/Users/lucas/OneDrive/%C3%81rea%20de%20Trabalho/Meu%20ERP/Meu%20ERP/ARCHITECTURE_HEFISTO.md)
- Criado [`DEVELOPER_GUIDE_HEFISTO.md`](file:///c:/Users/lucas/OneDrive/%C3%81rea%20de%20Trabalho/Meu%20ERP/Meu%20ERP/DEVELOPER_GUIDE_HEFISTO.md)
- Criado [`RELEASE_CHECKLIST_HEFISTO.md`](file:///c:/Users/lucas/OneDrive/%C3%81rea%20de%20Trabalho/Meu%20ERP/Meu%20ERP/RELEASE_CHECKLIST_HEFISTO.md)
- Criado [`CHECKLIST_GO_LIVE_HEFISTO.md`](file:///c:/Users/lucas/OneDrive/%C3%81rea%20de%20Trabalho/Meu%20ERP/Meu%20ERP/CHECKLIST_GO_LIVE_HEFISTO.md)
- Criado [`RELATORIO_GO_LIVE_RC_HEFISTO.md`](file:///c:/Users/lucas/OneDrive/%C3%81rea%20de%20Trabalho/Meu%20ERP/Meu%20ERP/RELATORIO_GO_LIVE_RC_HEFISTO.md)
