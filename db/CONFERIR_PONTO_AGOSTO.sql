/*
 CONFERENCIA DO PONTO DE AGOSTO - 13 a 30/08/2026

 So LE. Nao altera nada, nao apaga nada. Pode rodar quantas vezes quiser.

 Serve para conferir se as correcoes de agosto entraram certas. Mostra, para
 as seis pessoas, todo dia que tem alguma coisa: ponto, atestado ou folga.
 Dia vazio (nao trabalhou, sem atestado, sem folga) nao aparece -- senao
 seriam 108 linhas e o que importa se perderia no meio.

 A coluna SITUACAO e o que interessa. Se vier tudo 'ok', esta certo. Ela
 acusa tres coisas:

   >>> CONFLITO: ponto num dia de atestado
       Sobrou batida num dia que virou atestado. Os dois se contradizem: um
       diz que trabalhou, o outro que nao. A batida tem que sair.

   >>> ENTRADA ANTES DAS 15:40
       Entrada fora do horario da casa. Domingo nao e acusado, porque no
       domingo Cedeine entra 9h e Eduarda 11h.

   >>> SEM SAIDA
       Comecou o dia e nao fechou. Fica sem jornada calculada na folha.

 Os horarios saem no fuso de Brasilia. As colunas do banco sao timestamptz
 (guardam o instante, nao o relogio), entao sem converter o Supabase mostraria
 3 horas a menos e tudo pareceria errado.
*/
with gente as (
  select id, nome from public.colaboradores
   where nome ilike 'ALICE%' or nome ilike '%ANDREY%' or nome ilike 'BRENDA%'
      or nome ilike 'CEDEINE%' or nome ilike 'EDUARDA%' or nome ilike 'LARISSA DA SILVA%'
),
dias as (
  -- generate_series com date nao existe: precisa do ::timestamp.
  select d::date as dia
    from generate_series('2026-08-13'::timestamp, '2026-08-30'::timestamp, '1 day') d
)
select g.nome,
       to_char(x.dia, 'DD/MM') as dia,
       case extract(dow from x.dia)
         when 0 then 'dom' when 1 then 'seg' when 2 then 'ter' when 3 then 'qua'
         when 4 then 'qui' when 5 then 'sex' else 'sab' end as sem,
       to_char(r.hora_entrada            at time zone 'America/Sao_Paulo', 'HH24:MI') as entrada,
       to_char(r.hora_saida_intervalo    at time zone 'America/Sao_Paulo', 'HH24:MI') as sai_int,
       to_char(r.hora_retorno_intervalo  at time zone 'America/Sao_Paulo', 'HH24:MI') as volta_int,
       to_char(r.hora_saida              at time zone 'America/Sao_Paulo', 'HH24:MI') as saida,
       case when a.id is not null then 'ATESTADO' else '' end as atestado,
       case when f.id is not null then 'FOLGA'    else '' end as folga,
       case
         when a.id is not null and r.id is not null then '>>> CONFLITO: ponto num dia de atestado'
         when r.hora_entrada is not null
          and (r.hora_entrada at time zone 'America/Sao_Paulo')::time < time '15:40'
          and extract(dow from x.dia) <> 0                       then '>>> ENTRADA ANTES DAS 15:40'
         when r.hora_entrada is not null and r.hora_saida is null then '>>> SEM SAIDA'
         else 'ok' end as situacao
  from gente g
  cross join dias x
  left join public.registro_ponto r
         on r.colaborador_id = g.id and r.data_referencia = x.dia
  left join public.rh_atestados a
         on a.colaborador_id = g.id and x.dia between a.data_inicio and a.data_fim
  left join public.rh_folgas_esporadicas f
         on f.colaborador_id = g.id and f.data_folga = x.dia
 where r.id is not null or a.id is not null or f.id is not null
 order by g.nome, x.dia;
