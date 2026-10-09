/* WA-001 · ROLLBACK (só com o dono): remove a fila do WhatsApp.
   DESTRUTIVO para o histórico da fila (comandos e respostas). Não toca em
   nenhuma outra tabela. Depois disso os comandos do agente pelo WhatsApp
   respondem "fila indisponível"; as perguntas sobre a empresa continuam. */
begin;
set local lock_timeout = '5s';
drop function if exists public.whatsapp_pegar_comandos(int);
drop table if exists public.whatsapp_comandos;
drop table if exists public.whatsapp_ponte;
commit;
