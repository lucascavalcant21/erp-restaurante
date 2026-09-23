# CHECKLIST DE RELEASE E VALIDAÇÃO DE DEPLOY
## ERP HÉFISTO — PROCEDIMENTO OBRIGATÓRIO DE IMPLANTAÇÃO EM PRODUÇÃO

**Versão:** 1.0.0  
**Data:** 22 de Setembro de 2026  

---

### 📋 ETAPA 1: PRÉ-DEPLOY (CHECKS OBRIGATÓRIOS)
- [x] **Varredura de Segredos:** Confirmado que `SUPABASE_SERVICE_ROLE_KEY` não está presente em componentes frontend nem no repositório público.
- [x] **Auditoria SQL:** Todas as RPCs `SECURITY DEFINER` possuem `SET search_path = public, pg_temp` ativado.
- [x] **Migrations do Zero:** Executado `node scripts/test_db_from_zero.mjs` com 100% de aprovação.
- [x] **Ataque por UUID & Multi-Tenant:** Executado `node scripts/test_multitenant_saas_hefisto.mjs` com 100% de aprovação.
- [x] **Bateria E2E Completa:** Executado `node scripts/test_jornadas_e2e_hefisto.mjs` com 100% de aprovação.
- [x] **Compilação Estática:** Executado `npm run build` com saída Código 0 (148/148 páginas geradas com sucesso).

---

### 📋 ETAPA 2: APLICAÇÃO DE MIGRATIONS EM STAGING/PRODUÇÃO
1. Acessar o Supabase Dashboard SQL Editor.
2. Executar a nova migration `db/migracao_tenant_provisioning.sql`.
3. Confirmar que a função `provisionar_novo_tenant` foi registrada com `SECURITY DEFINER` e `search_path` travado.

---

### 📋 ETAPA 3: TESTE DE FUMAÇA PÓS-DEPLOY (SMOKE TEST)
Após a conclusão do deploy na Vercel:
1. **Login & Autenticação:** Efetuar login com usuário administrador de teste.
2. **Central de Comando:** Acessar `/dashboard` e verificar se alertas de estoque e financeiro carregam sem erros.
3. **Fichas Técnicas & Estoque:** Acessar `/dashboard/operacao/fichas` e `/dashboard/operacao/estoque`.
4. **Vendas & Financeiro:** Testar navegação em `/dashboard/vendas`, `/dashboard/financeiro/contas` e `/dashboard/financeiro/dre`.
5. **Busca Universal (Ctrl + K):** Pressionar `Ctrl + K` e realizar busca por palavra-chave ("etiquetas", "cmv").
