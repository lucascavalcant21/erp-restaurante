# Missões ativas

A fila do agente autônomo. Cada missão é um arquivo em `missoes/`. A tabela abaixo é regenerada por `npm run hefisto:missoes` e pelo runner.

**Regra da fila:** quando uma missão termina, o agente:
1. registra o resultado e as evidências;
2. atualiza [[STATUS_ATUAL]];
3. registra bugs ([[BUGS]]) e decisões ([[DECISOES_ARQUITETURAIS]]);
4. pega a próxima missão READY, a de maior prioridade com dependências DONE e sem bloqueador;
5. começa sozinho.

Ele não espera um prompt novo se existe missão READY e não há bloqueio crítico.

**Estados:**
- BACKLOG: ainda não liberada;
- READY: pode começar;
- IN_PROGRESS;
- BLOCKED: precisa de algo externo, ver [[BLOQUEADORES]];
- VALIDATING;
- DONE;
- FAILED.

**Para liberar uma missão do backlog:** `npm run hefisto:missoes -- pronta HDEV-00X`.

<!-- hefisto-agent:indice:inicio -->
_Gerado por `npm run hefisto:missoes` em 2026-10-27 23:34 UTC. Edite as missões em `missoes/`, não esta tabela._

**Próxima automática:** nenhuma missão READY sem bloqueio

### Em andamento / prontas / validando
| id | título | status | prioridade | depende de | bloqueadores | rodadas |
|---|---|---|---|---|---|---|
| [[HDEV-001]] | Concluir HEFISTO INTELLIGENCE HI-02 no ambiente mais real disponível | IN_PROGRESS | 1 | – | BLQ-001, BLQ-002, BLQ-003, BLQ-004, BLQ-007 | 0 |
| [[HDEV-EST-001]] | Estoque — reconstrução e unificação (tela única, unidades, painel) | VALIDATING | 1 | – | aprovacao-merge, aprovacao-EST_UNI_1 | 1 |
| [[HDEV-RH-001]] | Reestruturação do RH, contratos e ciclo de vida do colaborador | IN_PROGRESS | 1 | – | – | 0 |
| [[HEXP-001]] | Héfisto Experience — O Restaurante na Palma da Mão | IN_PROGRESS | 1 | – | – | 1 |

### Bloqueadas
| id | título | status | prioridade | depende de | bloqueadores | rodadas |
|---|---|---|---|---|---|---|
| [[HDEV-SEC-001]] | Eliminar policies inseguras de RLS, validar isolamento entre empresas e impedir regressão | BLOCKED | 1 | – | BLQ-008 | 0 |
| [[HDEV-SEC-002]] | Segurança fase 2 — fechar as 33 tabelas restantes, dados sensíveis, pode_ver_todas e dados legados | BLOCKED | 1 | HDEV-SEC-001 | BLQ-009 | 0 |
| [[HDEV-WA-COEX-001]] | WhatsApp do Héfisto em +55 45 98812-5320 (coexistência com o WhatsApp Business App via YCloud) | BLOCKED | 1 | HDEV-WA-001 | BLQ-012 | 0 |
| [[HDEV-WA-REAL-001]] | WhatsApp com número real (sair do número de teste da Meta) | BLOCKED | 1 | HDEV-WA-001 | BLQ-011 | 0 |

### Concluídas
| id | título | status | prioridade | depende de | bloqueadores | rodadas |
|---|---|---|---|---|---|---|
| [[HDEV-000]] | Missão 000 — sistema autônomo de desenvolvimento | DONE | 1 | – | – | 1 |
| [[HDEV-PUBLISH-001]] | Política de publicação e banco (AUTO SAFE / APPROVAL REQUIRED) no agente autônomo | DONE | 1 | – | – | 0 |
| [[HDEV-WA-001]] | WhatsApp Command Channel (texto) — comandar o Héfisto e o agente pelo WhatsApp | DONE | 1 | – | – | 0 |
<!-- hefisto-agent:indice:fim -->
