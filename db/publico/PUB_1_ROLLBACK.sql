/* ROLLBACK da PUB-1 — SÓ COM DECISÃO DO DONO. Apaga os pedidos de cadastro.
   Exporte os pedidos antes (select * from public.hefisto_pedidos_cadastro). */
begin;
drop function if exists public.hefisto_pedir_cadastro(text,text,text,text,text,text,text,text,boolean);
drop table if exists public.hefisto_pedidos_cadastro;
drop function if exists public.hefisto_pedidos_tocar();
drop function if exists public.hefisto_eh_admin_plataforma();
drop table if exists public.hefisto_admins_plataforma;
commit;
