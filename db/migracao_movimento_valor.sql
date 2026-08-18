-- ─────────────────────────────────────────────────────────────────────────────
-- PREÇO TRAVADO NO DIA DA MOVIMENTAÇÃO
--
-- Sem isto, "Compras do mês" e o consumo de estoque são calculados pelo custo
-- ATUAL do ingrediente: mudou o preço hoje, as compras antigas mudam junto.
-- Guardando o valor no próprio movimento, cada entrada fica valendo o que
-- valia no dia — e o histórico para de se mexer sozinho.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.estoque_movimentacoes_multi
  add column if not exists valor_unitario numeric(14,4);

alter table public.estoque_movimentacoes_multi
  add column if not exists valor_total numeric(14,2);

-- Preenche o histórico já existente com o custo atual do ingrediente. É o
-- melhor palpite possível para o que já passou; daqui para frente o valor é
-- gravado no momento da movimentação.
update public.estoque_movimentacoes_multi m
   set valor_unitario = coalesce(i.custo_compra, i.custo_unitario, 0),
       valor_total    = round((coalesce(i.custo_compra, i.custo_unitario, 0) * coalesce(m.quantidade, 0))::numeric, 2)
  from public.insumos i
 where i.id = m.insumo_id
   and m.valor_unitario is null;

create index if not exists idx_mov_multi_data_tipo
  on public.estoque_movimentacoes_multi (unidade_id, tipo, data_movimento desc);
