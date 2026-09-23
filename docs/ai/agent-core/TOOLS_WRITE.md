# Catálogo de Ferramentas WRITE — Héfisto Agent Core (Fase 2C)

## Visão Geral
Este documento define as ferramentas de escrita (WRITE) habilitadas para o Héfisto Agent Core.

> [!IMPORTANT]
> O modelo de linguagem NUNCA executa mutações diretamente. O fluxo exige obrigatoriamente:
> **Modelo** ➔ **Dry Run (Prévia)** ➔ **Confirmação Humana** ➔ **Domain Action** ➔ **Auditoria Imutável**.

---

## Estrutura Obrigatória da Ferramenta WRITE
Todas as ferramentas registradas no catálogo `WRITE_TOOL_CATALOG` devem obrigatoriamente declarar:
- `readOnly: false`
- `riskLevel`: `MEDIUM` ou `HIGH`
- `requiresConfirmation: true`
- `idempotencyRequired: true`
- `supportsDryRun: true`
- `requiredPermissions`: Array de permissões RBAC exigidas
- `inputSchema`: Schema JSON de parâmetros de entrada
- `outputSchema`: Schema JSON de retorno
- `handler`: Função geradora de prévia e payload sanitizado
- `reversalStrategy`: Estratégia de compensação ou desfazimento

---

## Catálogo de Ferramentas WRITE Habilitadas

### 1. `estoque.registrar_entrada`
- **Descrição**: Registra a entrada de insumo/produto no estoque da unidade.
- **Risco**: `MEDIUM`
- **Permissão Exigida**: `estoque.overview.adjust_stock`
- **Estratégia de Reversão**: `movimentacao_compensatoria_saida`
- **Exemplo de Chamada**: "Adicione 15 kg de picanha por R$ 79,90 o kg."

### 2. `reservas.criar`
- **Descrição**: Cria uma nova reserva de mesa no salão.
- **Risco**: `MEDIUM`
- **Permissão Exigida**: `salao.tables.view`
- **Estratégia de Reversão**: `cancelar_reserva_e_liberar_mesa`
- **Exemplo de Chamada**: "Reserve para Mariana amanhã às 20h para 4 pessoas."

### 3. `reservas.alterar`
- **Descrição**: Altera horário, data ou quantidade de pessoas de uma reserva existente.
- **Risco**: `MEDIUM`
- **Permissão Exigida**: `salao.tables.view`
- **Estratégia de Reversão**: `restaurar_dados_reserva_anteriores`
- **Exemplo de Chamada**: "Alterar reserva res-101 para 6 pessoas."

### 4. `reservas.cancelar`
- **Descrição**: Cancela uma reserva existente e libera a mesa/vaga no salão.
- **Risco**: `HIGH`
- **Permissão Exigida**: `salao.tables.view`
- **Estratégia de Reversão**: `reativar_reserva_cancelada`
- **Exemplo de Chamada**: "Cancelar reserva res-101."
