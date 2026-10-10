# Ativação do YCloud no dia da aprovação da Meta (HDEV-WA-COEX-001)

Héfisto = **+55 45 98812-5320** (WhatsApp Business App, coexistência). Admin = **+55 45 99857-4041**.
Nada aqui apaga, migra ou desconecta o WhatsApp Business: o QR liga o app à API, o app continua no celular.

## 0. Antes (agente)
- `npm run hefisto:whatsapp:saude` → linha de base (provedor `meta`, `ycloud.apiKey/webhookSecret = false`).
- Conferir na Meta: Central de Segurança → Verificação da empresa = **Verificada**.

## 1. Conta e canal (dono, ~5 min) — único passo no celular
1. ycloud.com → **Sign up** (plano Gratuito, sem cartão).
2. Console → **WhatsApp accounts** → **Create Channel** → **WhatsApp Business APP Coexistence** → **I'm ready to start**.
3. **Connect with Facebook** → escolher o portfólio **Hefisto** (não criar outro) → **Connect a WhatsApp Business App** → número **+55 45 98812-5320**.
4. No celular do 98812-5320 (WhatsApp Business ≥ 2.24.17, atualizado): abrir a mensagem/QR da Meta → **escanear o QR** → **Confirmar** e **aceitar compartilhar o histórico** (até 6 meses). Manter o app aberto até terminar.
   - Se a Meta disser "More activity on the WhatsApp Business app is needed": parar e avisar o agente.
   - Erro `#2655093 already shared with another partner`: o número está em outro provedor; avisar o agente.

## 2. Webhook (agente orienta; dono clica)
Console → **Developers** → **Webhook** → **Add Endpoints**:
- URL: `https://app.hefisto.com.br/api/channels/whatsapp/ycloud`
- Events: `whatsapp.inbound_message.received`, `whatsapp.message.updated`, `whatsapp.smb.message.echoes`, `whatsapp.smb.history` (se o nome no console for diferente, o agente confere antes)
- **Confirm** → abrir o endpoint → copiar o **Signing secret** (`whsec_…`).

## 3. Chaves na Vercel (dono cola; nunca no chat)
Na pasta do projeto, PowerShell:
```
vercel env add YCLOUD_WEBHOOK_SECRET production
vercel env add YCLOUD_API_KEY production
```
- `YCLOUD_WEBHOOK_SECRET`: o `whsec_…` do passo 2.
- `YCLOUD_API_KEY`: Console → **Developers** → **API Keys** (https://www.ycloud.com/console/#/app/developers/apikey).

## 4. Virar o provedor (agente)
- `WHATSAPP_PROVEDOR=ycloud` em Production (já existem: `WHATSAPP_NUMERO_HEFISTO=5545988125320`, `WHATSAPP_NUMEROS_DONO=5545998574041`).
- Redeploy.
- `npm run hefisto:whatsapp:saude` → `pronto: true`, `ycloud.numeros[…5320].status = CONNECTED`.

## 5. Testes (dono manda do 99857-4041 para o 98812-5320; agente confere em `whatsapp_eventos`)
`status` · `missões` · `bloqueadores` · `aprovações` · `continue` · `como está minha empresa?`
Esperado em cada um: `entrada/comando` → `saida/aceito` com message_id → `status/delivered` (ou `read`).
Segurança: mensagem de outro número → `entrada/nao_autorizado`, nada executa; o que o dono manda pelo app do 98812-5320 → `eco`, nunca comando.

## Voltar atrás (sem perder nada)
- Desligar só o provedor: `WHATSAPP_PROVEDOR=meta` + redeploy.
- Desconectar a coexistência: no app do 98812-5320, **Configurações → Conta → Business Platform → Desconectar** (a Meta não deixa fazer pela API).

Fontes: docs.ycloud.com (Configure webhooks, Create a webhook endpoint, Onboard WhatsApp Business App), helpdocs.ycloud.com (Webhook, Partner onboarding), developers.facebook.com (Onboard WhatsApp Business app users).
