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
_Gerado por `npm run hefisto:missoes` em 2026-10-09 00:18 UTC. Edite as missões em `missoes/`, não esta tabela._

**Próxima automática:** nenhuma missão READY sem bloqueio

### Em andamento / prontas / validando
| id | título | status | prioridade | depende de | bloqueadores | rodadas |
|---|---|---|---|---|---|---|
| [[HDEV-001]] | Concluir HEFISTO INTELLIGENCE HI-02 no ambiente mais real disponível | IN_PROGRESS | 1 | – | BLQ-001, BLQ-002, BLQ-003, BLQ-004, BLQ-007 | 0 |

### Bloqueadas
| id | título | status | prioridade | depende de | bloqueadores | rodadas |
|---|---|---|---|---|---|---|
| [[HDEV-SEC-001]] | Eliminar policies inseguras de RLS, validar isolamento entre empresas e impedir regressão | BLOCKED | 1 | – | BLQ-008 | 0 |

### Concluídas
| id | título | status | prioridade | depende de | bloqueadores | rodadas |
|---|---|---|---|---|---|---|
| [[HDEV-000]] | Missão 000 — sistema autônomo de desenvolvimento | DONE | 1 | – | – | 1 |
| [[HDEV-PUBLISH-001]] | Política de publicação e banco (AUTO SAFE / APPROVAL REQUIRED) no agente autônomo | DONE | 1 | – | – | 0 |
<!-- hefisto-agent:indice:fim -->
