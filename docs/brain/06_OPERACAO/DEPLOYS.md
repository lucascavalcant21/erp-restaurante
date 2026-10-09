# Deploys

## Como o deploy funciona

- **Vercel**, projeto `erp-restaurante` (time `lucas-cavalcante`).
  - Push na `main` → produção (`app.hefisto.com.br`).
  - Push em branch → preview.
- **Migrações de banco não vão pelo deploy.** São aplicadas à parte, com preflight → aplicação em transação → verificação.

## Registro

_Toda publicação do agente passa pela política ([[POLITICA_PUBLICACAO]]). A tabela automática fica no fim deste arquivo._

| Data | O quê | Ambiente | Evidência |
|---|---|---|---|
| 07/10/2026 | IC_01 v ic-01.2 (tabelas `intelligence_*`) | Supabase produção | Verificação toda OK, impressão `d55eda66…` |
| 08/10/2026 | SEC-RLS-1 (isolamento por unidade, 88 tabelas; APR-001) | Supabase produção | Preflight e verificação OK; impressão `dd885d76…`; usuários reais isolados; AUDITORIA_RLS 0 NOVO. Rollback: `db/security/SEC_RLS_1_ROLLBACK.sql` |
| 07/10/2026 | `main` `c3d45cb` (correção das fichas g/ml) | Produção `dpl_AqdMC…` | Vercel READY |
| 07–08/10/2026 | Branch `claude/fervent-bell-t363k5` | Preview | Vercel READY (último build conferido: `c338122`) |
| 08/10/2026 23:12 | **Intelligence Core em produção**: `main` `5dea452` (merge do PR #127, inclui `29587df`) | Produção `dpl_Hv3LTLiZj74yE1b5g4K95escZ5Kv` (`erp-restaurante-lk644cmg5`), servindo `app.hefisto.com.br` | Vercel READY. Build local OK, 0 segredo no bundle do cliente. Testes um arquivo por vez, todos verdes (seguranca 8+16, agent 33+23, intelligence 8 arquivos, qa 6, rotas 2, permissões OK). Smoke em produção 09/10 ~00:00: brief sem token 401, ask sem token 401, token inválido 401, `/login` 200, `/dashboard/inteligencia` 200. **Pendente:** smoke com sessão (dono 200, sem permissão 403, outra empresa 403/sem vazamento) precisa de `HEFISTO_QA_TOKEN`. Rollback: Instant Rollback para `erp-restaurante-8fc4spom7` (produção anterior). Ativo: Pergunte ao Héfisto, Daily Brief (só com dados reais), ação `stock.registerLoss` com prévia + confirmação + auditoria obrigatória (falha fechada). Bloqueado: todas as outras ações (indisponíveis ou CRITICAL). Banco: APR-002/Fase 2 **não aplicada**. |

## Checklist para publicar o Intelligence Core (PR #127)

1. Preview READY no commit final; testes locais e build verdes.
2. **Smoke no preview** (precisa de ACESSO-001 e 003):
   - API: `BASE_URL=<preview> HEFISTO_QA_TOKEN=… HEFISTO_QA_UNIDADE=… HEFISTO_QA_OUTRA_UNIDADE=… npm run qa:smoke`
     (sai 0 = OK, 1 = falha, **2 = vazamento entre empresas → não publicar**);
   - sem token: 401;
   - dono: 200 no brief e no ask;
   - outra unidade: 403;
   - somente-consulta: 403;
   - telas sem erro de console (Playwright, desktop e celular).
3. Aprovação do dono (ACESSO-004).
4. Merge → produção READY.
5. **Smoke em produção** (mesmos casos) + uma pergunta que leve à Anthropic (`provedor_ia` preenchido em `intelligence_eventos`).
6. **Se algo falhar:** rollback instantâneo no Vercel para o deploy anterior
   (Deployments → deploy de produção anterior → "Instant Rollback"; ou `vercel rollback <url-anterior>`).
   Anotar aqui o id do deploy de produção **antes** do merge, para saber para onde voltar.
   Depois do rollback: `BASE_URL=https://app.hefisto.com.br npm run qa:smoke` (casos sem sessão).
   - O banco não precisa voltar: as tabelas `intelligence_*` são aditivas e o ERP não as usa.
