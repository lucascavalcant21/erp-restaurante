/* ROLLBACK da CONS-2 (teleconsulta). NÃO RODAR sem decisão do dono:
   apaga os consentimentos de telemedicina, que fazem parte do registro do
   paciente. Exporte antes (contagem + hash) e guarde fora do banco. */

begin;
drop function if exists public.cons_aceitar_termo(text, text);
drop function if exists public.cons_convite_teleconsulta(text);
drop table if exists public.cons_consentimentos;
drop table if exists public.cons_teleconsultas;
drop function if exists public.cons_conferir_tele();
alter table public.cons_consultas drop constraint if exists cons_consultas_modalidade_ck;
alter table public.cons_consultas drop column if exists modalidade;
commit;
