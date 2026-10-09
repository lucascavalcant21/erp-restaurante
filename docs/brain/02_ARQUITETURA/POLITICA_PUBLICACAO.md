# Política de publicação e banco

Missão [[HDEV-PUBLISH-001]] · decisão [[DECISOES_ARQUITETURAIS]] DA-008 · pedidos em [[APROVACOES_PENDENTES]] · registro em [[DEPLOYS]].

O agente trabalha sozinho por horas, mas **produção e banco real seguem regras objetivas**, todas num lugar só: `scripts/hefisto-agent/politica.mjs`.

## Dois modos

| Modo | Quando | O que acontece |
|---|---|---|
| **AUTO SAFE** | Risco LOW/MEDIUM, testes e build verdes, sem segredo no bundle, sem quebra de tenant, migração aditiva com rollback, preview validado (para produção) | Segue sozinho |
| **APPROVAL REQUIRED** | Risco HIGH/CRITICAL, ação da lista do dono, falta de rollback, ou chave de configuração desligada | Pedido em `APROVACOES_PENDENTES.md`; **para só aquela etapa** e segue no resto |
| **BLOCKED** | Algo falhou ou falta evidência | Não publica; volta a avaliar na próxima rodada |

## Motor de decisão

`avaliarPolitica(entrada, publicacao)`:

- **Entrada:** `changeType`, `environment`, `affectedAreas`, `migrationType`, `tests`, `build`, `securityChecks`, `rollbackAvailable`, `tenantIsolation`, `secretsCheck` (mais `branchUpToDate`, `conflicts`, `previewValidated`).
- **Saída:** `riskLevel` (LOW/MEDIUM/HIGH/CRITICAL), `decision` (AUTO_SAFE/APPROVAL_REQUIRED/BLOCKED), `reasons`, `requiredChecks`, `approvalRequired`.

### Risco

| Nível | Exemplos |
|---|---|
| LOW | Só docs; código fora de produção |
| MEDIUM | Código em produção; migração SAFE; área sensível fora de produção |
| HIGH | Migração REVIEW; área sensível (auth, permissões, RLS, financeiro, servidor) em produção ou no banco; sem rollback |
| CRITICAL | Migração CRITICAL; qualquer ação da lista do dono (DROP, TRUNCATE, DELETE/UPDATE em massa, RLS crítico, auth, segredo, senha/2FA, excluir usuário, pagamento, transferência, anúncio, DNS, domínio, produção irreversível) |

### Regras fixas (nenhuma chave muda)

1. **BLOCKED** se: teste falhou, build falhou, isolamento entre empresas falhou, RLS inseguro, segredo no bundle, conflito não resolvido, regressão crítica, ou branch atrás da `main` (para produção). A trava vence até o CRITICAL.
2. **CRITICAL sempre pede o dono.**
3. **HIGH em produção ou no banco sempre pede o dono.**
4. **Sem rollback conhecido**, migração ou produção nunca são automáticas.
5. **Sem evidência não publica:** verificação exigida e não feita → BLOCKED ("faltam verificações: …").

## Chaves (`scripts/hefisto-agent/config.json` → `publicacao`)

| Chave | Padrão | Efeito |
|---|---|---|
| `autoPublishPreview` | `true` | Push do branch de trabalho (o Vercel gera o preview) |
| `autoPublishProductionLowRisk` | **`false`** | Produção LOW/MEDIUM com tudo verde sem pedir |
| `autoApplySafeMigrations` | **`false`** | Migração SAFE no banco real sem pedir |
| `requireApprovalForHighRisk` | `true` | Só afrouxa HIGH **fora** de produção/banco |
| `requireApprovalForCritical` | `true` | Informativo: CRITICAL pede o dono de qualquer jeito |

> **Ligar uma chave não dá ferramenta ao agente.** `apply_migration`, `gh pr merge` e `vercel --prod` continuam negados no motor. Com a chave ligada, o runner registra que a política liberaria, mas não executa. Dar a ferramenta é a decisão pendente do dono em [[DECISOES_PRODUTO]].

## Fluxo no runner (cada rodada)

commit → validações (testes; build se `app/` mudou) → **política** → push → PR → preview → smoke → produção.

1. **Preview:** AUTO_SAFE → push. Senão, o push espera e o motivo fica no relatório e no `hefisto:status`.
2. **Migração** (cada `db/**/*.sql` novo ou mudado): classificada e ensaiada. APPROVAL_REQUIRED → pedido `migracao:<arquivo>` (atualizado, não duplicado). **Escrever o arquivo não é aplicar.** O branch sobe se a migração não for insegura.
3. **Produção** (missão DONE com código): a política decide. APPROVAL_REQUIRED → pedido `producao:<branch>`. "Preview validado" vale só com o smoke completo (token e outra empresa) **no mesmo commit** (`HEFISTO_REGISTRAR_PREVIEW=.hefisto-agent/preview.json npm run qa:smoke`).
4. **Registro:** `.hefisto-agent/publicacoes.jsonl` (`deploy_url`, `commit_sha`, `branch`, `build_status`, `test_status`, `timestamp`, decisão, risco) e a tabela gerada em [[DEPLOYS]].

## Classificação de migrações

`npm run hefisto:politica -- migracao db/arquivo.sql` (código de saída: 0 SAFE, 3 REVIEW, 4 CRITICAL).

| Classe | Comandos | Pode ser automática? |
|---|---|---|
| **SAFE** | CREATE TABLE/INDEX/VIEW/FUNCTION/POLICY com filtro, ADD COLUMN nulo, GRANT controlado, REVOKE de anon/public, ALTER em tabela criada no mesmo arquivo, DROP seguido de recriação | Sim, se `autoApplySafeMigrations` e rollback |
| **REVIEW** | ALTER COLUMN/tipo/nome, constraint, ligar RLS em tabela existente, SECURITY DEFINER, trigger, UPDATE/DELETE com filtro, INSERT…SELECT, GRANT para anon/public/ALL, SQL dinâmico (EXECUTE), comando não reconhecido | Não (HIGH) |
| **CRITICAL** | DROP TABLE/COLUMN/SCHEMA…, TRUNCATE, DELETE/UPDATE sem WHERE, desligar RLS, policy `using (true)` | Não. Desligar RLS ou policy aberta = **RLS inseguro → BLOCKED** |

- Também analisa os blocos `DO $$ … $$` (rodam na hora); textos e comentários não contam.
- **Dry-run:** análise estática (tabelas alteradas, travas ACCESS EXCLUSIVE/SHARE, rollback, transação, preflight, verificação). Com `PGLITE=…`, roda num banco vazio dentro de transação desfeita: separa erro de sintaxe de dependência ausente.
- **Rollback:** bloco de comentário `ROLLBACK` no arquivo ou arquivo irmão (`IC_01_ROLLBACK.sql`, `*_ROLLBACK.sql`, `rollback_*.sql`).
- **Calibrado nos 150 arquivos de `db/`** (08/10): 55 SAFE, 76 REVIEW, 19 CRITICAL. Os 24 com policy aberta ou RLS desligado saem BLOCKED (ver S-13 em [[SEGURANCA]]).

## Aprovações

`npm run hefisto:aprovacoes` (listar) · `-- aprovar APR-001` · `-- rejeitar APR-001 "motivo"` · `-- executado APR-001`.

- **Formato:** ID, missão, ação, ambiente, risco, motivo, impacto, rollback, evidências, comando/alteração, status.
- **Status:** PENDENTE → APROVADO/REJEITADO; APROVADO → EXECUTADO.
- **O agente pede, nunca aprova:**
  - com `HEFISTO_AGENT=1` (ligado no motor), aprovar/rejeitar é recusado;
  - os comandos estão em `disallowedTools`.
- **WhatsApp (futuro):** `processarComando(arquivo, "APROVAR APR-001", { autorizado, origem })`.
  - Quem chama tem que conferir que a mensagem veio do número do dono pela API oficial da Meta. Só então passa `autorizado: true`.
  - Não está ligado a nenhum canal ainda ([[HDEV-007]]).
- **Limite conhecido:** o arquivo é texto no repositório. Quando existir um executor automático, ele precisa confirmar a aprovação por fora (commit do dono ou mensagem assinada), não só ler o status.
