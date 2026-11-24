---
id: HDEV-017
titulo: RH ágil para o administrador: folga de domingo, feriados, corrigir ponto, dar folga, funcionário doente (atestado) em poucos toques, e tudo também pelo Jhon
status: DONE
prioridade: 3
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-11-24
---

# HDEV-017 — RH ágil para o administrador: folga de domingo, feriados, corrigir ponto, dar folga, funcionário doente (atestado) em poucos toques, e tudo também pelo Jhon

## Objetivo

O administrador resolve o RH do dia em poucos toques (folga de domingo, folga, atestado, feriado, corrigir ponto) e também pelo Jhon, sempre com prévia e Confirmar.

## Critério de pronto

- Tela Equipe › Ações rápidas (`/dashboard/rh/rapido`) com Domingos, Folga, Doente, Feriados e Corrigir ponto.
- Jhon entende "dá folga pra Eduarda amanhã", "o Bruno está doente, 2 dias", "lança feriado dia 8", "corrigir o ponto da Eduarda de ontem".
- O que não foi dito é perguntado (quem, qual Ana, qual dia, quantos dias). Nada é gravado sem Confirmar.
- Grava com o usuário logado (RLS do RH); unidade vem da sessão.

## Arquivos afetados

- Tela: `app/dashboard/rh/rapido/page.js`, `app/lib/rh-rapido.mjs`
- Jhon: `app/lib/rh-texto.mjs` (quem e quando no texto), `app/lib/intelligence/actions/rh-rapido.mjs` (ações `rh.dayOff`, `rh.sickLeave`, `rh.holiday` e o link de corrigir ponto), `registry.mjs`, `permissions/mapa.mjs` (capacidade `rh_rapido`), `context/db-escopado.mjs` (+`rh_atestados`, `rh_feriados`), `commands/catalogo.mjs` (intenções `rh.dar_folga`, `rh.atestado`, `rh.feriado`, `rh.corrigir_ponto`), `commands/command-bus.mjs`

## Testes obrigatórios

`node --test app/lib/rh-texto.test.mjs app/lib/rh-rapido.test.mjs app/lib/intelligence/__tests__/rh-rapido-jhon.test.mjs`

## Resultado

- Folga: uma ou várias pessoas, um dia ou período ("de hoje a sexta"); não repete folga já lançada; avisa domingo acima da regra (1 por mês; 2 para mulheres) e folga retroativa.
- Doente: atestado só com datas (sem CID, sem diagnóstico); "está doente" = desde hoje; foto anexada depois na tela.
- Feriado: data e nome; não repete feriado já lançado.
- Corrigir ponto: a correção continua na tela (motivo escrito, batida original guardada); o Jhon abre já na pessoa e no dia.

## Evidências

- TESTADO LOCAL: 1335 testes de `app/lib` + 280 da inteligência, catálogo de permissões, navegação e build.
- NÃO VALIDADO com login em produção (gravação real depende do RLS do RH no banco).

## Histórico

- 23/11/2026: pedido do dono; tela Ações rápidas (PR #290).
- 24/11/2026: Jhon faz folga, atestado e feriado pelo chat com Confirmar; corrigir ponto vira atalho.
