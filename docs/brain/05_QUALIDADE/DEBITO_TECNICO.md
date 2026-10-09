# Débito técnico

Por impacto. Não reescrever módulo estável só por estética ([[REGRAS_DO_PROJETO]]).

1. **Sem CI.** Nenhum teste roda no PR. Proposta: GitHub Actions com `test:intelligence` (+ PGlite), `app/lib` tests, catálogo de permissões, `test:agent` e build.
2. **Esquema do banco fora do repositório.** Tabelas centrais só existem em produção; `docs/schema-completo.sql` não é confiável. Fazer um dump schema-only em `db/baseline/`.
3. **Fase 1A ausente / 1B não aplicada.** O controle de acesso do banco depende do RBAC antigo + fallback.
4. **Dois backends:** o Express legado (`backend_cloud_code/`) atende boa parte de `/api/*` via `vercel.json` `builds`.
5. **IA legada espalhada:**
   - 17 rotas `ia-*` com `fetch` direto e modelos fixos;
   - `api/hefisto` e componentes órfãos do copilot (`HefistoAssistant.js`, `HefistoCopilotPanel.js`…).
6. **Guarda de página só para sessão `gerenciado`.**
7. **Cerca de 150 scripts avulsos na raiz** (`fix_*.js`, `push*.js`, `test-*.js`) e `scratch/`.
8. **Sem lint nem TypeScript.**
9. **Testes mistos:** `node:test` e scripts com contagem própria.
