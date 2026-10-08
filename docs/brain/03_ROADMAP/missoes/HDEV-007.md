---
id: HDEV-007
titulo: HI-06 — Voz / WhatsApp
fase: HI-06
status: BACKLOG
prioridade: 3
dependencias: [HDEV-001]
bloqueadores: [BLQ-006]
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-007 — HI-06: Voz / WhatsApp

## Objetivo

Consultar e comandar o Héfisto (a empresa e o desenvolvimento) pelo **WhatsApp oficial (Meta Business Platform)** e por voz. Arquitetura em [[ROADMAP]]: webhook seguro → Command Gateway → autenticação do dono → fila → agente → resposta.

Refazer o canal sobre o Intelligence Core. O webhook atual (`app/api/channels/whatsapp/webhook`) usa o agente legado e aceita POST sem assinatura: **não estender**.

## Critério de pronto

- [ ] Assinatura `X-Hub-Signature-256` obrigatória; sem segredo, o webhook recusa (nada de token padrão no código)
- [ ] Deduplicação por `message_id`, limite de taxa, identidade vinculada a `usuarios_erp`
- [ ] Comandos de desenvolvimento: status (lê [[STATUS_ATUAL]]), continuar (libera READY), nova missão (BACKLOG), parar (STOP)
- [ ] Comando crítico exige confirmação explícita
- [ ] Testes do gateway com mensagens simuladas (TESTADO LOCAL) e depois com o número de teste da Meta (TESTADO NO PREVIEW)

## Arquivos afetados

`app/api/channels/whatsapp/*`, `app/lib/server/channels/whatsapp/*`, `db/3a/*` (RLS), novo gateway.

## Testes obrigatórios

Testes do gateway · `npm run test:intelligence` · build.

## Resultado

## Evidências

## Histórico
