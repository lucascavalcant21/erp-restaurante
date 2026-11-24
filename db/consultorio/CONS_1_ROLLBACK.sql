/* ROLLBACK da CONS-1 (consultório). NÃO RODAR sem decisão do dono:
   apaga pacientes, consultas e fichas gravadas. Antes, exporte os dados
   (contagem + hash por tabela) e guarde o backup fora do banco. */

begin;
drop function if exists public.cons_fichas_do_paciente(uuid);
drop table if exists public.cons_acessos;
drop table if exists public.cons_fichas;
drop table if exists public.cons_consultas;
drop table if exists public.cons_pacientes;
drop table if exists public.cons_convenios;
drop table if exists public.cons_tipos_consulta;
drop function if exists public.cons_registrar_ficha();
drop function if exists public.cons_conferir_unidade();
drop function if exists public.cons_tocar();
drop function if exists public.cons_pode_acessar(text);
delete from public.unidades u where u.id = 'consultorio'
  and not exists (select 1 from public.usuarios_erp x where x.unidade_principal_id = 'consultorio')
  and not exists (select 1 from public.usuario_escopos e where e.unidade_id = 'consultorio');
commit;
