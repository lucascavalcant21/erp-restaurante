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
- Missão 000 (este sistema).

Preview do Vercel: READY.

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

[[HDEV-001]] (READY): harness de QA, smoke e checklist de deploy agora; o smoke real assim que os acessos chegarem.

<!-- hefisto-agent:agente:inicio -->
### Agente autônomo (gerado pelo runner)
- Estado: **RODANDO** · início: 2026-10-08T16:17:34.259Z · último heartbeat: 2026-10-08T16:18:08.535Z
- Missão atual: nenhuma · último checkpoint: `f10d60162a`
- Último resultado: HDEV-001 → BLOCKED: 2 rodadas sem progresso (sem commit nem mudança de estado)
- Próxima missão READY: nenhuma
<!-- hefisto-agent:agente:fim -->
