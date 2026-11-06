/* ROLLBACK de EVT-UNIDADE-1. Só com decisão do dono, e só com a unidade vazia. */

begin;

do $$
begin
  if exists (select 1 from public.eventos where unidade_id = 'eventos')
    or exists (select 1 from public.colaboradores where unidade_id = 'eventos')
    or exists (select 1 from public.insumos where unidade_id = 'eventos')
    or exists (select 1 from public.fichas_tecnicas where unidade_id = 'eventos') then
    raise exception 'EVT-UNIDADE-1: a unidade já tem dados. Nada foi alterado.';
  end if;
end $$;

delete from public.estoques where unidade_id = 'eventos';
delete from public.unidades where id = 'eventos';

commit;
