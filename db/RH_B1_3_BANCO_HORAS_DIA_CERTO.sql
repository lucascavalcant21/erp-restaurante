/*
  RH-B1-3 — banco de horas lançado no dia seguinte

  O relógio datava o lançamento pelo dia em UTC: quem saía depois das 21h de
  Brasília ganhava a hora extra no dia seguinte (14 lançamentos até
  18/10/2026; no último dia do mês, caía no mês seguinte e furava o limite de
  8h). Corrigido no código pelo PR #190.

  Aqui: cada lançamento cuja data ficou DEPOIS do dia local em que foi criado
  volta para o dia local. Não muda minutos, tipo nem observação; não apaga nada.
  Lançamento criado depois da meia-noite não entra (a data dele já é o dia local).

  Rollback (só com decisão do dono): a tabela sec_backup_rh_b1_3 guarda id e
  data antigos; update rh_banco_horas b set data = k.data_antiga
  from sec_backup_rh_b1_3 k where k.id = b.id;
*/

begin;

create table if not exists public.sec_backup_rh_b1_3 (id uuid primary key, data_antiga date, salvo_em timestamptz default now());
revoke all on public.sec_backup_rh_b1_3 from anon, authenticated;

insert into public.sec_backup_rh_b1_3 (id, data_antiga)
select id, data from rh_banco_horas
 where data > (created_at at time zone 'America/Sao_Paulo')::date
on conflict (id) do nothing;

do $$
declare n int;
begin
  select count(*) into n from rh_banco_horas where data > (created_at at time zone 'America/Sao_Paulo')::date;
  if n > 30 then raise exception 'RH-B1-3: % lançamentos (esperado ~14). Confira antes. Nada alterado.', n; end if;
end $$;

update rh_banco_horas
   set data = (created_at at time zone 'America/Sao_Paulo')::date
 where data > (created_at at time zone 'America/Sao_Paulo')::date;

commit;

-- Conferência (só leitura): deve dar 0.
select count(*) ainda_no_dia_seguinte from rh_banco_horas
 where data > (created_at at time zone 'America/Sao_Paulo')::date;
