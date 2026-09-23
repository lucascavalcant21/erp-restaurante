# Arquitetura do WhatsApp Channel Adapter — Héfisto (Fase 3A)

## 1. Visão Geral
O `WhatsApp Channel Adapter` atua como um adaptador de canal de entrada/saída para o **Héfisto Agent Core** existente. Ele NÃO possui cérebro próprio, modelo de IA separado, nem motor de confirmação paralelo.

```
WhatsApp App (Meta)
       │
       ▼ (HTTP POST Webhook / Meta Graph API)
app/api/channels/whatsapp/webhook/route.js
       │
       ▼ (HMAC SHA-256 & Deduplicação)
app/lib/server/channels/whatsapp/adapter.mjs
       │
       ├──> Normalização: normalizeWhatsAppMessage()
       ├──> Resolução de Identidade: resolveWhatsAppIdentity()
       │
       ▼ (Payload Canônico: NormalizedMessage)
app/lib/server/hefisto-intents.js (Agent Core)
       │
       ├──> Leitura / Consulta direct: Tool Registry READ
       └──> Escrita (WRITE): Dry Run ──> agent_confirmations (PENDING)
                                                │
                                                ▼ (Meta Interactive Buttons)
                                   WhatsApp Quick Reply Buttons
                                   [Confirmar] [Cancelar]
```

## 2. Componentes da Camada WhatsApp
- **Webhook Route** (`app/api/channels/whatsapp/webhook/route.js`): Ponto de entrada GET (desafio de verificação Meta Webhook) e POST (recebimento de notificações com validação HMAC SHA-256).
- **Normalized Message** (`app/lib/server/channels/normalized-message.mjs`): Adaptador de contrato unificado para mensagens entre canais.
- **Identity Resolver** (`app/lib/server/channels/whatsapp/identity.mjs`): Mapeia o número E.164 (`wa_id`) para o usuário, empresa e unidade no ERP (`whatsapp_identities`).
- **Rate Limiter** (`app/lib/server/channels/whatsapp/rate-limiter.mjs`): Janela deslizante anti-abuso por número de telefone.
- **WhatsApp Sender** (`app/lib/server/channels/whatsapp/sender.mjs`): Envio de mensagens de texto e botões interativos via Meta Graph API v18.0+.
- **WhatsApp Adapter** (`app/lib/server/channels/whatsapp/adapter.mjs`): Orquestrador central do canal WhatsApp.

## 3. Fluxo de Execução
1. **Webhook Ingest**: Validação da assinatura `X-Hub-Signature-256`.
2. **Deduplicação**: Verificação no banco `whatsapp_processed_messages` por `wamid`.
3. **Autenticação**: Resolução de `wa_id` para `user_id`/`empresa_id` em `whatsapp_identities`.
4. **Intenção READ**: O Agent Core processa e retorna texto simples.
5. **Intenção WRITE**: O Agent Core faz Dry Run, registra `confirmation_id` em `agent_confirmations` com status `PENDING` e retorna preview estruturado.
6. **Resposta Interativa**: O Sender envia mensagem com preview + botões interativos de resposta rápida (`CONFIRM_cnf-xxx` e `CANCEL_cnf-xxx`).
7. **Callback de Botão**: Ao clicar no botão no WhatsApp, o Webhook recebe o evento `button_reply`, que executa a confirmação diretamente no motor do Agent Core (`agent_confirmations`) e notifica o resultado.
