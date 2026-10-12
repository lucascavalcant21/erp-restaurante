---
name: hefisto-whatsapp-crm
description: WhatsApp (API oficial da Meta, gateway de comandos, ponte local, saúde) e CRM do Héfisto (clientes, campanhas, NPS). Use ao mexer em app/lib/whatsapp, scripts/hefisto-agent/ponte-whatsapp.mjs, whatsapp-saude, app/dashboard/clientes ou clientes.js, ou ao monitorar a conta do WhatsApp.
---

# WhatsApp e CRM

Antes de segredo, webhook ou banco, siga `hefisto-seguranca-supabase`. Para testar e publicar, `hefisto-entrega`.

## Regras fixas

- **Só a API oficial da Meta (Cloud API).** Nada de WhatsApp Web, scraping ou biblioteca não oficial.
- **Não altere a conta do WhatsApp Business +55 45 98812-5320**: número, perfil, verificação e templates ficam com o dono. Monitorar é só leitura.
- **Não conecte o YCloud** (`app/lib/whatsapp/ycloud.mjs` existe, mas a ativação depende do dono: `docs/brain/06_OPERACAO/YCLOUD_ATIVACAO.md`).
- Webhook falha fechado: sem segredo configurado, nada passa. A assinatura `X-Hub-Signature-256` é conferida em `meta.mjs`. O token nunca vai para log.
- Só número autorizado manda comando (`numero.mjs`, `sessao-dono.mjs`). O comando roda como o usuário do dono, sob RLS.

## Onde está

| O quê | Onde |
|---|---|
| Gateway | `app/lib/whatsapp/gateway.mjs`: webhook → número autorizado → deduplicação → limite → interpretar → destino |
| Envio e fila | `envio.mjs`, `fila.mjs`, `formatar.mjs` |
| Saúde | `saude.mjs`, `npm run hefisto:whatsapp:saude` |
| Ponte local | `npm run hefisto:ponte` (reiniciar a ponte só com OK do dono) |
| Configuração | `docs/brain/06_OPERACAO/WHATSAPP_SETUP.md` |
| CRM | `app/lib/clientes.js` (`clientes`, `campanhas`, `avaliacoes_nps`), telas `app/dashboard/clientes/*` |

## Testes

`npm run test:whatsapp` · `node scripts/test-phase-3a-whatsapp.mjs`

## Precisa do dono

- Enviar mensagem a cliente ou disparar campanha.
- Mudar template, número ou webhook na Meta.
- Gastar com mensagens pagas.
- Reiniciar a ponte.
