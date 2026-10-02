/*
 ENTRADA BATIDA ÀS 15:39 PASSA A SER 15:40
 Todos os funcionários da unidade, todos os dias.

 O QUE FAZ
 Toda ENTRADA gravada no minuto 15:39 (15:39:00 a 15:39:59) vira 15:40:00 do
 mesmo dia. Só a entrada: intervalo e saída não são tocados. Só o minuto
 15:39: quem bateu 15:38 ou antes fica como está.

 DIFERENÇA PARA db/NORMALIZAR_ENTRADAS_PARA_O_TURNO.sql
 Aquele leva QUALQUER entrada antes do turno para a hora do turno - inclusive
 a entrada antecipada liberada pelo gerente (reunião), que já virou hora extra
 no banco. Este mexe só no 15:39, que é o caso pedido.

 ANTES DE RODAR: a primeira consulta MOSTRA o que será alterado, sem alterar
 nada. Rode ela sozinha e confira a lista. A coluna "turno" mostra o horário
 de cada pessoa: se aparecer alguém cujo turno NÃO é 15:40, olhe antes.

 O QUE ISSO CUSTA (o mesmo aviso do NORMALIZAR)
 O art. 74, II da CLT (Portaria MTP 671/2021) exige a hora real. Por isso a
 correção não apaga a batida: entra um 'ajuste' no livro de marcações
 guardando a hora anterior e quem corrigiu - dá para provar o que mudou e
 desfazer. Um minuto de antecipação já não conta na folha (art. 58, §1º).

 Rodar de novo não muda nada: depois da primeira vez não sobra entrada 15:39.

 Como rodar: cole no SQL Editor do Supabase.
*/

/* ────────────────────────────────────────────────────────────────────────
   1) PRÉVIA -- não altera nada. Rode sozinha primeiro.
   ──────────────────────────────────────────────────────────────────────── */
select c.nome,
       to_char(p.data_referencia, 'DD/MM/YYYY')                               as dia,
       to_char(p.hora_entrada at time zone 'America/Sao_Paulo', 'HH24:MI:SS')  as bateu,
       coalesce(
         case when coalesce(c.horario_por_dia, false)
              then nullif(c.horarios_dia -> (extract(dow from p.data_referencia))::int::text ->> 'e', '') end,
         case when extract(dow from p.data_referencia) = 0
              then nullif(c.horario_dom_entrada, '') end,
         nullif(c.horario_entrada, ''),
         '—'
       )                                                                       as turno,
       '15:40'                                                                 as vai_ficar
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where p.unidade_id = 'seldeestrela'
   and p.hora_entrada is not null
   and date_trunc('minute', p.hora_entrada at time zone 'America/Sao_Paulo')::time = '15:39'
 order by p.data_referencia, c.nome;


/* ────────────────────────────────────────────────────────────────────────
   2) A ALTERAÇÃO. Rode depois de conferir a lista acima.
   ──────────────────────────────────────────────────────────────────────── */
do $$
declare
  v_unidade   text := 'seldeestrela';
  v_autor     text := 'Entrada 15:39 -> 15:40 (SQL Editor)';
  v_tem_livro boolean;
  r           record;
  v_nova      timestamptz;
  v_alterados int := 0;
begin
  select to_regclass('public.ponto_marcacao') is not null into v_tem_livro;
  if not v_tem_livro then
    raise notice 'ponto_marcacao não existe: só o resumo será corrigido. Rode db/migracao_ponto_nsr.sql para ter o livro legal.';
  end if;

  for r in
    select p.id as reg_id, p.colaborador_id, p.unidade_id, p.data_referencia,
           p.hora_entrada as antes,
           (p.hora_entrada at time zone 'America/Sao_Paulo') as batida_local
      from public.registro_ponto p
     where p.unidade_id = v_unidade
       and p.hora_entrada is not null
       and date_trunc('minute', p.hora_entrada at time zone 'America/Sao_Paulo')::time = '15:39'
  loop
    /* 15:40 no MESMO dia da batida, de volta para timestamptz. */
    v_nova := (r.batida_local::date + time '15:40') at time zone 'America/Sao_Paulo';

    /* Livro legal primeiro: o ajuste guarda a hora real que estava lá. */
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

  raise notice 'Entradas 15:39 ajustadas para 15:40: %', v_alterados;
end $$;


/* ────────────────────────────────────────────────────────────────────────
   3) CONFERÊNCIA -- tem que voltar ZERO linhas.
   ──────────────────────────────────────────────────────────────────────── */
select c.nome, to_char(p.data_referencia, 'DD/MM') as dia,
       to_char(p.hora_entrada at time zone 'America/Sao_Paulo', 'HH24:MI:SS') as ainda_15_39
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where p.unidade_id = 'seldeestrela'
   and p.hora_entrada is not null
   and date_trunc('minute', p.hora_entrada at time zone 'America/Sao_Paulo')::time = '15:39';
