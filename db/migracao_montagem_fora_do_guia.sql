-- ─────────────────────────────────────────────────────────────────────────────
-- TIRAR DO GUIA DE MONTAGEM (montagem.fora_do_guia)
--
-- Por que existe: água, cerveja e refrigerante apareciam como card de DRINK no
-- guia de montagem. Tentei separar por regra — pelo tipo da ficha técnica e
-- depois por ter passo a passo escrito — e nenhuma das duas pegou, porque no
-- banco esses itens são iguaizinhos a um drink de verdade.
--
-- Em vez de continuar adivinhando, a decisão passa a ser sua e fica gravada:
-- marcou "tirar do guia", sai da lista e a sincronia com o cardápio não recria.
-- Reversível — é só desmarcar em "Fora do guia".
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.montagem add column if not exists fora_do_guia boolean not null default false;

create index if not exists idx_montagem_fora_do_guia
  on public.montagem (unidade_id, fora_do_guia);

notify pgrst, 'reload schema';
