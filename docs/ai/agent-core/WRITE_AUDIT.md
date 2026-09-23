# Trilha de Auditoria Imutável — Héfisto Agent Core (Fase 2C)

## Rastreabilidade Total
A tabela `agent_write_audit_log` armazena o registro imutável de todas as ferramentas WRITE executadas com sucesso ou falha no sistema.

## Campos Auditados
- `audit_id` (UUID)
- `confirmation_id`
- `conversation_id`
- `agent_run_id`
- `tool_call_id`
- `tool`
- `input_payload`
- `preview_snapshot`
- `risk_level`
- `requested_by` (ID do usuário solicitante)
- `confirmed_by` (ID do usuário confirmador)
- `empresa_id`
- `unidade_id`
- `created_at`
- `executed_at`
- `idempotency_key`
- `generated_record_id` (ID da movimentação de estoque ou reserva criada)
- `execution_result`
- `reversal_strategy`

## Exemplo de Investigação
Permite responder diretamente a auditorias operacionais:
- *"Quem adicionou 15 kg de picanha às 14:32 no dia 17/09?"*
- *"Qual foi a mensagem original do usuário que gerou a reserva res-101?"*
