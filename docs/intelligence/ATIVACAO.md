# Héfisto Intelligence Core: ativação controlada (IC-1P)

Roteiro para sair de "funciona em testes" para "funciona no Héfisto real".

Siga os passos na ordem. Em cada passo, só avance se o anterior deu o resultado esperado.

O que já foi validado nesta branch e onde:
- **Local (PGlite):** a migração, as funções de acesso do repositório e o registro de perda contra o SQL real do estoque.
- **Mock:** telas e conversa.

O que **ainda não foi validado** no Supabase real nem em produção: veja o relatório do PR.

## 0. Pré-requisitos (dono do projeto)

| O quê | Onde | Observação |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | variável de **servidor** do deploy | Nunca `NEXT_PUBLIC_`. É lida só em `app/lib/config/supabase-server.mjs` e em `app/lib/intelligence/server/http.mjs`. Sem ela, as consultas funcionam, mas ações e configurações ficam bloqueadas (503). |
| `ANTHROPIC_API_KEY` | variável de servidor | Opcional. Sem ela, só o interpretador por regras funciona (as 10 perguntas e a perda funcionam por regras). |
| Acesso ao SQL Editor do projeto `sezccspqxgklicfndwxx` | Supabase | Para os passos 1 a 4. |

## 1. Preflight: somente leitura

Rode `db/intelligence/IC_01_PREFLIGHT.sql`. É um SELECT só, sobre o catálogo do Postgres.
- Nenhuma linha pode sair **BLOQUEIA**.
- Leia a coluna `definicao` de:
  - `hefisto_user_can`
  - `hefisto_user_in_unit`
  - `hefisto_user_has_permission`
  - `estoque_movimentar`

  Elas devem ser as do repositório:
  - `docs/controle-acesso-rbac.sql` (`hefisto_user_can`, `hefisto_permission_match`);
  - `db/1b/01_contexto_escopo_concessao.sql` (validade, escopo e permissão);
  - `db/EST_MOV_1_HISTORICO_IMUTAVEL_E_MOVIMENTOS.sql` (`estoque_movimentar`, `_estoque_pode`).
- **ATENÇÃO** em `fontes` só significa que aquela métrica vai responder DADOS INSUFICIENTES.

### O que `hefisto_user_can` faz, pela análise do repositório

Assinatura: `hefisto_user_can(p_permission text, p_unidade_id text default null) returns boolean`.
- `LANGUAGE sql`, `SECURITY DEFINER`, `STABLE`, `search_path = public`.
- EXECUTE para `authenticated` e `service_role`; revogado de `public`.
- Regra: `hefisto_user_has_permission(auth.uid(), chave) AND hefisto_user_in_unit(auth.uid(), unidade)`.
  - **Usuário válido:** ativo, não bloqueado, dentro da vigência, do dia e do horário permitidos, com perfil ativo ou permissão própria.
  - **Super admin:** permissão `*` e todas as unidades.
  - **Negação explícita** vence a concessão.
  - **Curingas:** `*`, `modulo.*`, `modulo.pagina.*`.

| Perfil (presets do RBAC) | `dashboard.intelligence.view` | `.settings` | Por quê |
|---|---|---|---|
| Dono (primeiro admin, super admin + `administrador-geral`) | passa | passa | `super_admin` |
| Super admin | passa (todas as unidades) | passa | `super_admin` |
| Administrador da empresa (`administrador-geral`, escopo empresa) | passa só nas unidades da empresa | passa | `*` |
| Gerente geral | passa | passa | `dashboard.*` |
| Gerente com perfil **editado** no montador | **não passa** até conceder | não | o montador grava chaves explícitas |
| Financeiro, caixa, marketing, consulta, garçom… | não | não | só `dashboard.overview.view` |

Isto foi provado em PGlite com as funções **do repositório** (`migracao.test.mjs`). Confirme no banco real com o passo 2.

## 2. Quem vai enxergar: somente leitura

Rode `db/intelligence/IC_01_PERMISSOES.sql`. Ele mostra contagem por perfil, sem nomes.
- Dono e super admin precisam aparecer com `ve_central` > 0.
- Se um perfil administrativo aparecer com 0, conceda pela tela de acessos: **Dashboard → Central de Inteligência (Héfisto) → Visualizar** (e **Alterar configurações** para quem define metas).
- Não conceda a todos os funcionários.

## 3. Aplicar a migração (aditiva)

> **Aplicada em produção em 07/10/2026.** As evidências estão em `HI02_EVIDENCIAS.md`. Pelo conector Supabase, `DROP` trava esperando confirmação manual. Num banco ainda sem `intelligence_*`, as linhas `drop … if exists` não fazem nada e podem ser omitidas.

Rode `db/intelligence/IC_01_INTELLIGENCE_CORE.sql` (versão `ic-01.2`). O que ela faz e não faz:
- Cria **somente** `intelligence_eventos`, `intelligence_acoes`, `intelligence_feedback` e `intelligence_preferencias`, mais uma função de trigger própria.
- Aborta sem mudar nada se:
  - a base não for a esperada;
  - um nome já existir sem ser desta migração;
  - `unidades.id` não for text.
- Nenhum `DROP`, `DELETE`, `UPDATE` ou `TRUNCATE` em tabela existente. Isso é conferido por teste.
- Não toca em estoque, financeiro, RH ou vendas.

## 4. Conferir e guardar a evidência: somente leitura

Rode `db/intelligence/IC_01_VERIFICACAO.sql`.
- Todas as linhas devem sair **OK**: tabelas com a versão, RLS, policies, triggers, índices, grants por papel e FKs.
- A **impressão digital das colunas** deve ser `d55eda66f4eddaf4d90ce66743131071`, a mesma conferida no teste.
- Guarde o resultado (print ou CSV) no PR como evidência da versão aplicada.

**Rollback:** `IC_01_ROLLBACK.sql`. Só use se a migração impedir o sistema de funcionar: ele apaga o histórico da inteligência.

## 5. Smoke test autenticado (sem mock)

Faça com um usuário dono, numa unidade real.

1. O menu **Inteligência** aparece. Abra a **Central de Inteligência** e o botão **Pergunte ao Héfisto** numa outra tela.
2. Faça as 10 perguntas. Para cada resposta, confira valor, período, fonte, unidade e confiança (em "De onde veio"). Sem base, a resposta correta é **DADOS INSUFICIENTES**: não preencha números.
3. Faça a conversa mínima:
   - "Como estamos hoje?"
   - "Tem alguma coisa errada?"
   - "Por quê?"
   - "Quanto tenho de *produto de teste*?"
   - "Perdi 2 kg."
4. **Perda.** Use **só** um produto de teste com saldo (ex.: "Produto Teste Héfisto"), num local de estoque de teste.
   - Anote o saldo e os lotes antes.
   - Confirme a perda e depois confira:
     - **Estoque → Movimentar:** 1 movimento, motivo Perda, origem movimentação.
     - **Saldo** caiu exatamente a quantidade.
     - `intelligence_acoes`: 1 linha `executada`.
     - `intelligence_eventos`: pedido → proposta → confirmação → execução.
   - Reconfirme (botão de novo ou reenvio) e verifique que **não duplica**.
   - Desfaça pelo **estorno** (admin + PIN) na tela de estoque.
5. **Isolamento.** Com um usuário da unidade A, tente:
   - pedir a unidade B no cabeçalho, ou enviar `unidade_id`/`empresa_id` no corpo. Deve dar 403 ou ser ignorado.
   - Confira faturamento, compras, estoque, financeiro e histórico.
   - Qualquer número de B que aparecer é **CRÍTICO**: não publique.
6. **Anthropic** (se houver chave). Pergunte uma frase que as regras não entendem, por exemplo: "a carne que chegou semana passada veio cara demais?".
   - `intelligence_eventos.provedor_ia` deve ser preenchido.
   - Com "Quanto vendi hoje?", deve ficar vazio: as regras resolvem e o modelo não é chamado.
   - O modelo recebe só o texto e o módulo da tela. Nenhum dado do banco, credencial ou nome de entidade.

## 6. Metas e alertas

Em **Inteligência → Configurações**:
- Defina a meta mensal. A Central passa a mostrar a meta de hoje como **SUGESTÃO**, com o atingimento real ÷ meta.
- Alertas por categoria e sensibilidade são opcionais. O padrão funciona sem configurar.

## Testes locais

```bash
npm run test:intelligence
# migração, funções de acesso do repositório e perda contra o SQL real do estoque (PGlite):
npm i --no-save @electric-sql/pglite --prefix /tmp/pglite
PGLITE=/tmp/pglite/node_modules/@electric-sql/pglite npm run test:intelligence
```
