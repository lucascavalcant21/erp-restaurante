# 06 — Implementation Order & Phased Roadmap

> **Status:** Plano Estratégico de Implementação Técnica Futura  
> **Sistema:** Cerebro ERP (FoodERP) / Hefisto AI Core  
> **Premissa:** Cada fase constrói fundações sólidas sobre a anterior, eliminando retrabalho e riscos operacionais.

---

## 1. Matriz de Dependências Sequenciais

`mermaid
flowchart TD
    F1[1. Domain Actions] --> F2[2. Tool Registry Spec & Engine]
    F2 --> F3[3. Tools READ]
    F3 --> F4[4. Agent Core Baseline]
    F4 --> F5[5. Chat Interno UI - Heitor]
    F5 --> F6[6. Human Confirmation Gate]
    F6 --> F7[7. Tools WRITE]
    F7 --> F8[8. Agent Audit & Observability]
    F8 --> F9[9. Event Bus / Outbox]
    F9 --> F10[10. State Machines]
    F10 --> F11[11. Workflow Engine]
    F11 --> F12[12. WhatsApp Adapter]
    F12 --> F13[13. Instagram Direct Adapter]
    F13 --> F14[14. Auditoria Visual & Imagens]
    F14 --> F15[15. Agentes Especializados]
`

---

## 2. Detalhamento das 15 Fases de Implementação

### Fase 1: Domain Actions (Ações de Domínio Puras)
- **Objetivo:** Refatorar as funções existentes em pp/lib/* para que sejam funções puras de backend/serviço, desacopladas de estados de tela e com tratamento de erro padronizado ({ success, data, error }).
- **Dependência:** Nenhuma.
- **Entregáveis:** Serviços de estoque, financeiro, vendas, compras e RH com assinaturas previsíveis.

### Fase 2: Tool Registry (Catálogo & Validação de Contratos)
- **Objetivo:** Implementar o runtime do Tool Registry TypeScript com validação de schemas de entrada/saída e integração com pp/lib/server/autorizacao.mjs.
- **Dependência:** Fase 1.
- **Entregáveis:** Registro centralizado de ferramentas, validação Zod e checagem de permissão.

### Fase 3: Tools READ (Ferramentas de Consulta)
- **Objetivo:** Conectar as Tools de leitura (risco LOW, sem confirmação) ao Registry.
- **Dependência:** Fases 1 e 2.
- **Entregáveis:** Consultas de saldo de estoque, DRE financeiro, fichas técnicas, escala de RH e relatórios.

### Fase 4: Agent Core Baseline (Motor de Raciocínio)
- **Objetivo:** Construir o pipeline de execução: NormalizedMessage -> RequestContext -> LLM -> Tool Calling -> Resposta.
- **Dependência:** Fases 2 e 3.
- **Entregáveis:** Orquestrador do agente com controle de loops, timeouts e isolamento multi-tenant.

### Fase 5: Chat Interno (Hefisto Web Assistant)
- **Objetivo:** Conectar o Agent Core à interface web do ERP (painel /dashboard/ia/heitor).
- **Dependência:** Fase 4.
- **Entregáveis:** Interface conversacional interna permitindo que gerentes façam perguntas sobre o restaurante.

### Fase 6: Human Confirmation Gate (Confirmação Interativa)
- **Objetivo:** Criar o mecanismo de pausa e aprovação para operações críticas antes da execução.
- **Dependência:** Fase 5.
- **Entregáveis:** Componente visual de confirmação na UI e token de aprovação temporal.

### Fase 7: Tools WRITE (Ferramentas de Mutação Operacional)
- **Objetivo:** Conectar ao Registry as Tools que alteram dados (entradas/saídas de estoque, pagamentos, cadastro de clientes).
- **Dependência:** Fases 2, 4 e 6.
- **Entregáveis:** Escrita controlada com travas de segurança e idempotência.

### Fase 8: Agent Audit & Observability
- **Objetivo:** Consolidar a gravação de auditoria em hefisto_auditoria com histórico de valores anteriores e novos.
- **Dependência:** Fases 4 e 7.
- **Entregáveis:** Dashboard de auditoria e trilha forense de ações de IA.

### Fase 9: Event Bus (Barramento de Eventos Assíncronos)
- **Objetivo:** Implementar padrão de mensageria interna (Outbox Pattern / Supabase Realtime) para disparo de eventos operacionais.
- **Dependência:** Fase 8.
- **Entregáveis:** Eventos como ESTOQUE_BAIXO, CONTA_VENCENDO, RESERVA_CRIADA.

### Fase 10: State Machines (Máquinas de Estado Determinísticas)
- **Objetivo:** Formalizar máquinas de estado para pedidos de mesa, comandas, entregas delivery e aprovações financeiras.
- **Dependência:** Fase 9.
- **Entregáveis:** Transições de status blindadas contra inconsistências lógicas.

### Fase 11: Workflow Engine (Automações Multi-Etapas)
- **Objetivo:** Motor de orquestração de processos complexos que envolvem múltiplos passos e esperas temporais (ex: rotina de abertura da casa).
- **Dependência:** Fases 9 e 10.
- **Entregáveis:** Execução de rotinas programadas e cron jobs orientados a eventos.

### Fase 12: WhatsApp Adapter (Canal WhatsApp)
- **Objetivo:** Conectar o canal WhatsApp ao Agent Core com suporte a áudio (voz) e mensagens de texto.
- **Dependência:** Fases 4, 6, 7 e 8.
- **Entregáveis:** Atendimento operacional via WhatsApp para donos e gerentes da loja.

### Fase 13: Instagram Direct Adapter (Canal Instagram)
- **Objetivo:** Conectar o canal Instagram Direct para atendimento a clientes (dúvidas de cardápio, reservas).
- **Dependência:** Fase 12.
- **Entregáveis:** Atendimento público externo automatizado.

### Fase 14: Auditoria Visual & Imagens (Multimodal AI)
- **Objetivo:** Conectar o fluxo de fotos de rotinas operacionais (op_evidencias) ao modelo multimodal e gerar pendências na Central Operacional.
- **Dependência:** Fases 8, 11 e 12.
- **Entregáveis:** Triagem visual automática de limpeza e montagem de praça com validação humana.

### Fase 15: Agentes Especializados (Multi-Agent Swarm)
- **Objetivo:** Criar personas de agentes focados com ferramentas dedicadas:
  - *EstoqueBot:* Focado em perdas, CMV e compras.
  - *ConciergeBot:* Focado em reservas e atendimento a clientes no WhatsApp.
  - *AuditorBot:* Focado em conformidade de checklists e ponto eletrônico.
- **Dependência:** Fases 1 a 14.
- **Entregáveis:** Roteamento inteligente de intenções para agentes especialistas.
