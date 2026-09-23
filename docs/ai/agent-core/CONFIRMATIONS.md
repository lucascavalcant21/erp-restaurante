# Motor de Confirmações & Ciclo de Vida — Héfisto Agent Core (Fase 2C)

## Ciclo de Vida da Confirmação
Cada confirmação transita estritamente pelos seguintes estados:

```
[ PENDING ] ──(Usuário clica Confirmar)──> [ CONFIRMED ] ──(Execução OK)──> [ EXECUTED ]
     │                                           │
     ├──(Expirou > 10 min)──> [ EXPIRED ]       └──(Erro na Domain Action)──> [ FAILED ]
     │
     └──(Usuário clica Cancelar)──> [ CANCELLED ]
```

## Estrutura do Registro `agent_confirmations`
- `confirmation_id` (UUID)
- `conversation_id`
- `agent_run_id`
- `tool_call_id`
- `tool`
- `user_id`
- `empresa_id`
- `unidade_id`
- `risk_level` (`MEDIUM` / `HIGH`)
- `input_sanitizado` (JSONB)
- `preview` (JSONB)
- `status` (`PENDING`, `CONFIRMED`, `CANCELLED`, `EXPIRED`, `EXECUTED`, `FAILED`)
- `created_at`
- `expires_at` (10 minutos padrão)
- `idempotency_key` (Chave Única)

## Regra de Segurança do Frontend
Ao clicar em `[Confirmar]`, o cliente envia **SOMENTE** a `confirmation_id`.
O servidor busca a confirmação armazenada no banco e utiliza o `input_sanitizado` original gravado durante o Dry Run. Quantidades, valores e parâmetros reenviados pelo cliente são **estritamente ignorados**.
