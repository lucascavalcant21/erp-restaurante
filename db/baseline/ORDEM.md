# Ordem de Aplicação das Migrações e Baseline — HÉFISTO ERP

```
1. 0001_baseline_schema.sql (Estrutura canônica obtida via dump schema-only da produção)
2. migracao_rls_autorizacao_servidor.sql (HOTFIX V4 — RLS fail-closed e schema privado)
3. proposta_hefisto_session_context.sql (hefisto_session_context fail-closed)
4. migracao_integracoes_canonica.sql (Camada canônica de integrações iFood/Saipos)
```

> **Nota:** Nenhuma das etapas acima deve ser executada em banco de produção ou staging até a conclusão da fase de auditoria real do catálogo PostgreSQL.
