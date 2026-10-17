---
name: hefisto-eventos
description: Reservas e eventos do Héfisto (funil, orçamento em etapas, cardápio do evento, equipe, aluguel, custo, preço, DRE do evento, lista de compras). Use ao mexer em app/dashboard/eventos, reservas-eventos, eventos.js, evento-orcamento.mjs ou evento-financeiro.mjs.
---

# Eventos

Para testar e publicar, siga `hefisto-entrega`. Se mexer em banco, `hefisto-seguranca-supabase`.

## Regras

- **Fonte única das contas:**
  - `app/lib/evento-orcamento.mjs`: etapas tipo → cardápio → equipe → aluguel → cliente → custos e preço → DRE → orçamento;
  - `app/lib/evento-financeiro.mjs`: funil, custo, preço e lista de compras.
  - Ambos são funções puras.
- O custo do prato vem das fichas (`ficha-calculos.mjs`, `custo-rendimento.mjs`), nunca de fórmula própria.
- O orçamento mora em `eventos.operacao_detalhes.orcamento` (JSON). Não precisa de tabela nova, mas a coluna (e `historico_pagamentos`, `hora_inicio`, `hora_fim`, `observacoes`) só existe no banco real depois de `db/EVENTOS_ORC_1_COLUNAS_DO_ORCAMENTO.sql` (APR-012). Sem ela, a tela avisa (`bancoSemOrcamento`, `mensagemErroEvento`) em vez de quebrar.
- Telas: `/dashboard/reservas-eventos` em três áreas (Funil, Agenda, Reservas; barra no `layout.js`). A tela do evento fica fora da barra. Regras da lista de reservas em `reservas-lista.mjs`.
- Fichas exclusivas do evento ficam só dentro do orçamento e não entram nas fichas do restaurante.
- O DRE do evento é só dele: não lê nem escreve o DRE da casa.
- O orçamento que vai para o cliente mostra só preço. Custo e margem ficam no interno.

## Testes

`node --test app/lib/evento-orcamento.test.mjs app/lib/evento-financeiro.test.mjs`

## Precisa do dono

Enviar orçamento ou mensagem ao cliente, lançar sinal ou pagamento do evento no financeiro (veja `hefisto-financeiro`).
