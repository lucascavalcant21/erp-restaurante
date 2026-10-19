/*
  RH-B1-1 — colunas que o RH já grava e o banco não tinha (aditiva, idempotente)

  Por quê:
  - Aviso prévio: registrarAvisoPrevio() grava status_aviso, em_aviso_previo,
    inicio_aviso_previo, dias_aviso_previo e tipo_aviso_previo. Sem as colunas,
    o retry descartava todas e a tela dizia "Aviso prévio registrado!" sem ter
    gravado nada (conferido no banco em 18/10/2026).
  - Cadastro: pontos_taxa (pontos na divisão da taxa de serviço) e
    tipo_transporte eram descartados a cada salvamento.

  Não mexe em linha nenhuma: só ADD COLUMN IF NOT EXISTS.

  Rollback (só com decisão do dono; apaga o que for gravado nas colunas):
    alter table public.colaboradores
      drop column if exists status_aviso, drop column if exists em_aviso_previo,
      drop column if exists inicio_aviso_previo, drop column if exists dias_aviso_previo,
      drop column if exists tipo_aviso_previo, drop column if exists pontos_taxa,
      drop column if exists tipo_transporte;
*/

do $$
begin
  if to_regclass('public.colaboradores') is null then
    raise exception 'RH-B1-1: tabela colaboradores não existe; nada foi alterado.';
  end if;
end $$;

begin;

alter table public.colaboradores
  add column if not exists status_aviso text,
  add column if not exists em_aviso_previo boolean not null default false,
  add column if not exists inicio_aviso_previo date,
  add column if not exists dias_aviso_previo integer,
  add column if not exists tipo_aviso_previo text,
  add column if not exists pontos_taxa numeric,
  add column if not exists tipo_transporte text;

do $$
declare faltando int;
begin
  select 7 - count(*) into faltando from information_schema.columns
   where table_schema = 'public' and table_name = 'colaboradores'
     and column_name in ('status_aviso','em_aviso_previo','inicio_aviso_previo',
                         'dias_aviso_previo','tipo_aviso_previo','pontos_taxa','tipo_transporte');
  if faltando <> 0 then
    raise exception 'RH-B1-1: % coluna(s) não foram criadas; desfeito.', faltando;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

-- Conferência (só leitura)
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'colaboradores'
   and column_name in ('status_aviso','em_aviso_previo','inicio_aviso_previo',
                       'dias_aviso_previo','tipo_aviso_previo','pontos_taxa','tipo_transporte')
 order by column_name;
