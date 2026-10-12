---
name: hefisto-rh-ponto
description: RH e ponto do Héfisto (colaboradores, registro de ponto, espelho e fechamento do mês, folgas de domingo, jornada, adicional noturno, hora extra, feriados, banco de horas, atestados, recibos, arquivos AEJ/AFD). Use ao mexer em app/dashboard/rh, rh.js, ponto*.js/mjs, jornada-*.mjs ou em scripts de correção de ponto em db/.
---

# RH e ponto

Antes de banco ou migração, siga `hefisto-seguranca-supabase`. Para testar e publicar, `hefisto-entrega`.

## Regras

- **Cálculo de jornada é dinheiro e obrigação legal.** `app/lib/jornada-calculo.mjs` cita a norma de cada regra (CLT art. 73: noturno das 22h às 5h, hora ficta de 52min30s). Não mude regra sem citar a base legal.
- Espelho fechado (`rh_espelho_fechado`) é o mês entregue: não reabra nem altere sem o dono.
- Arquivos legais de ponto: `app/lib/aej-layout.mjs` e `afd-layout.mjs`. O layout segue a portaria. Os testes travam o formato.
- Dados pessoais (CPF, RG, endereço, fotos, atestados) ficam só no Supabase. Nunca vão para log, relatório, `docs/brain` ou chat. Fotos e anexos passam por `app/lib/server/rh-arquivos.mjs`.
- Correção de ponto de uma pessoa (os `db/CORRIGIR_PONTO_*.sql`) é escrita em produção: prepare o SQL com preflight e mostre o antes e o depois ao dono, sem executar.

## Onde está

| O quê | Onde |
|---|---|
| Dados de RH | `app/lib/rh.js` (colaboradores, holerites, banco de horas, atestados, feriados) |
| Ponto | `app/lib/ponto.js`, `ponto-marcacao.js`, `ponto-status.mjs`, RPC `ponto_marcacao_conferir` |
| Semana e folgas | `app/lib/jornada-semana.mjs`, `folgas-domingo.mjs` |
| Telas | `app/dashboard/rh/*`, `app/dashboard/ponto` |

## Testes

`node --test app/lib/jornada-calculo.test.mjs app/lib/jornada-semana.test.mjs app/lib/ponto-status.test.mjs app/lib/folgas-domingo.test.mjs app/lib/aej-layout.test.mjs app/lib/afd-layout.test.mjs`

Falhas já conhecidas na `main` (11/10/2026): `navegacao.test.mjs` (link `/dashboard/rh/colaborador`) e `folgas-domingo.test.mjs` (texto da mensagem). Não são regressão nova. Corrigir pede o OK do dono.

## Precisa do dono

Alterar ponto, folha, recibo ou espelho de alguém; excluir colaborador; mexer em acesso/senha de funcionário.
