# Garantia de Idempotência — Héfisto Agent Core (Fase 2C)

## Princípio Fundamental
Toda ferramenta WRITE executada pelo Héfisto Agent Core possui garantia de execução exatamente única (*exactly-once execution*).

## Mecanismo de Trava Atômica
1. **Chave Única**: Na criação da prévia, uma `idempotency_key` única é associada ao registro de confirmação.
2. **Trava de Estado**: A transição do status de `PENDING` para `CONFIRMED` ocorre por atualização atômica (`UPDATE agent_confirmations SET status = 'CONFIRMED' WHERE confirmation_id = $1 AND status = 'PENDING'`).
3. **Prevenção de Duplo Clique**: Se duas requisições simultâneas ou cliques múltiplos chegarem ao servidor, apenas a primeira transição obtém sucesso; as subsequentes retornam `alreadyExecuted: true` sem reinvocar a Domain Action.
