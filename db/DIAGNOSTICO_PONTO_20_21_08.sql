-- ─────────────────────────────────────────────────────────────────────────────
-- DIAGNÓSTICO — o que aconteceu com as batidas de 20 e 21/08/2026
--
-- Duas causas possíveis, e as duas fazem o sistema "entender outra batida":
--
--  A) A ENTRADA NÃO GRAVOU. Sem hora_entrada, o tablet volta a pedir ENTRADA.
--     A pessoa aperta achando que está batendo o intervalo e o horário do
--     intervalo entra como entrada. Causa: o botão quebrado de hoje.
--
--  B) A JORNADA DE ONTEM FICOU ABERTA. Quem não bateu a saída ontem, e entrou
--     há menos de 20h, continua na jornada da véspera de propósito (turno que
--     vira a meia-noite). A batida de hoje vai para o dia de ONTEM.
--
-- Este SELECT não altera nada. Ele nomeia o caso de cada linha para a gente
-- corrigir com precisão em vez de chutar.
-- ─────────────────────────────────────────────────────────────────────────────

select c.nome,
       p.data_referencia,
       (p.hora_entrada           at time zone 'America/Sao_Paulo')::time as entrada,
       (p.hora_saida_intervalo   at time zone 'America/Sao_Paulo')::time as saiu_int,
       (p.hora_retorno_intervalo at time zone 'America/Sao_Paulo')::time as voltou_int,
       (p.hora_saida             at time zone 'America/Sao_Paulo')::time as saida,
       p.status_jornada as status,
       p.origem_batida as origem,

       -- Horário que o contrato manda, para comparar com o que ficou gravado.
       c.horario_entrada as contrato_entrada,
       c.horario_saida   as contrato_saida,

       case
         when p.hora_entrada is null then
           'SEM ENTRADA — o tablet vai pedir ENTRADA na proxima batida'
         when p.hora_saida is null
              and p.data_referencia < current_date
              and now() - p.hora_entrada < interval '20 hours' then
           'CASO B — jornada de ontem ainda aberta: a batida de hoje cai neste dia'
         when p.hora_saida is null and p.data_referencia < current_date then
           'DIA ANTIGO SEM SAIDA — precisa fechar a mao'
         when c.horario_entrada is not null
              and abs(extract(epoch from (
                    (p.hora_entrada at time zone 'America/Sao_Paulo')::time
                    - c.horario_entrada::time)) / 60) > 60 then
           'CASO A — entrada gravada mais de 1h fora do contrato: provavelmente e o horario do INTERVALO'
         else 'parece normal'
       end as diagnostico

  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where c.unidade_id = 'seldeestrela'
   and p.data_referencia between '2026-08-20' and '2026-08-21'
 order by p.data_referencia, c.nome;
