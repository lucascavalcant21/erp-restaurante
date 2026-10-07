# Segurança & Proteção do Canal WhatsApp — Héfisto (Fase 3A)

## 1. Verificação de Assinatura Webhook (HMAC SHA-256)
Todas as requisições recebidas da Meta Graph API no endpoint `/api/channels/whatsapp/webhook` passam obrigatoriamente por verificação criptográfica, em qualquer ambiente:
- Sem `WHATSAPP_APP_SECRET` configurado, o webhook fica FECHADO: `POST` responde 503 e nenhum evento é processado.
- O cabeçalho `X-Hub-Signature-256` (formato `sha256=<hex>`) é extraído do request.
- É calculado o HMAC SHA-256 do corpo bruto da requisição utilizando a chave secreta `WHATSAPP_APP_SECRET` e comparado em tempo constante (`verificarHmac` em `app/lib/server/integracoes.mjs`, que não lança exceção com tamanhos diferentes).
- Cabeçalho ausente ou assinatura inválida → 401, antes de qualquer `JSON.parse` ou processamento.
- O desafio de verificação (`GET`) só aceita o token de `WHATSAPP_VERIFY_TOKEN`; sem ele configurado, responde 403 (não existe token padrão).
- Teste: `node scripts/test_webhook_whatsapp_assinatura.mjs`.

## 2. Limitador de Taxa (Rate Limiter Anti-Abuso)
Para evitar ataques de negação de serviço ou spam de mensagens:
- O módulo `WhatsAppRateLimiter` (`app/lib/server/channels/whatsapp/rate-limiter.mjs`) gerencia uma janela deslizante em memória por número de telefone E.164.
- Limite padrão: **20 requisições por minuto** por número.
- Se o limite for excedido, a requisição é descartada e o usuário recebe um aviso informando que excedeu o limite operacional.

## 3. Isolamento Multi-tenant & Resolução de Identidade
- Não há aceitação de mensagens de números anônimos ou desconhecidos.
- O número E.164 remetente (`wa_id`) deve existir previamente na tabela `whatsapp_identities` com `is_active = true`.
- As credenciais de contexto (`user_id`, `empresa_id`, `unidade_id`, `role`) do usuário autenticado são injetadas de forma imutável em todo o ciclo de vida da execução.

## 4. Proteção contra Alteração de Payload em Ações WRITE
- Os botões interativos enviados ao WhatsApp contêm apenas o ID da confirmação: `CONFIRM_cnf-xxx` ou `CANCEL_cnf-xxx`.
- Ao clicar no botão ou responder ao comando, o motor recupera o registro original em `agent_confirmations`.
- Os parâmetros de execução (como quantidade, preço, item) são extraídos **exclusivamente do payload original sanitizado em banco de dados**. O payload do WhatsApp não possui permissão para alterar nenhum dado da ação.
