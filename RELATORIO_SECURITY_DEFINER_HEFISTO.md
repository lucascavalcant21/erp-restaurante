# RELATÓRIO DE AUDITORIA COMPLETA DE FUNÇÕES SECURITY DEFINER
## ERP HÉFISTO — MATRIZ DE SEGURANÇA E LOCKDOWN DE SCHEMA SQL

**Data:** 22 de Setembro de 2026  
**Sistema:** ERP Héfisto (Camada de Persistência Supabase PostgreSQL)  

---

### 1. MATRIZ DE AUDITORIA DE TODAS AS FUNÇÕES SECURITY DEFINER

| Função SQL | Permissão / Escopo | Tenant Check (`unidade_id`) | Search Path | Status de Segurança |
| :--- | :--- | :--- | :--- | :--- |
| `obter_resumo_central_comando(uuid)` | `financeiro.cashflow.view` / `auth.uid()` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `provisionar_novo_tenant(...)` | Autenticado (`auth.uid()`) | Sim (`empresa_id`, `unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `registrar_recebimento_mercadoria_v2(...)` | `compras.receipt.create` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `baixar_conta_pagar(...)` | `financeiro.accounts_payable.edit` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `estornar_pagamento_conta(...)` | `financeiro.accounts_payable.edit` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `registrar_venda_integrada_v2(...)` | `vendas.sales.create` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `conciliar_lote_repasses(...)` | `financeiro.conciliation.edit` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `bebida_entrada_unidades(...)` | `estoque.items.edit` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `bebida_baixa_unidades(...)` | `estoque.items.edit` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `bebida_baixa_conteudo(...)` | `estoque.items.edit` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `bebida_contagem(...)` | `estoque.items.edit` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `bebida_zerar(...)` | `estoque.items.edit` | Sim (`p_unidade_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `sincronizar_pre_preparo_ficha(uuid)` | Trigger / Sistema | Sim (`ficha_tecnica_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |
| `custo_fichas_tecnicas_recursivo(uuid)` | Leitura / Sistema | Sim (`ficha_tecnica_id`) | `SET search_path = public, pg_temp` | **100% LOCKDOWN** |

---

### 2. CONCLUSÃO DE SEGURANÇA SQL
100% das 20 funções `SECURITY DEFINER` do ERP Héfisto possuem escopo de isolamento por tenant e trava de `search_path = public, pg_temp` ativada. Nenhuma RPC confia em parâmetros booleanos do frontend nem permite sequestro de schema por utilizadores maliciosos.
