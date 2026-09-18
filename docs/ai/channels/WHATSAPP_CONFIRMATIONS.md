# Integriação de Confirmações via WhatsApp — Héfisto (Fase 3A)

## 1. Fluxo de Confirmação no WhatsApp
Quando o usuário solicita uma ação de escrita via WhatsApp (ex: *"Adicione 15 kg de picanha por 79,90"*):

1. **Dry-Run & Preview**:
   - O Agent Core reconhece a intenção WRITE de Estoque.
   - Executa o Dry Run e grava uma entrada em `agent_confirmations` com `status = PENDING`.
   - Gera o `confirmation_id` (ex: `cnf-abc123xyz`).

2. **Mensagem Interativa com Botões**:
   - O `WhatsAppAdapter` intercepta o estado pendente.
   - O `WhatsApp Sender` envia uma mensagem interativa com botões Quick Reply:
     - Botão 1: `[Confirmar Ação]` (payload: `CONFIRM_cnf-abc123xyz`)
     - Botão 2: `[Cancelar Ação]` (payload: `CANCEL_cnf-abc123xyz`)

3. **Interação do Usuário**:
   - O usuário toca no botão no aplicativo WhatsApp.
   - A Meta envia um evento `button_reply` no Webhook POST.

4. **Execução ou Cancelamento**:
   - Se o payload for `CONFIRM_...`: o adaptador chama `executeConfirmation(confirmation_id, userId, empresaId, unidadeId)`.
   - Se a execução for bem-sucedida, a ação de domínio é realizada no ERP, o status muda para `EXECUTED` e uma confirmação textual é enviada no WhatsApp.
   - Se o payload for `CANCEL_...`: o adaptador chama `cancelConfirmation(confirmation_id, userId)`. O status muda para `CANCELLED` e o cancelamento é notificado.

## 2. Suporte a Comandos de Texto (Fallback)
Se o usuário estiver em um cliente WhatsApp legados sem suporte a botões interativos, ele pode responder manualmente com o texto:
- `Confirmar cnf-abc123xyz`
- `Cancelar cnf-abc123xyz`

O adaptador identifica o padrão via Regex e aciona os mesmos métodos do motor de confirmação do Agent Core.
