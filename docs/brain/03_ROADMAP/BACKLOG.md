# Backlog

Missões criadas e ainda não liberadas. Para liberar uma: `npm run hefisto:missoes -- pronta HDEV-00X`. Para criar: `npm run hefisto:missoes -- nova "Título" --prioridade 2 --depende HDEV-001`.

Ideias ainda sem forma de missão ficam em [[IDEIAS_DO_DONO]] e [[PEDIDOS_NOVOS]].

## Itens menores (sem missão própria ainda)

- **Integrações:** alinhar o nome da variável do Saipos (`SAIPOS_INTEGRATION_SECRET` × `SAIPOS_INTEGRACAO_SECRET`).
- **Ambiente:** hook de início de sessão na nuvem que instala o PGlite. Hoje os testes de SQL real precisam de `npm i --no-save @electric-sql/pglite --prefix /tmp/pglite`.
- **IA legada:** padronizar as rotas `ia-*` no provider único do Intelligence Core (hoje há modelos fixos e `fetch` direto). Também entra em [[HDEV-008]] pela falta de sessão.
- **Banco:** dump schema-only de produção para `db/baseline/` (não há esquema confiável no repositório).

<!-- hefisto-agent:indice:inicio -->
| id | título | status | prioridade | depende de | bloqueadores | rodadas |
|---|---|---|---|---|---|---|
| [[HDEV-008]] | SEG — Fechar RLS de colaboradores/registro_ponto e isolar tabelas multiempresa | BACKLOG | 1 | – | BLQ-005 | 0 |
| [[HDEV-002]] | HI-03 — CMV Real × Teórico + Estoque Real × Esperado | BACKLOG | 2 | HDEV-001 | – | 0 |
| [[HDEV-003]] | HI-03 — Conciliação Financeira | BACKLOG | 2 | HDEV-001 | – | 0 |
| [[HDEV-004]] | HI-04 — Forecast Engine | BACKLOG | 3 | HDEV-002 | – | 0 |
| [[HDEV-005]] | HI-04 — Decision / What-if | BACKLOG | 3 | HDEV-004 | – | 0 |
| [[HDEV-006]] | HI-05 — Proatividade / Autonomia | BACKLOG | 3 | HDEV-004 | – | 0 |
| [[HDEV-007]] | HI-06 — Voz / WhatsApp | BACKLOG | 3 | HDEV-001 | BLQ-006 | 0 |
<!-- hefisto-agent:indice:fim -->
