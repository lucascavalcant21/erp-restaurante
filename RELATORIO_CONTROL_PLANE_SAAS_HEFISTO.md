# RELATÓRIO DO CONTROL PLANE SAAS E ARQUITETURA DE PLATAFORMA
## ERP HÉFISTO — GESTÃO MULTI-TENANT, ENTITLEMENTS E SEGURANÇA

**Data:** 22 de Setembro de 2026  
**Sistema:** ERP Héfisto (Control Plane SaaS)  
**Versão:** `1.0.0-rc.1`  
**Status:** Auditado, Implementado e Validado  

---

### 1. ARQUITETURA DO CONTROL PLANE SAAS (`/admin`)

O Control Plane é uma área administrativa estritamente separada da operação dos restaurantes:

- **Rota:** `/admin`
- **Tabela de Autorização:** `public.saas_plataforma_admins`
- **Validação de Acesso:** Resolvida no servidor via RPC `obter_resumo_control_plane_saas()`, que verifica se o `auth.uid()` pertence à tabela de superadministradores da plataforma.
- **Princípio de Privacidade SaaS:** O Control Plane exibe apenas metadados administrativos (Empresa, Unidades, Usuários, Plano, Status, Onboarding). **NENHUM** dado comercial privado (vendas, estoque, receitas, folha, DRE) é exposto ao administrador da plataforma.

---

### 2. ESTRUTURA DE PLANOS E ENTITLEMENTS

O sistema separa conceitualmente **PLANO DA EMPRESA (ENTITLEMENT)** de **PERMISSÃO DO USUÁRIO (PERMISSION)**:

| Plano | Features Liberadas (Entitlements) |
| :--- | :--- |
| **BASIC** | Operação Base (Estoque Básico, Fichas, Produção, Etiquetas) |
| **PRO** | Operação + Financeiro Integrado (`hasFinancial`), DRE, CMV, Inteligência (`hasAI`), Integrações (`hasIntegrations`) |
| **MULTIUNIT** | Todas as features do PRO + Múltiplas Unidades (`hasMultiUnit`) |

- **Função Evaluator SQL:** `hefisto_eval_entitlement(empresa_id, feature_key)`
- **Validação Server-Side:** Se o plano não possuir o entitlement (ex: `hasAI = false`), as chamadas de API e RPCs são bloqueadas no servidor.

---

### 3. AUDITORIA E LOGS ADMINISTRATIVOS (`saas_audit_logs`)

Toda ação administrativa no Control Plane grava um registro auditável:
- `TENANT_CREATED` — Provisionamento de novo restaurante.
- `PLAN_CHANGED` — Alteração de plano.
- `TENANT_SUSPENDED` — Suspensão temporária de acesso.
- `TENANT_REACTIVATED` — Reativação de conta.
