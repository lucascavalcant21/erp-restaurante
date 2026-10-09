---
id: HDEV-WA-001
titulo: WhatsApp Command Channel (texto) — comandar o Héfisto e o agente pelo WhatsApp
fase: HI-06
status: IN_PROGRESS
prioridade: 1
dependencias: []
bloqueadores: [BLQ-006]
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-09
---

# HDEV-WA-001 — WhatsApp Command Channel

## Objetivo

O dono manda uma mensagem do celular e recebe uma resposta real do Héfisto, pela **plataforma oficial Meta WhatsApp Cloud API** (nada de WhatsApp Web). Primeira versão: só os números autorizados do dono e a lista fechada de comandos. Entrega a parte de texto da [[HDEV-007]] (voz fica lá).

```
WhatsApp → webhook Meta (assinatura obrigatória) → número autorizado → Command Gateway
  ├─ empresa / pergunte ao Héfisto → Intelligence Core COMO o usuário do dono (sessão real, RLS, auditoria)
  └─ status / continue / pare / missões / bloqueadores / aprovações / aprovar / rejeitar
       → fila (whatsapp_comandos) → ponte no PC do dono (npm run hefisto:ponte) → resposta
```

## Critério de pronto

- [x] Assinatura `X-Hub-Signature-256` obrigatória; sem segredo, recusa (sem token padrão) — TESTADO LOCAL
- [x] Só números de `WHATSAPP_NUMEROS_DONO` (regra do 9º dígito BR); número estranho não recebe resposta — TESTADO LOCAL
- [x] Deduplicação por `message_id`, mensagem antiga ignorada, limite por número — TESTADO LOCAL
- [x] Comandos: status, como está o desenvolvimento?, continue, pare, missões, bloqueadores, aprovações, aprovar <ID>, rejeitar <ID>, como está minha empresa?, pergunte ao Héfisto: <pergunta> — TESTADO LOCAL
- [x] Empresa/pergunta pelo MESMO caminho da Central (`atenderInteligencia` + handlers compartilhados); DADOS INSUFICIENTES escrito; ações bloqueadas no WhatsApp — TESTADO LOCAL
- [x] Ponte local com as funções dos comandos npm; aprovar só muda o status (nunca executa) — TESTADO LOCAL
- [x] Fila no banco (APR-003 executada 09/10) — TESTADO NO SUPABASE REAL
- [x] Publicado em produção 09/10 (`ba0a91a`, PR #128, com o dono): webhook recusa sem assinatura, ponte responde — TESTADO EM PRODUÇÃO
- [ ] Meta configurada pelo dono (ACESSO-006, [[WHATSAPP_SETUP]])
- [ ] TESTADO EM PRODUÇÃO: mensagem do celular do dono → resposta

## Arquivos afetados

`app/lib/whatsapp/*` (numero, comandos, meta, gateway, formatar, sessao-dono, fila, servidor), `app/api/channels/whatsapp/{webhook,ponte}/route.js`, `app/lib/intelligence/server/handlers.mjs` (ask/brief compartilhados), `scripts/hefisto-agent/ponte-whatsapp.mjs`, `db/whatsapp/WA_001_*.sql`.

## Testes obrigatórios

`npm run test:whatsapp` · `node --test scripts/hefisto-agent/__tests__/ponte-whatsapp.test.mjs` · `npm run test:intelligence` · rotas-vercel · build.

## Resultado

09/10/2026: canal implementado e testado local (19 testes novos). Substitui o webhook da fase 3A (S-18). Aguarda: APR-003, merge para produção e a configuração na Meta.
09/10/2026 ~01:00: APR-003 aplicada e PR #128 publicado (smoke OK). Falta só a Meta (BLQ-006) e a primeira mensagem real. Não validado ainda: abrir a sessão do dono (generateLink + verifyOtp) no Supabase real: acontece na primeira mensagem.
