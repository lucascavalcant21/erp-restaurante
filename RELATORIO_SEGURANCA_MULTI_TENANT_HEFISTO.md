# RELATÓRIO DE SEGURANÇA E AUDITORIA MULTI-TENANT
## ERP HÉFISTO — ISOLAMENTO DE DADOS, RPCs E PERMISSÕES NO BANCO

**Data:** 22 de Setembro de 2026  
**Sistema:** ERP Héfisto (Gestão Gastronômica & Restaurantes)  
**Status:** Auditado, Corrigido (FASE 0) e Validado  

---

### 1. OBJETIVO DA REVISÃO DE SEGURANÇA
Garantir a total integridade e isolamento de dados entre empresas/unidades (multi-tenant) no ERP Héfisto, eliminando qualquer vulnerabilidade de falsificação de parâmetros (parameter spoofing) no frontend ou escalada de privilégios via RPCs.

---

### 2. AUDITORIA DA FASE 0: CENTRAL DE COMANDO (`obter_resumo_central_comando`)
#### ⚠️ Vulnerabilidade Corrigida:
Anteriormente, a RPC recebia um parâmetro booleano público enviado pelo frontend:
`obter_resumo_central_comando(p_unidade_id, p_pode_ver_financeiro)`.
Isso permitia que um cliente malicioso manipulasse a requisição enviando `p_pode_ver_financeiro = true` para contornar restrições de perfil e visualizar faturamento, contas a pagar e dados financeiros sigilosos.

#### ✅ Solução Implementada (`db/migracao_central_comando.sql`):
1. **Remoção do parâmetro `p_pode_ver_financeiro`** da assinatura da função SQL.
2. **Autorização Server-Side Obrigatória:**
   A RPC obtém o UID do usuário diretamente no banco via `v_uid := auth.uid()` e consulta suas permissões registradas via:
   `v_pode_ver_fin := hefisto_user_has_permission(v_uid, 'financeiro.cashflow.view');`
3. **Restrição de Resposta:** Se `v_pode_ver_fin` for `false`, o bloco financeiro retorna estritamente: `jsonb_build_object('restrito', true)`.
4. **Lockdown de `search_path`:** Declaração explícita de `SET search_path = public, pg_temp` em todas as funções `SECURITY DEFINER` para evitar ataques de manipulação de schemas temporários.

---

### 3. CONTROLE DE SINAIS OPERACIONAIS (`operational_signals`)
- **Deduplicação Ativa:** Adicionada constraint de unicidade condicional `uq_signal_active` para garantir que apenas um sinal do mesmo tipo e entidade esteja ativo por unidade por vez (`WHERE resolvido = false AND expirado = false`).
- **Expiração Automática:** Sinais operacionais possuem validade e são marcados como expirados ou resolvidos automaticamente quando o insumo é reabastecido ou a conta financeira é quitada.
- **Tenant Isolation:** Filtro obrigatório por `unidade_id` em todas as queries e views do banco.

---

### 4. AUDITORIA DE RLS (ROW LEVEL SECURITY) E RPCS
- **Filtro por Unidade/Empresa:** Todas as tabelas sensíveis (`estoque_atual`, `contas_pagar`, `contas_receber`, `vendas`, `fichas_tecnicas`) possuem políticas RLS ativas validando se o usuário pertence à `unidade_id` correspondente.
- **Funções `SECURITY DEFINER`:** Verificadas e atualizadas com controle restrito de escopo e checagem de permissão via `hefisto_user_has_permission(auth.uid(), 'permissao')`.

---

### 5. VALIDAÇÃO POR TESTES AUTOMATIZADOS DE SEGURANÇA
Na bateria `scripts/test_jornadas_e2e_hefisto.mjs`, os seguintes testes de segurança foram validados com sucesso:
- **Teste 2.1:** Tentativa de acesso financeiro por usuário sem permissão -> Retorna bloco restrito (`restrito: true`).
- **Teste 2.2:** Isolamento entre Tenants (Unidade ALPHA vs Unidade BETA) -> Tentativas de consulta cross-tenant retornam 0 registros, comprovando ausência de vazamento de dados.

---

### 6. CONCLUSÃO
A camada de persistência e serviços do ERP Héfisto cumpre rigorosamente as normas de segurança multi-tenant, autorização server-side e proteção contra vazamentos de dados operacionais e financeiros.
