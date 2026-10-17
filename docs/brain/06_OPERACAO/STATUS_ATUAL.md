# Status atual

_Atualizado em 08/10/2026 pela sessão da Missão 000. O bloco "Agente autônomo" no fim é regenerado pelo runner._

## Em uma frase

O ERP está em produção (`app.hefisto.com.br`, deploy da `main` `c3d45cb`).
- O **Intelligence Core está pronto e validado no banco real, mas ainda não publicado**: PR #127 em rascunho.
- O deploy espera acesso para o smoke test e a aprovação do dono.

## Produção

| Item | Estado | Evidência |
|---|---|---|
| App em produção | Deploy `dpl_AqdMC…` (main `c3d45cb`, 07/10) | Vercel |
| Tabelas `intelligence_*` | Aplicadas (IC_01 v ic-01.2, impressão `d55eda66…`) | TESTADO NO SUPABASE REAL |
| Código do Intelligence Core | **Não publicado** (PR #127 draft) | — |
| Empresa/unidades | 1 empresa, 1 unidade (`seldeestrela`), 16 usuários ativos | TESTADO NO SUPABASE REAL |
| Dados para inteligência | Sem faturamento lançado, sem compras em 90 dias, 1 contagem aberta, 5 contas vencidas (R$ 7.930,98), 653 etiquetas ativas vencidas | TESTADO NO SUPABASE REAL |

## Branch de trabalho

`claude/fervent-bell-t363k5` → PR #127 (rascunho). Contém:
- Intelligence Core (HI-01);
- IC-1P;
- HI-02 (fallback de contexto, correções com dado real, evidências);
- fix de permissões de eventos;
- Missão 000 (este sistema);
- `main` de 08/10 trazida (estoque: unidades, embalagens, entrada/retirada);
- política de publicação e banco ([[HDEV-PUBLISH-001]], DONE).

**08/10 (noite, sessão acompanhada):**
- O runner passou a ter **AUTO SAFE / APPROVAL REQUIRED** ([[POLITICA_PUBLICACAO]]):
  - o push do preview só sai com testes, build e varredura de segredo verdes;
  - migração e produção viram pedido em [[APROVACOES_PENDENTES]] (0 pendentes agora).
- Testes: `test:intelligence` 130/130 com PGLITE; `test:agent` 56/56; build OK.
- **Segurança ([[HDEV-SEC-001]]):**
  - 121 tabelas com RLS aberto no banco real;
  - fase 1 **aplicada no banco real em 08/10** (88 tabelas isoladas por unidade; APR-001), verificada com usuários reais;
  - a fase 2 ([[HDEV-SEC-002]]: 33 tabelas, CPF/salário, `pode_ver_todas`, `token_nfe`) está pronta e testada e aguarda a **APR-002**;
  - a trava contra regressão já está ativa (`test:seguranca` em toda rodada e `AUDITORIA_RLS.sql`).

Preview do Vercel: READY.

## 17/10/2026 — Marmitaria e Eventos (pedido do dono)

Branch `claude/sharp-meitner-0i36gu` (PR em rascunho):
- **Eventos:** módulo em três áreas (Funil, Agenda, Reservas); funil sem caixa de altura fixa, etapas vazias recolhidas, lista por etapa no celular; reservas com busca, confirmar e cancelar.
- **Banco:** `eventos` não tem as colunas do orçamento (B-019). A tela avisa e a Agenda volta a mostrar os eventos; o orçamento só passa a gravar com a **APR-012** (migração aditiva `EVENTOS_ORC_1`, TESTADO LOCAL no PGlite, NÃO APLICADA).
- **Marmitaria:** primeiros passos no topo da visão geral, lista de marmitas legível em 390 px, marmita fora do cardápio de volta (B-020, B-021).
- Evidência: TESTADO EM MOCK (Playwright 390/1366 px com Supabase falso), TESTADO LOCAL (app/lib 530/531; a falha é a trava de RLS dos SQLs da Experience, já vermelha antes), build OK. Preview e produção: NÃO VALIDADO.
- **Rodada 2 (Estoque, Financeiro, painel):** Financeiro com barra de áreas (Visão geral, A pagar, A receber, Caixa, DRE, Pizza, CMV); `/fluxo`, `/documentos` e `/margem` redirecionam (gravavam/liam tabelas fora do financeiro novo, B-024); CMV sem 0% inventado (B-023); Contas a Pagar em cartões no celular; Pizza do Lucro visível no celular; paleta sem fundo preto no Estoque e no Financeiro; abas do Estoque à vista no celular; painel inicial com faturamento vazio compacto. Simulador com o **esquema e o volume reais** (369 produtos, 374 saldos, 350 movimentos; leitura só). Mesmo resultado de testes; build OK.

## Validação por camada

| Camada | Estado |
|---|---|
| Testes locais | 130 Intelligence + 262 app/lib + 15 agente + catálogo: TESTADO LOCAL |
| Build | OK. TESTADO LOCAL; preview READY no Vercel |
| Supabase real | Migração, porta, 10 perguntas, brief, perda, idempotência, auditoria, isolamento: TESTADO NO SUPABASE REAL |
| Preview autenticado | NÃO VALIDADO (BLQ-001/002/003) |
| Produção | NÃO VALIDADO (BLQ-004) |

## Riscos abertos

Segurança crítica anterior ao Intelligence Core: S-01 e S-02 em [[SEGURANCA]]. Correção em [[HDEV-008]], aguardando aprovação.

## Próximo

[[HDEV-001]] (BLOCKED, 08/10 noite): smoke de API pronto (`npm run qa:smoke`, TESTADO EM MOCK) e checklist de deploy com rollback. Falta o harness Playwright e trazer a `main`: o runner local nega comandos com rede (BLQ-007). O smoke real roda assim que BLQ-001/003 saírem.

<!-- hefisto-agent:agente:inicio -->
### Agente autônomo (gerado pelo runner)
- Estado: **AGUARDANDO** · início: 2026-10-09T15:36:36.690Z · último heartbeat: 2026-10-09T23:48:27.424Z
- Missão atual: nenhuma · último checkpoint: `411642794b`
- Último resultado: nenhuma missão READY; confere de novo
- Próxima missão READY: nenhuma
<!-- hefisto-agent:agente:fim -->
