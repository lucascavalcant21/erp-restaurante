/*
  RH-B1-2 — saída de 16/10/2026 gravada um dia depois (jornada de 32h)

  O ajuste feito em 16/10 às 23:48 pela tela "Corrigir ponto" preencheu o
  horário do contrato e gravou a saída como 17/10 23:38: a marca "saída no dia
  seguinte" ficou ligada sozinha (bug corrigido no PR #190). O colega do mesmo
  turno bateu a saída às 23:36 do dia 16, então a saída certa é 16/10 23:38.

  Como a tela faz: uma linha de AJUSTE no livro (ponto_marcacao, imutável, com
  NSR) e o resumo do dia (registro_ponto) atualizado. A marcação antiga fica.

  Preflight: se a saída gravada não for mais 17/10 23:38, aborta sem mudar nada.
  Rollback (só com decisão do dono): outro ajuste no livro de volta para
  17/10 23:38 e o mesmo UPDATE com esse valor. Nunca apagar a linha do livro.
*/

begin;

do $$
declare r registro_ponto%rowtype;
declare novo timestamptz := '2026-10-16 23:38:00-03';
begin
  select * into r from registro_ponto where id = 'f6785f24-926d-419f-9d34-68ff8fedf49c' for update;
  if r.id is null then raise exception 'RH-B1-2: registro não encontrado. Nada alterado.'; end if;
  if r.hora_saida is distinct from '2026-10-17 23:38:00-03'::timestamptz then
    raise exception 'RH-B1-2: a saída gravada mudou (%). Nada alterado.', r.hora_saida;
  end if;

  insert into ponto_marcacao (unidade_id, colaborador_id, tipo, marcado_em, data_referencia,
                              origem, valor_anterior, tipo_alvo, registrado_por, motivo)
  values (r.unidade_id, r.colaborador_id, 'ajuste', novo, r.data_referencia,
          'ajuste', r.hora_saida, 'saida_trabalho', 'Correção RH-B1 (dono, 19/10/2026)',
          'Saída 23:38 tinha sido gravada no dia seguinte por erro da tela de correção.');

  update registro_ponto set hora_saida = novo where id = r.id;
end $$;

commit;

-- Conferência (só leitura): deve mostrar 16/10 15:40 → 16/10 23:38, ~8h.
select to_char(hora_entrada at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') entrada,
       to_char(hora_saida   at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') saida,
       round(extract(epoch from hora_saida - hora_entrada) / 3600, 2) horas
  from registro_ponto where id = 'f6785f24-926d-419f-9d34-68ff8fedf49c';
