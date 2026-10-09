---
id: HDEV-SEC-001
titulo: Eliminar policies inseguras de RLS, validar isolamento entre empresas e impedir regressão
fase: seguranca
status: BLOCKED
prioridade: 1
dependencias: []
bloqueadores: [BLQ-008]
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-SEC-001 — RLS: eliminar policies inseguras, validar isolamento e impedir regressão

## Objetivo

Pedido do dono (08/10/2026):
- eliminar as policies inseguras antigas de RLS;
- validar o isolamento entre empresas (tenant);
- impedir que voltem.

Assume a parte de RLS de [[HDEV-008]] (S-01, S-02). As rotas `ia-*` e `saas/export` (S-04, S-05) continuam lá.

## Critério de pronto

| Item | Situação |
|---|---|
| Inventário real do banco | ✅ TESTADO NO SUPABASE REAL (só leitura): 121 tabelas com RLS desligado ou policy aberta |
| Migração fase 1 (88 tabelas) com preflight, backup, verificação e rollback | ✅ `db/security/SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql` + `SEC_RLS_1_ROLLBACK.sql` |
| Isolamento validado com 2 unidades e as policies reais | ✅ TESTADO LOCAL (PGlite) |
| Ninguém perde acesso hoje | ✅ TESTADO NO SUPABASE REAL (só leitura): 16/16 usuários; 0 linhas órfãs nas 88 |
| Trava contra regressão | ✅ teste estático + auditoria do banco + política de publicação |
| Aplicado no banco real | ✅ TESTADO NO SUPABASE REAL: APR-001 aprovada pelo dono e executada em 08/10 (impressão `dd885d76…`) |
| Fase 2 (33 tabelas) | ⛔ precisa de decisão do dono sobre os dados (BLQ-008) |

## Arquivos afetados

`db/security/SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql`, `db/security/SEC_RLS_1_ROLLBACK.sql`, `db/security/AUDITORIA_RLS.sql` (novos), `app/lib/seguranca-rls.test.mjs` (novo), `scripts/hefisto-agent/politica.mjs` (detecta mais formas abertas), `config.json` (validação "segurança RLS"), `package.json` (`test:seguranca`).

## Testes obrigatórios

`PGLITE=… npm run test:seguranca` · `npm run test:agent` · `npm run test:intelligence` · catálogo de permissões.

## Resultado

**O que estava errado (TESTADO NO SUPABASE REAL, 08/10, só leitura):**
- RLS desligado em `colaboradores` e `registro_ponto` (salário, CPF, ponto).
- 119 outras tabelas com policy aberta em 4 formas:
  - `USING (true)`;
  - `WITH CHECK (true)`;
  - `auth.role() = 'authenticated'`;
  - `… OR unidade_id IS NULL`.
- Qualquer usuário logado lê e grava os dados de qualquer empresa.
- O anon não tem grant em nenhuma: o risco é entre logados.

**Fase 1, APLICADA no banco real em 08/10 (APR-001):**
- 88 tabelas passam a ter uma única policy `sec_unidade`: o usuário vê e grava só as unidades dele (unidade principal ou escopo). Super admin e escopo `todos` veem todas.
- O RLS é ligado em `colaboradores` e `registro_ponto`.
- Insert sem `unidade_id` recebe a unidade do usuário, para nenhuma tela quebrar.
- Hoje (1 unidade) **ninguém perde acesso**.
- **O preflight aborta sem mudar nada** se:
  - aparecer dado órfão;
  - aparecer uma policy desconhecida;
  - algum usuário ficar sem unidade.
- O rollback recria exatamente o estado anterior.

**Fase 2 (33 tabelas), depende de decisão do dono:**
- **Dados órfãos:**
  - `controle_limpeza`/`controle_manutencoes`: unidade antiga `burguer`;
  - `suprimentos_*`: `ticotico` e nulo;
  - `montagem`: 12 linhas sem unidade;
  - `eventos`: 1 linha sem unidade;
  - `notas_fiscais`: 15 com `todas`, gravadas por `app/lib/notas.js`.
  - Decidir: reatribuir para `seldeestrela` ou arquivar.
- **Tabelas-filhas sem coluna de unidade:** precisam de policy pela tabela-mãe (fichas, pedidos, eventos, op_*).
- **Cadastros e catálogos globais:** decidir o que cada um vê (`usuarios_erp`, `unidades`, `perfis_acesso`, `fin_categorias`…).
- **Dentro da mesma unidade:** salário e CPF em `colaboradores` continuam legíveis por qualquer funcionário logado da unidade. Precisa de uma view sem colunas sensíveis e ajuste nas telas.

**Trava contra regressão (já ativa):**
1. **`npm run test:seguranca`**, que o runner roda em toda rodada:
   - qualquer `.sql` novo com policy aberta ou RLS desligado faz o teste falhar;
   - o push fica segurado pela política de publicação;
   - os 29 arquivos antigos inseguros estão congelados numa lista que só pode diminuir.
2. **`db/security/AUDITORIA_RLS.sql`** (só leitura, passa pela guarda da noite):
   - classifica cada tabela insegura do banco real como "aguarda SEC-RLS-1", "fase 2" ou **"NOVO: REGRESSÃO"**;
   - hoje: 88 aguardando, 33 na fase 2, 0 novas.
3. **A política de publicação** ([[POLITICA_PUBLICACAO]]):
   - agora reconhece também `auth.role() = 'authenticated'`, `… OR unidade_id IS NULL` e RLS desligado dentro de SQL dinâmico (`EXECUTE format(...)`);
   - essas formas viram BLOCKED.

## Evidências

| Item | Evidência |
|---|---|
| Inventário: 121 tabelas inseguras, anon sem grant | TESTADO NO SUPABASE REAL (só leitura) |
| 16/16 usuários ativos continuam com acesso; 0 linhas órfãs nas 88 | TESTADO NO SUPABASE REAL (só leitura) |
| Auditoria: 88 aguarda, 33 fase 2, 0 NOVO | TESTADO NO SUPABASE REAL (só leitura) |
| Antes: outra unidade lê e grava; depois: só a própria, nas 88 tabelas; admin vê todas; inativo, bloqueado e escopo "empresa" não veem nada; update e delete na outra unidade não têm efeito | TESTADO LOCAL (PGlite, policies reais reproduzidas) |
| Preflight aborta sem mudar nada (órfão, nulo, policy desconhecida, usuário sem unidade); reaplicar aborta | TESTADO LOCAL (PGlite) |
| Rollback volta exatamente ao estado anterior | TESTADO LOCAL (PGlite) |
| Trava estática e auditoria passam pela guarda | TESTADO LOCAL |
| `test:seguranca` 8/8 · `test:agent` 56/56 · `test:intelligence` 130/130 (PGLITE) · `test:qa` 6/6 | TESTADO LOCAL |
| Aplicação no banco real: preflight + troca + verificação no mesmo commit; 88 `sec_unidade`, RLS ligado em colaboradores/registro_ponto, 107 policies no backup, 48 gatilhos, anon sem execute | TESTADO NO SUPABASE REAL (08/10) |
| Usuários reais depois (transação desfeita): funcionário vê os 23 colaboradores, 392 pontos e 363 insumos da unidade; gravar em outra unidade → **recusado pelo RLS**; logado sem cadastro → 0 linhas; super admin → tudo | TESTADO NO SUPABASE REAL |
| `AUDITORIA_RLS.sql` depois: 0 aguarda, 0 NOVO, 33 fase 2 · advisor sem `rls_disabled_in_public` | TESTADO NO SUPABASE REAL |
| Telas do ERP depois da mudança | NÃO VALIDADO (fazer no preview logo depois de aplicar; com 1 unidade, o esperado é nenhuma diferença) |

## Histórico

- 2026-10-08 criada e trabalhada em sessão acompanhada; fase 1 pronta; aplicação aguarda o dono (APR-001) → BLOCKED
- 2026-10-08 ~21:20 (Brasília) dono aprovou a APR-001; fase 1 aplicada e verificada no Supabase real; fase 2 aguarda decisões sobre os dados (BLQ-008) → BLOCKED
