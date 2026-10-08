# Incidentes

Formato: data, o que aconteceu, impacto, causa, correção, prevenção.

| Data | Incidente | Impacto | Causa | Correção / prevenção |
|---|---|---|---|---|
| 07/10/2026 | `apply_migration` e `execute_sql` com `DROP` expiravam em 60 s sem aplicar | Nenhum (nada foi aplicado) | O conector Supabase pede confirmação manual para `DROP`; numa sessão sem ninguém olhando, expira | Aplicar sem os `drop … if exists` (no-op em banco novo) e verificar depois. Ver [[ERROS_QUE_NAO_DEVEM_REPETIR]] |
| 07/10/2026 | `git push` com "Internal Server Error" do GitHub | Atraso | Instabilidade remota | Repetir com espera crescente; conferir com `git ls-remote` |
