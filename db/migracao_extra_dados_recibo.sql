-- ─────────────────────────────────────────────────────────────────────────────
-- DADOS DO RECIBO NO CADASTRO DO EXTRA
-- Tudo que o Recibo de Trabalho Extra precisa passa a viver no cadastro da
-- pessoa. Ao gerar o recibo, os campos já vêm preenchidos — sem redigitar.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.colaboradores add column if not exists topicos_funcao      text;    -- o que a pessoa faz no dia (vai impresso no recibo)
alter table public.colaboradores add column if not exists itens_emprestados   text;    -- itens entregues, separados por vírgula
alter table public.colaboradores add column if not exists forma_pagamento     text;    -- Pix, Dinheiro, Transferência...
alter table public.colaboradores add column if not exists vale_transporte_val numeric(12,2); -- valor padrão de VT por diária
alter table public.colaboradores add column if not exists setor_entrega       text;    -- setor onde se apresenta
alter table public.colaboradores add column if not exists janta_ofertada      boolean default true;
