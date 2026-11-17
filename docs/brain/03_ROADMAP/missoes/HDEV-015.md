---
id: HDEV-015
titulo: Produção do dia pelo Jhon: plano de produção com explosão das fichas (empanado 140 g/64 g de frango, parmegiana → molho → alho, sal, açúcar), limpeza programada com insumos, estoque do produzido com lucro estimado, batata porcionada x não porcionada
status: BACKLOG
prioridade: 3
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-11-17
---

# HDEV-015 — Produção do dia pelo Jhon: plano de produção com explosão das fichas (empanado 140 g/64 g de frango, parmegiana → molho → alho, sal, açúcar), limpeza programada com insumos, estoque do produzido com lucro estimado, batata porcionada x não porcionada

## Objetivo

(descreva o resultado esperado para o dono)

## Critério de pronto



## Arquivos afetados



## Testes obrigatórios



## Resultado



## Evidências



## Histórico

## Andamento (17/11/2026)
- Feito no `hefisto-teste`: conta pelas fichas (`app/lib/marmitaria/planejamento.mjs`), ação `production.plan` (prévia → plano do dia), intenção `marmitaria.estoque_pronto` (estoque + lucro ESTIMATIVA). TESTADO EM MOCK e LOCAL; preview NÃO VALIDADO.
- Depende de cadastro: fichas com rendimento (empanado 140 g com 64 g de frango, molho, parmegiana) e ficha de limpeza (departamento Limpeza) com óleo, sal e água.
- Falta: validar no preview com fichas reais; quantidade em kg quando a ficha rende em unidades (sem conversão hoje).
