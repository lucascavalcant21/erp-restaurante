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
| [[HDEV-008]] | SEG — Fechar RLS de colaboradores/registro_ponto e isolar tabelas multiempresa | BACKLOG | 1 | – | – | 0 |
| [[HDEV-002]] | HI-03 — CMV Real × Teórico + Estoque Real × Esperado | BACKLOG | 2 | HDEV-001 | – | 0 |
| [[HDEV-003]] | HI-03 — Conciliação Financeira | BACKLOG | 2 | HDEV-001 | – | 0 |
| [[HDEV-004]] | HI-04 — Forecast Engine | BACKLOG | 3 | HDEV-002 | – | 0 |
| [[HDEV-005]] | HI-04 — Decision / What-if | BACKLOG | 3 | HDEV-004 | – | 0 |
| [[HDEV-006]] | HI-05 — Proatividade / Autonomia | BACKLOG | 3 | HDEV-004 | – | 0 |
| [[HDEV-007]] | HI-06 — Voz / WhatsApp | BACKLOG | 3 | HDEV-001 | BLQ-006 | 0 |
| [[HDEV-012]] | Ecossistema por área: contas de cozinha, bar e salão que só consultam, anotam e retiram | BACKLOG | 3 | – | – | 0 |
| [[HDEV-013]] | Sistema de comandas: garçom lança por pessoa, caixa recebe | BACKLOG | 3 | – | – | 0 |
| [[HDEV-014]] | Vários deliveries na mesma unidade (marmitas, hamburgueria…): cada um com nome, segmento, apps, fichas, custos e DRE próprios. Pede migração aditiva (delivery_operacoes + operacao_id nas tabelas marmitaria_*), com dono aprovando | BACKLOG | 3 | – | – | 0 |
| [[HDEV-015]] | Produção do dia pelo Jhon: plano de produção com explosão das fichas (empanado 140 g/64 g de frango, parmegiana → molho → alho, sal, açúcar), limpeza programada com insumos, estoque do produzido com lucro estimado, batata porcionada x não porcionada | BACKLOG | 3 | – | – | 0 |
| [[HDEV-016]] | Juntar os sistemas: o novo no app.hefisto.com.br, só RH e ponto vêm do antigo; 3 logins (Héfisto, Héfisto Ponto, Héfisto Nico) — BLQ-024 | BACKLOG | 3 | – | – | 0 |
| [[HDEV-017]] | RH ágil para o administrador: folga de domingo, feriados, corrigir ponto, dar folga, funcionário doente (atestado) em poucos toques, e tudo também pelo Jhon | BACKLOG | 3 | – | – | 0 |
| [[HDEV-018]] | Perfil do funcionário (estilo rede social): dados, documentos, vida pessoal, histórico de ponto, folgas, atestados e recibos numa página só | BACKLOG | 3 | – | – | 0 |
<!-- hefisto-agent:indice:fim -->
