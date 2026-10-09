---
id: HDEV-WA-REAL-001
titulo: WhatsApp com número real (sair do número de teste da Meta)
fase: HI-06
status: BLOCKED
prioridade: 1
dependencias: [HDEV-WA-001]
bloqueadores: [BLQ-011]
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-09
---

# HDEV-WA-REAL-001 — WhatsApp com número real

## Objetivo

Trocar o número de teste da Meta (+1 555 156 6178) por um número real do Héfisto, sem perder o funcionamento em produção.

## Critério de pronto

- [x] Configuração atual conferida (09/10): app hefisto publicado, WABA 2312598276160019 (só o número de teste), webhook e assinatura OK, 9 variáveis em Production, ponte e agente rodando — TESTADO EM PRODUÇÃO
- [x] Código sem dependência do número de teste (tudo por WHATSAPP_PHONE_NUMBER_ID) — conferido no código
- [x] B-014 corrigido: auditoria marca canal whatsapp — TESTADO LOCAL
- [x] Ponte pode abrir sozinha no login do Windows (`npm run hefisto:ponte:autostart -- instalar`, sem admin, sem segredo) — TESTADO LOCAL
- [ ] Chip novo (decisão do dono: linha nova, nunca usada no WhatsApp) — BLQ-011
- [ ] Número cadastrado e registrado na Cloud API (código SMS/ligação e PIN pelo dono)
- [ ] WHATSAPP_PHONE_NUMBER_ID novo em Production + redeploy
- [ ] TESTADO EM PRODUÇÃO pelo número real: status, como está minha empresa?, missões, bloqueadores, aprovações
- [ ] Número de teste fora do fluxo

## Arquivos afetados

`app/lib/intelligence/server/http.mjs`, `app/lib/whatsapp/servidor.mjs`, `scripts/hefisto-agent/ponte-autostart.mjs`, docs.

## Testes obrigatórios

http.test, canal.test, ponte-whatsapp.test, test:intelligence, build.

## Resultado

09/10/2026: o número informado (+55 45 99857-4041) é o WhatsApp pessoal do dono e o número AUTORIZADO; usá-lo apagaria a conta do WhatsApp do celular e impediria o dono de comandar o Héfisto. Não foi cadastrado. Dono vai providenciar um chip novo. Passo a passo pronto em [[WHATSAPP_SETUP]].
