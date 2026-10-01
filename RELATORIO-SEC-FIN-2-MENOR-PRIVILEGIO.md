# SEC-FIN-2 — MENOR PRIVILÉGIO NOS OBJETOS DA F2.3

Data: 2026-10-01 · Branch `fase-f2-3/contas-receber`. **Nada executado em produção.**

## Conclusão

- **Não há brecha entre unidades.** RLS e policies por unidade estão corretos, e esta correção não os toca.
- **Há privilégios desnecessários** (GRANT, não RLS), deixados pelo padrão do Supabase, que concede ALL ao `authenticated` em todo objeto novo. A F2.1 retirou só parte.
- **Os privilégios extras das views não produzem escrita.** Mesmo assim saem, pelo princípio do menor privilégio.
- **Duas permissões nas tabelas eram reais e mais largas que o necessário:**
  - `UPDATE` em **todas** as colunas: a API permitia, por exemplo, mudar o `saldo_inicial` de uma conta financeira, ou a origem e a chave de idempotência de um recebível;
  - `REFERENCES`/`TRIGGER`.

## 1. Reprodução fiel de produção

O teste local reproduz o **mecanismo**, não só o resultado:
1. `alter default privileges … grant all on tables to authenticated` e `… on functions to anon, authenticated`, como o Supabase faz;
2. a F2.1 roda por cima, com os revokes dela.

O resultado do bloco 04 da auditoria local é **idêntico, campo a campo,** ao que você colou de produção (verificado no teste, item "reproduz EXATAMENTE").

## 2. Os privilégios extras das views permitem escrita? (testado com os grants de produção)

| Tentativa como `authenticated` | Resultado | Por quê |
|---|---|---|
| INSERT/UPDATE/DELETE em `vw_fin_contas_receber` | Falha | View com CTE e junção não é atualizável |
| TRUNCATE em `vw_fin_fluxo_caixa` | Falha | View com UNION; TRUNCATE não se aplica a view |
| DELETE pela `vw_fin_saldo_contas_financeiras` | Falha | É atualizável, mas com `security_invoker` vale o privilégio do usuário na tabela, e ele não tem DELETE |
| Outra unidade alterando conta financeira pela view | 0 linhas / negado | RLS por unidade |
| Criar trigger usando `TRIGGER` | Não pela API | O app fala com o banco pelo PostgREST, que não executa DDL |
| **UPDATE direto de `saldo_inicial` na tabela (própria unidade)** | **Funcionava** | `UPDATE` concedido em todas as colunas. A tela não deixa, o banco deixava |

## 3. Matriz ANTES → DEPOIS (`authenticated`; `anon` e `PUBLIC` = nada antes e depois)

| Objeto | ANTES (produção, 01/10) | DEPOIS (SEC-FIN-2) | Por quê |
|---|---|---|---|
| `vw_fin_contas_receber` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE | **SELECT** | A tela só lê |
| `vw_fin_fluxo_caixa` | idem | **SELECT** | Só lê |
| `vw_fin_saldo_contas_financeiras` | idem | **SELECT** | Só lê |
| `fin_recebimentos` | REFERENCES, SELECT, TRIGGER | **SELECT** | Gravação só pelas RPCs (`definer`, não dependem destes grants) |
| `fin_contas_receber` | INSERT, REFERENCES, SELECT, TRIGGER, UPDATE (todas as colunas) | **SELECT, INSERT, UPDATE em 17 colunas** | Detalhe abaixo |
| `fin_contas_financeiras` | INSERT, REFERENCES, SELECT, TRIGGER, UPDATE (todas) | **SELECT, INSERT, UPDATE(nome, ativa)** | Saldo inicial e data deixam de ser alteráveis pela API |
| `fin_taxas_meio_pagamento` | INSERT, REFERENCES, SELECT, TRIGGER, UPDATE (todas) | **SELECT, INSERT, UPDATE(ativa, vigente_ate)** | Taxa cadastrada não é reescrita; encerra-se a vigência |

**`fin_contas_receber`:**
- **As 17 colunas que continuam alteráveis** (exatamente as que a tela edita ou cancela): `descricao, adquirente, bandeira, nsu, autorizacao, observacao, conta_financeira_prevista_id, data_venda, data_prevista, valor_bruto, valor_taxa_previsto, taxa_regra_id, taxa_percentual_prevista, taxa_fixa_prevista, status, cancelado_em, motivo_cancelamento`.
- **Deixam de ser alteráveis pela API:** `unidade_id, origem_tipo, origem_id, venda_id, meio, modalidade, parcela_numero, parcelas_total, chave_idempotencia` e os campos de auditoria (estes já eram protegidos pelo trigger).

**Não muda:**
- policies e RLS;
- funções e RPCs;
- `service_role` (rotas de servidor);
- dados;
- `contas_pagar` e a F2.2.

## 4. Arquivos

| Arquivo | O quê |
|---|---|
| `db/security/SEC_FIN_2_PREVIA_MENOR_PRIVILEGIO.sql` | **Prévia, só leitura**, um resultado. Para cada objeto e papel: HOJE, DEPOIS, MUDA / sem mudança; as 4 policies (que não mudam); informativo das funções `fin_*`/`estoque_*` que o anon executa |
| `db/security/SEC_FIN_2_MENOR_PRIVILEGIO_F23.sql` | **Correção**, numa transação. Aborta sem mudar nada se faltar objeto ou policy por unidade. Faz backup dos grants atuais em `sec_backup_privilegios_sec_fin_2` (ilegível pelo app). **Rollback** comentado no fim, que volta exatamente ao estado de 01/10 |
| `scripts/test_sec_fin_2_menor_privilegio.mjs` | 24 verificações (§5) |
| `app/lib/teste-banco-f21.mjs` | Apoio de teste agora reproduz os padrões do Supabase; opção `secFin2` |
| `app/lib/contas-receber.test.mjs` | Roda nos dois estados (`SEC_FIN_2=1` aplica a correção) |

## 5. Testes

`scripts/test_sec_fin_2_menor_privilegio.mjs` → **24/24**:
- **Reprodução:** o banco local = privilégios de produção (bloco 04) e o perfil das RPCs.
- **Prévia:** os 7 objetos marcados MUDA para `authenticated`; anon e PUBLIC sem mudança; as 4 policies listadas; não altera nada.
- **Correção:**
  - estado final exatamente o da matriz;
  - UPDATE por coluna conferido (17 / 2 / 2 / nenhum em recebimentos);
  - policies idênticas antes e depois;
  - prévia passa a dizer "sem mudança";
  - backup com 39 grants e ilegível pelo app.
- **Repetição:** rodar de novo não muda nada.
- **Rollback:** volta exatamente ao estado de produção.
- **Conferência inicial:** sem as policies por unidade, aborta e nada muda.

**Comprovação de que a F2.3 continua funcionando depois:** `SEC_FIN_2=1 node app/lib/contas-receber.test.mjs` → **75/75**, com a correção aplicada. Cobre:
- criar, receber (parcial e total), estornar, cancelar;
- **edição completa**, alterando as 14 colunas editáveis de uma vez;
- renomear e desativar conta financeira;
- cadastrar e encerrar taxa;
- retry, duplo clique, isolamento;
- e "`saldo_inicial` não é mais alterável pela API".

Sem a correção (estado de produção hoje), a mesma suíte também dá 75/75.

**Outros resultados:**
- **Contas a Pagar:** 74/74.
- **Suíte:** 39/40. A falha é a de navegação, que já existia.

## 6. O que fica fora (observado, não alterado)

- **Mesmo padrão em outros objetos.** Os demais objetos da F2.1 provavelmente têm o mesmo padrão: `vw_fin_contas_pagar` e `vw_compras` com ALL; `fin_pagamentos`, `compras`, `estoque_*` com REFERENCES/TRIGGER. São da F2.2 / próximas fases e você pediu para não mexer agora. Uma SEC-FIN-3 pode estender isto a eles e a `contas_pagar` (DELETE/TRUNCATE, já pendente).
- **Objetos futuros.** Continuarão nascendo com ALL para `authenticated`, enquanto o padrão do Supabase não for ajustado. A SEC-DADOS-3 ajustou só o anon. Sugestão: `alter default privileges … revoke all on tables from authenticated` numa etapa própria. Exige que toda migration futura conceda explicitamente o que precisa.
- **Funções que o anon executa:** são só funções de trigger (não podem ser chamadas direto) e as puras `fin_hoje` e `estoque_custo_medio_novo` (sem acesso a dados). A prévia mostra a lista real de produção.
- **O que grant não resolve:**
  - `status` e `valor_bruto` de `fin_contas_receber` continuam alteráveis pela API, porque a tela precisa deles para cancelar e editar;
  - fechar isso exige a RPC de cancelamento e o trigger de integridade propostos no relatório da F2.3 (§1, item 3).

**Parado aqui para sua aprovação.** Ordem sugerida:
1. Rodar a prévia em produção e me devolver o resultado.
2. Aprovar e rodar a correção.
3. Rodar a prévia de novo, que deve dizer "sem mudança" em tudo.
4. Publicar a F2.3.
