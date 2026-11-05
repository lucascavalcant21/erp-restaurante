/* Desfaz a MARM-UNIDADE-1. Só com decisão do dono. Aborta se a unidade já tiver dados. */
begin;
do $$
begin
  if exists (select 1 from public.insumos where unidade_id = 'marmitaria') or exists (select 1 from public.fichas_tecnicas where unidade_id = 'marmitaria')
     or exists (select 1 from public.estoque_movimentacoes_multi where unidade_id = 'marmitaria') then
    raise exception 'MARM-UNIDADE-1: a unidade já tem dados. Nada foi alterado.';
  end if;
end $$;
drop function if exists public.marmitaria_conferir_senha(text, text);
drop function if exists public.marmitaria_definir_senha(text, text);
drop function if exists public.marmitaria_senha_definida(text);
drop function if exists public._marmitaria_ve_unidade(text);
delete from public.estoque_seguranca where unidade_id = 'marmitaria';
delete from public.estoques where unidade_id = 'marmitaria';
delete from public.unidades where id = 'marmitaria';
commit;
