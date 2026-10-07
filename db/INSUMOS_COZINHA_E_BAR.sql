/* ═══════════════════════════════════════════════════════════════════════════
   INGREDIENTE NA COZINHA, NO BAR OU NOS DOIS (um cadastro só)

   STATUS: PROPOSTA. Rodar só com aprovação do dono. Só ACRESCENTA uma coluna
   vazia; nenhum ingrediente muda até alguém marcar "Cozinha e bar" na tela.
   Pode rodar de novo.

   - insumos.departamentos (text[]): nulo = só o setor de sempre (coluna
     departamento); ["cozinha","bar"] = o mesmo cadastro aparece nas listas e
     fichas dos dois setores. Mesmo preço e fornecedor; o estoque continua
     separado por local (estoque_itens), como já era.
   - Só aceita "cozinha" e "bar".
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

alter table public.insumos add column if not exists departamentos text[];
comment on column public.insumos.departamentos is 'setores em que o ingrediente aparece além do principal (departamento); nulo = só o principal';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'insumos_departamentos_check') then
    alter table public.insumos add constraint insumos_departamentos_check
      check (departamentos is null or departamentos <@ array['cozinha', 'bar']::text[]);
  end if;
end $$;

commit;


/* ── CONFERÊNCIA (só leitura) ─────────────────────────────────────────────────
select 'coluna' as o_que, data_type as resultado from information_schema.columns
 where table_schema = 'public' and table_name = 'insumos' and column_name = 'departamentos'
union all select 'regra', conname from pg_constraint where conname = 'insumos_departamentos_check'
union all select 'ingredientes marcados nos dois', count(*)::text from public.insumos where departamentos is not null;
   ──────────────────────────────────────────────────────────────────────────── */
