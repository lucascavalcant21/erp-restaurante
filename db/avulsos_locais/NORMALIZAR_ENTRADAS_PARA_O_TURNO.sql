/*
 ENTRADA GRAVADA ANTES DO TURNO PASSA A SER A HORA DO TURNO
 Todos os funcionarios, todos os dias.

 O QUE FAZ
 Toda entrada batida ANTES da hora contratada vira a hora contratada. Quem
 bateu 15:39 num turno de 15:40 fica 15:40. Quem bateu 15:47 nao e tocado --
 atraso continua atraso.

 NAO E UM 15:40 CEGO. O horario sai do cadastro de cada pessoa, na ordem:
   1. horarios_dia[dia da semana].e   (jornada por dia, quando ligada)
   2. horario_dom_entrada             (so no domingo)
   3. horario_entrada                 (o fixo)
   4. 15:40                           (padrao da casa, se nao houver cadastro)
 Sem isso, quem entra 11h no domingo (Eduarda) teria o domingo empurrado para
 15:40 e perderia 4h40 de trabalho de verdade.

 ANTES DE RODAR: a primeira consulta abaixo MOSTRA o que sera alterado, sem
 alterar nada. Rode ela sozinha, confira a lista, e so entao rode o bloco.

 O QUE ISSO CUSTA (leia uma vez)
 O art. 74, II da CLT (Portaria MTP 671/2021) exige a hora real e proibe
 horario predeterminado. Reescrever as batidas em massa e o que um advogado
 usa para derrubar o valor probatorio do controle inteiro -- inclusive dos
 dias em que a empresa esta certa. O sistema ja desconta a antecipacao no
 CALCULO, entao o efeito na folha e o mesmo sem mexer no registro.
 Este script existe porque o proprietario pediu, ciente disso.

 O livro guarda o valor anterior de cada ajuste, entao da para provar o que
 foi mudado e desfazer.

 Rodar de novo nao muda nada: depois da primeira vez nenhuma entrada esta
 antes do turno.

 Como rodar: cole no SQL Editor do Supabase.
*/

/* ────────────────────────────────────────────────────────────────────────
   1) PREVIA -- nao altera nada. Rode sozinha primeiro.
   ──────────────────────────────────────────────────────────────────────── */
with alvo as (
  select
    p.id, c.nome, p.data_referencia,
    (p.hora_entrada at time zone 'America/Sao_Paulo')          as batida_local,
    coalesce(
      case when coalesce(c.horario_por_dia, false)
           then nullif(c.horarios_dia -> (extract(dow from p.data_referencia))::int::text ->> 'e', '') end,
      case when extract(dow from p.data_referencia) = 0
           then nullif(c.horario_dom_entrada, '') end,
      nullif(c.horario_entrada, ''),
      '15:40'
    )::time as turno
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where p.hora_entrada is not null
)
select nome,
       to_char(data_referencia, 'DD/MM/YYYY') as dia,
       batida_local::time                     as bateu,
       turno                                  as vai_ficar
  from alvo
 where batida_local::time < turno
 order by nome, data_referencia;


/* ────────────────────────────────────────────────────────────────────────
   2) A ALTERACAO. Rode depois de conferir a lista acima.
   ──────────────────────────────────────────────────────────────────────── */
do $$
declare
  v_autor     text := 'Normalizacao de entrada para o turno (SQL Editor)';
  v_tem_livro boolean;
  r           record;
  v_nova      timestamptz;
  v_alterados int := 0;
begin
  select to_regclass('public.ponto_marcacao') is not null into v_tem_livro;

  for r in
    select p.id as reg_id, p.colaborador_id, p.unidade_id, p.data_referencia,
           p.hora_entrada as antes,
           (p.hora_entrada at time zone 'America/Sao_Paulo') as batida_local,
           coalesce(
             case when coalesce(c.horario_por_dia, false)
                  then nullif(c.horarios_dia -> (extract(dow from p.data_referencia))::int::text ->> 'e', '') end,
             case when extract(dow from p.data_referencia) = 0
                  then nullif(c.horario_dom_entrada, '') end,
             nullif(c.horario_entrada, ''),
             '15:40'
           )::time as turno
      from public.registro_ponto p
      join public.colaboradores c on c.id = p.colaborador_id
     where p.hora_entrada is not null
  loop
    continue when r.batida_local::time >= r.turno;

    /* A hora do turno no MESMO dia da batida, de volta para timestamptz. */
    v_nova := (r.batida_local::date + r.turno) at time zone 'America/Sao_Paulo';

    if v_tem_livro then
      insert into public.ponto_marcacao
        (unidade_id, colaborador_id, tipo, tipo_alvo, marcado_em, data_referencia,
         origem, coletor, valor_anterior, registrado_por)
      select r.unidade_id, r.colaborador_id, 'ajuste', 'entrada', v_nova, r.data_referencia,
             'ajuste', '05', r.antes, v_autor
       where not exists (
         select 1 from public.ponto_marcacao m
          where m.colaborador_id = r.colaborador_id
            and m.data_referencia = r.data_referencia
            and m.tipo = 'ajuste'
            and m.tipo_alvo = 'entrada'
            and m.marcado_em = v_nova
       );
    end if;

    update public.registro_ponto set hora_entrada = v_nova where id = r.reg_id;
    v_alterados := v_alterados + 1;
  end loop;

  raise notice 'Entradas ajustadas: %', v_alterados;
end $$;


/* ────────────────────────────────────────────────────────────────────────
   3) CONFERENCIA -- tem que voltar ZERO linhas.
   ──────────────────────────────────────────────────────────────────────── */
select c.nome, to_char(p.data_referencia, 'DD/MM') as dia,
       (p.hora_entrada at time zone 'America/Sao_Paulo')::time as ainda_antes_do_turno
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where p.hora_entrada is not null
   and (p.hora_entrada at time zone 'America/Sao_Paulo')::time < coalesce(
         case when coalesce(c.horario_por_dia, false)
              then nullif(c.horarios_dia -> (extract(dow from p.data_referencia))::int::text ->> 'e', '') end,
         case when extract(dow from p.data_referencia) = 0
              then nullif(c.horario_dom_entrada, '') end,
         nullif(c.horario_entrada, ''),
         '15:40'
       )::time;
