---
id: HDEV-012
titulo: Ecossistema por área: contas de cozinha, bar e salão que só consultam, anotam e retiram
status: BACKLOG
prioridade: 3
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-11-06
---

# HDEV-012 — Ecossistema por área: contas de cozinha, bar e salão que só consultam, anotam e retiram

## Objetivo

Cada área tem uma conta própria que consulta tudo sem editar: o dono atualiza, a equipe só usa.

Decisões do dono (05/11/2026): uma conta por área, com a pessoa escolhendo o nome ao registrar. Compras: a equipe pede e confere; o dono confirma valor e conta. Estoque: só retirar; a entrada vem pela compra. Ordem: cozinha e bar juntos, depois o salão.

## Critério de pronto

- Fase 1: busca da área sem custo, anotações de produção e pedidos de compra, estoque só retirar, contas `equipe-cozinha` e `equipe-bar`.
- Fase 2: a equipe confere o que chegou; o dono confirma valor e conta a pagar; produção do dia e tablet da marmita em cozinha e bar.
- Fase 3: conta do salão, treinamento do garçom e mesas com fotos por área (salão, jardim). Depende das fotos e das áreas do dono.

## Estado

- Fase 1: TESTADO EM MOCK nas telas e TESTADO LOCAL na migração (PGlite). `ECO_1` não aplicada no banco real.
- A tela `/dashboard/operacao/montagem` não confere permissão para editar ou excluir, então a conta da equipe não recebe `assembly.view` e vê a montagem na Buscar.
- `fichas_tecnicas` continua gravável pelo banco para quem é da unidade: fechar depende de SEC-FICHAS-1/APR-016.

## Decisão pendente do dono

Etiqueta com peso lança produção como entrada. Na conta que só retira, o banco recusa essa entrada: a etiqueta sai, o saldo não sobe, e a tela agora avisa.
