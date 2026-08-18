-- ─────────────────────────────────────────────────────────────────────────────
-- PREÇO POR FORNECEDOR NO INGREDIENTE
-- Um ingrediente é único, mas pode ter vários fornecedores, cada um com seu
-- próprio preço (e embalagem). O fornecedor "atual" (insumos.fornecedor_atual_id)
-- define o custo usado nas fichas/estoque. O histórico por fornecedor já é
-- suportado por insumos_precos_historico (coluna fornecedor_id).
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Colunas de preço na tabela de vínculo insumo↔fornecedor.
alter table public.insumos_fornecedores add column if not exists unidade_id         text;
alter table public.insumos_fornecedores add column if not exists preco              numeric(14,4);
alter table public.insumos_fornecedores add column if not exists tamanho_embalagem  numeric(14,4);
alter table public.insumos_fornecedores add column if not exists unidade_embalagem  text;
alter table public.insumos_fornecedores add column if not exists preco_normalizado  numeric(16,6);
alter table public.insumos_fornecedores add column if not exists atualizado_em      timestamptz default now();

-- Um fornecedor só pode aparecer uma vez por ingrediente (evita duplicidade).
create unique index if not exists uidx_insumo_fornecedor
  on public.insumos_fornecedores (insumo_id, fornecedor_id);

-- (Opcional / recomendado) Evita DOIS ingredientes com o mesmo nome no mesmo
-- setor da mesma unidade. Usa nome normalizado (minúsculo, sem espaços nas pontas).
-- Comentado por segurança: só habilite depois de conferir que não há duplicados
-- hoje — senão a criação do índice falha. A trava principal já é feita no app.
-- create unique index if not exists uidx_insumo_nome_setor
--   on public.insumos (unidade_id, departamento, lower(btrim(nome)))
--   where coalesce(ativo, true) = true;
