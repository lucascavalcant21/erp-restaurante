/* WA-002 · ROLLBACK (só com o dono): remove a trilha de auditoria do WhatsApp.
   DESTRUTIVO para o histórico de eventos do canal. Não toca em nenhuma outra
   tabela. Depois disso o canal continua funcionando; a auditoria volta a ficar
   só nos logs da Vercel. */
begin;
set local lock_timeout = '5s';
drop table if exists public.whatsapp_eventos;
commit;
