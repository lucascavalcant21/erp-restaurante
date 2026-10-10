---
id: HDEV-WA-COEX-001
titulo: WhatsApp do Héfisto em +55 45 98812-5320 (coexistência com o WhatsApp Business App via YCloud)
fase: HI-06
status: BLOCKED
prioridade: 1
dependencias: [HDEV-WA-001]
bloqueadores: [BLQ-012]
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-10
---

# HDEV-WA-COEX-001 — Número oficial do Héfisto em coexistência

## Objetivo

Decisão do dono (10/10/2026):
- **Héfisto** = +55 45 98812-5320, que já usa o WhatsApp Business App: manter o app e o histórico (coexistência oficial).
- **Admin** (único número que manda comandos) = +55 45 99857-4041.
- Caminho: parceiro **YCloud** (plano gratuito). Tech Provider próprio e apagar o WhatsApp Business foram descartados.

Por que: o número de teste da Meta (+1 555) é dos EUA e a Meta recusa entrega para o Brasil (erro 130497, visto em produção 09/10 23:32). Coexistência só existe via Solution Partner/Tech Provider e **exige verificação da empresa na Meta** (YCloud: "coexistence still requires Business Verification").

## Critério de pronto

- [x] Allowlist só 99857-4041 (Vercel Production; vale no próximo deploy) — conferido no código
- [x] Adaptador YCloud: webhook assinado (`YCloud-Signature`, HMAC-SHA256, 5 min), envio `sendDirectly`, recibos, ecos/histórico nunca viram comando, só mensagens PARA o número do Héfisto — TESTADO LOCAL
- [x] Provedor por configuração (`WHATSAPP_PROVEDOR` = meta | ycloud), nenhum número fixo no código
- [ ] Verificação da empresa Hefisto na Meta (dono) — BLQ-012
- [ ] Conta YCloud (dono), canal "WhatsApp Business APP Coexistence", QR code no celular do 98812-5320 (dono)
- [ ] Vercel: YCLOUD_API_KEY, YCLOUD_WEBHOOK_SECRET (dono cola), WHATSAPP_NUMERO_HEFISTO, WHATSAPP_PROVEDOR=ycloud (agente) + redeploy
- [ ] Webhook do YCloud → `https://app.hefisto.com.br/api/channels/whatsapp/ycloud` (eventos: inbound_message.received, message.updated, smb.message.echoes, smb.history)
- [ ] TESTADO EM PRODUÇÃO de 99857-4041 → 98812-5320: status, missões, bloqueadores, aprovações, continue, como está minha empresa?; número não autorizado não executa

## Arquivos afetados

`app/lib/whatsapp/{ycloud,envio,servidor}.mjs`, `app/api/channels/whatsapp/{ycloud,ponte}/route.js`.

## Testes obrigatórios

ycloud.test, canal.test, rotas-vercel, build.

## Resultado

10/10/2026: adaptador pronto (inerte em produção sem o segredo do YCloud). Aguarda a verificação da empresa.
