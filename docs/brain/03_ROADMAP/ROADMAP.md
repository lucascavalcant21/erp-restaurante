# Roadmap

Uma linha única de evolução. Cada fase usa o que a anterior deixou; nada de sistemas paralelos.

| Fase | Nome | Entrega | Situação |
|---|---|---|---|
| HI-01 | Intelligence Core | Contexto, métricas determinísticas, agentes, brief, conversa, ação confirmada (perda), auditoria | Código pronto (PR #127). TESTADO LOCAL e TESTADO NO SUPABASE REAL |
| HI-02 | Produção real | Migração aplicada, validação com dado real, deploy e smoke autenticado | Migração e validação real feitas; **deploy pendente** ([[HDEV-001]]) |
| HI-03 | Real × Esperado | CMV real × teórico, estoque esperado × contado, conciliação financeira | [[HDEV-002]], [[HDEV-003]] |
| HI-04 | Forecast e decisão | Projeções com intervalo; simulação "e se" | [[HDEV-004]], [[HDEV-005]] |
| HI-05 | Autonomia | Proatividade: o Héfisto avisa e propõe antes do problema; rotinas | [[HDEV-006]] |
| HI-06 | Voz / WhatsApp / mobile | Consulta e comando por voz e WhatsApp oficial; **WhatsApp Command Channel** para o desenvolvimento | [[HDEV-007]] |
| HI-07 | Criação e operação assistida de empresas | Nova unidade/empresa montada e acompanhada pelo Héfisto | Futuro |

Segurança corre em paralelo e tem prioridade quando o dono aprovar: [[HDEV-008]].

## HI-06: WhatsApp Command Channel (arquitetura combinada)

```
WhatsApp (Meta Business Platform oficial)
  → webhook seguro (assinatura X-Hub-Signature-256 obrigatória, sem padrão no código)
  → Command Gateway (normaliza, deduplica por message_id, limita taxa)
  → autenticação do proprietário (número cadastrado + vínculo com usuarios_erp + segundo fator para comandos críticos)
  → fila de comandos/missões (ex.: "Como está o desenvolvimento?" lê STATUS_ATUAL;
     "Continue." libera a próxima missão; "Depois faça X." cria missão em BACKLOG;
     "Pare o deploy." cria STOP)
  → agente (runner) / Intelligence Core
  → resposta curta no WhatsApp + registro em 07_RELATORIOS
```

- **Proibido:** WhatsApp Web, scraping ou bibliotecas não oficiais.
- Comando crítico pelo WhatsApp (deploy, banco, dinheiro) sempre pede confirmação explícita.
