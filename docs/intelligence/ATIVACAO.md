# Héfisto Intelligence Core — como ativar

O código já está no ERP. Sem os passos abaixo, a Central de Inteligência e a conversa funcionam só para leitura, as ações ficam bloqueadas e a auditoria não é persistida.

## 1. Banco (dono do projeto Supabase)

1. Aplicar `db/intelligence/IC_01_INTELLIGENCE_CORE.sql` no SQL Editor. A migração é aditiva: só cria tabelas `intelligence_*` e não altera nenhuma tabela existente.
   - Ela termina com verificações. Se alguma falhar, o script aborta.
   - Desfazer: `db/intelligence/IC_01_ROLLBACK.sql`. Isso apaga o histórico de auditoria da inteligência.
2. Conferir `public.hefisto_user_can` e `public.hefisto_user_in_unit`. A migração usa essas funções e não as altera.
3. Sem a migração aplicada:
   - `/api/intelligence/ask` continua respondendo perguntas;
   - registrar perda falha com 503 (auditoria indisponível). Isso é proposital: nenhuma ação é executada sem auditoria.

## 2. Variáveis de ambiente (servidor)

| Variável | Para quê | Sem ela |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Persistir auditoria, ações, feedback e preferências nas tabelas `intelligence_*`. Só o store usa; leituras de negócio vão sempre com o token do usuário (RLS). | Ações bloqueadas (503); a Central avisa "auditoria não persistida". |
| `ANTHROPIC_API_KEY` | Interpretar pedidos que o interpretador por regras não entendeu com certeza. O modelo recebe só o texto do pedido, nunca dados do banco. | Só o interpretador por regras (as 10 perguntas e o registro de perda funcionam por regras). |
| `HEFISTO_IA_MODELO` | Opcional. Troca o modelo. | Usa o padrão de `providers/anthropic.mjs`. |
| `HEFISTO_IA_DESLIGADA=1` | Opcional. Desliga o modelo mesmo com chave. | — |

## 3. Permissões

- Nova permissão: `dashboard.intelligence.view` (Central de Inteligência).
  - Usuários gerenciados precisam recebê-la no cadastro de acesso.
  - O servidor também confirma no banco (`hefisto_user_can`), cuja definição não está neste repositório. Um super admin ou perfil com coringa deve passar, mas isso **não foi validado** contra o banco real.
- Cada métrica exige, além disso, a permissão do módulo de origem (`app/lib/intelligence/permissions/mapa.mjs`). Quem não pode ver contas a pagar não recebe contas a pagar pela inteligência.
- Registrar perda exige a mesma permissão da tela de estoque e usa a mesma função do banco (`estoque_movimentar`).

## 4. Dados que cada resposta precisa

| Pergunta | Fonte | Sem dados |
|---|---|---|
| Vendas / faturamento | `fin_faturamento_diario` (lançamento diário) | DADOS INSUFICIENTES |
| Compras / preços | `vw_compras` confirmadas + `compras_itens` | DADOS INSUFICIENTES |
| Vencimentos | `estoque_lotes` + `etiquetas` | lista vazia com cobertura indicada |
| Divergências | última contagem fechada (`estoque_contagens*`) + saldos/lotes | DADOS INSUFICIENTES |
| Contas a vencer | `vw_fin_contas_pagar` | DADOS INSUFICIENTES |
| CMV | inventários fechados + compras + faturamento (motor `cmv-real`) | DADOS INSUFICIENTES com o motivo |
| CMO | `colaboradores` + `rh_recibos_prestacao` (motor `cmo`) + faturamento | DADOS INSUFICIENTES com o motivo |

## 5. Testes

```bash
npm run test:intelligence
# migração em Postgres de verdade (PGlite):
npm i --no-save @electric-sql/pglite --prefix /tmp/pglite
PGLITE=/tmp/pglite/node_modules/@electric-sql/pglite npm run test:intelligence
```
