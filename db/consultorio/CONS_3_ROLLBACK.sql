/* ROLLBACK da CONS-3 (portal do paciente). NÃO RODAR sem decisão do dono:
   desliga o login dos pacientes do consultório e apaga as orientações
   escritas nas fichas. Exporte antes (contagem + hash). Os logins dos
   pacientes no Auth continuam e precisam ser removidos à parte. */

begin;
drop function if exists public.cons_paciente_resumos();
drop function if exists public.cons_paciente_cancelar(uuid);
drop function if exists public.cons_paciente_marcar(uuid, timestamptz, text, text);
drop function if exists public.cons_paciente_horarios(uuid, date);
drop function if exists public.cons_paciente_tipos();
drop function if exists public.cons_paciente_consultas();
drop function if exists public.cons_paciente_eu();
drop function if exists public.cons_eu_paciente();
drop index if exists public.cons_pacientes_login_unico;
drop index if exists public.cons_pacientes_auth_unico;
alter table public.cons_fichas drop column if exists orientacoes;
alter table public.cons_pacientes drop column if exists login;
alter table public.cons_pacientes drop column if exists auth_user_id;
commit;
