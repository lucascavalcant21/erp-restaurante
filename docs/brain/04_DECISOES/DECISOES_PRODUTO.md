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

## DP-006 — O agente pode trabalhar 24 horas por dia (08/10/2026)

- **Decisão do dono:** "não precisa ser só à noite, pode ser o dia todo, 24h por dia".
- **Como ficou:** `npm run hefisto:continuo`. Sem missão READY, ele espera e confere de novo.
  - Limite do plano: espera o plano voltar, sem contar falha na missão (DP-007).
  - Parar: `npm run hefisto:parar`.
- **Permissões:** as mesmas da noite (conectores só leitura, DA-007).

## DP-007 — Só o plano do claude.ai, nunca dinheiro a mais (08/10/2026)

- **Decisão do dono:** "quando acabar o limite, ele não pode usar dinheiro para mais limite; tem que aguardar os tokens do plano voltarem".
- **Como ficou** (`scripts/hefisto-agent`):
  - o motor roda sem `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` nem as variáveis de Bedrock, Vertex e Foundry;
  - o runner lê o `stream-json` ao vivo:
    - fonte paga no início (`apiKeySource`): mata o motor e para;
    - `isUsingOverage`: mata na hora;
    - plano em 97% com uso extra ligado ou desconhecido: para antes de cobrar;
    - `status: rejected`: limite atingido;
  - a missão volta para READY sem tentativa;
  - o runner espera até o `resetsAt` informado (status `plano_volta_em`) e continua.
- **Garantia definitiva:** créditos de uso desligados em claude.ai → Configurações → Uso. Fonte: suporte da Anthropic, "extra usage for paid Claude plans".
- **Teto de gasto por dia:** desligado (`maxCustoPorDiaUsd: 0`). O custo que o Claude Code informa no plano é estimativa, não cobrança.
- **Evidência:**
  - TESTADO LOCAL: testes com motor falso (uso extra mata em menos de 15 s; a chave de API não chega ao motor);
  - TESTADO LOCAL com o Claude Code 2.1.294 real:
    - o `hefisto:preparar` mostrou "plano do claude.ai", "98% usado, volta às 19:30" e o estado do uso extra;
    - o formato do `rate_limit_event` foi conferido (com e sem `overageStatus`).

## Pendentes de decisão do dono

- **Agente com escrita em produção** (pedido de 08/10: aplicar migração, escrever no banco, branches do Supabase, deploy, promover e reverter, ver e mudar variáveis de ambiente).
  - A verificação de segurança automática da sessão de desenvolvimento recusou a mudança, por dar a um agente sem supervisão poder de deploy e escrita em produção.
  - Para seguir, o dono precisa confirmar com a sessão em modo Auto.
  - Desenho proposto: a guarda continua recusando DROP, TRUNCATE, DELETE/UPDATE sem WHERE, desligar RLS, policy aberta, auth.* e segredo em NEXT_PUBLIC_.


- **Correção de RLS crítico:** colaboradores, registro de ponto e tabelas multiempresa. Ver [[HDEV-008]] e BLQ-005.
- **Merge do PR #127 para produção:** BLQ-004.
- **Rotina noturna na nuvem:** custo por rodada definido em `scripts/hefisto-agent/config.json` (`--max-budget-usd`).
