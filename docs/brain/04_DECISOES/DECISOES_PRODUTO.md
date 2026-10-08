# Decisões de produto

## DP-001 — Quem abre a Central de Inteligência

- `dashboard.intelligence.view`: dono, super admin e gerente-geral (`dashboard.*`).
- Configurações (metas, alertas): `dashboard.intelligence.settings`.
- **Não liberar para todos os funcionários.** Validado no banco real em 07/10: somente-consulta e cozinheiro recebem 403.

## DP-002 — Metas são do dono, nunca inventadas

A meta mensal é digitada por gente. O sistema só **sugere** a distribuição por dia (selo SUGESTÃO). O atingimento é o faturamento real ÷ meta.

## DP-003 — Três alertas em destaque

A Central mostra os três mais relevantes, por criticidade × impacto × confiança. Perguntas do Héfisto só quando só a equipe sabe a resposta. O feedback vira dado estruturado.

## DP-004 — Copilot legado escondido, não apagado

As páginas antigas (piloto, saúde, auditoria do Héfisto) saíram da busca. O código ficou: apagar é uma decisão separada.

## DP-005 — Reservas & Eventos e orçamento de buffet exigem permissão de eventos (07/10/2026)

Antes, qualquer funcionário abria essas telas, inclusive o custo das fichas no orçamento. Agora:
- `eventos.overview` cobre a visão geral, a agenda e os contatos;
- `eventos.quote` cobre o orçamento de buffet.

Somente-consulta perdeu esse acesso.

## Pendentes de decisão do dono

- **Correção de RLS crítico:** colaboradores, registro de ponto e tabelas multiempresa. Ver [[HDEV-008]] e BLQ-005.
- **Merge do PR #127 para produção:** BLQ-004.
- **Rotina noturna na nuvem:** custo por rodada definido em `scripts/hefisto-agent/config.json` (`--max-budget-usd`).
