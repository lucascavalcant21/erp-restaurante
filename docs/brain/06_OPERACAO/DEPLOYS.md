# Deploys

## Como o deploy funciona

- **Vercel**, projeto `erp-restaurante` (time `lucas-cavalcante`).
  - Push na `main` → produção (`app.hefisto.com.br`).
  - Push em branch → preview.
- **Migrações de banco não vão pelo deploy.** São aplicadas à parte, com preflight → aplicação em transação → verificação.

## Registro

| Data | O quê | Ambiente | Evidência |
|---|---|---|---|
| 07/10/2026 | IC_01 v ic-01.2 (tabelas `intelligence_*`) | Supabase produção | Verificação toda OK, impressão `d55eda66…` |
| 07/10/2026 | `main` `c3d45cb` (correção das fichas g/ml) | Produção `dpl_AqdMC…` | Vercel READY |
| 07–08/10/2026 | Branch `claude/fervent-bell-t363k5` | Preview | Vercel READY (último build conferido: `c338122`) |

## Checklist para publicar o Intelligence Core (PR #127)

1. Preview READY no commit final; testes locais e build verdes.
2. **Smoke no preview** (precisa de ACESSO-001 e 003):
   - sem token: 401;
   - dono: 200 no brief e no ask;
   - outra unidade: 403;
   - somente-consulta: 403;
   - telas sem erro de console (Playwright, desktop e celular).
3. Aprovação do dono (ACESSO-004).
4. Merge → produção READY.
5. **Smoke em produção** (mesmos casos) + uma pergunta que leve à Anthropic (`provedor_ia` preenchido em `intelligence_eventos`).
6. **Se algo falhar:** rollback instantâneo no Vercel para o deploy anterior.
   - O banco não precisa voltar: as tabelas `intelligence_*` são aditivas e o ERP não as usa.
