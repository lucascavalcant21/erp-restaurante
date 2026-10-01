/* Composição do empanamento no cadastro do ingrediente. Aditiva e idempotente.
   Aprovada pelo dono em 01/10/2026 (PARTE 2 de proposta_custo_rendimento_empanamento.sql).

   empanamento_itens  [{ "insumo_id": uuid, "quantidade": 80, "unidade": "g" }]
                      quantidades para o lote de peso_bruto_padrao; o custo de
                      cada item é lido do cadastro dele (custo atual).
   empanamento_peso_g peso que o lote ganhou (medido). Vazio = soma da composição.

   ganho_pct e custo_empanado_kg continuam existindo: o app grava neles o
   resultado da composição, e é deles que a ficha técnica e a produção leem. */

alter table public.insumos add column if not exists empanamento_itens  jsonb;
alter table public.insumos add column if not exists empanamento_peso_g numeric(12,3);

notify pgrst, 'reload schema';
