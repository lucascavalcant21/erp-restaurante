/* ROLLBACK de ECO-1. Apaga as anotações: só com decisão do dono. */
begin;
drop table public.area_anotacoes;
commit;
