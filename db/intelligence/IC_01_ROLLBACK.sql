/* ROLLBACK da IC-01 (Intelligence Core).
   ATENÇÃO: apaga a auditoria, as ações, as respostas e as preferências da
   inteligência. Os movimentos de estoque feitos pela inteligência NÃO são
   afetados (estão em estoque_movimentacoes_multi, imutável). Exporte
   intelligence_eventos antes, se precisar guardar o histórico. */
begin;
drop table if exists public.intelligence_preferencias;
drop table if exists public.intelligence_feedback;
drop table if exists public.intelligence_acoes;
drop trigger if exists intelligence_eventos_imutavel on public.intelligence_eventos;
drop trigger if exists intelligence_eventos_sem_truncate on public.intelligence_eventos;
drop table if exists public.intelligence_eventos;
drop function if exists public.intelligence_eventos_imutavel_trg();
commit;
