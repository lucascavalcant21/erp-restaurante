/* ROLLBACK da IC-01 (Intelligence Core).
   USE SÓ SE A IC-01 IMPEDIR O FUNCIONAMENTO DO SISTEMA.
   ATENÇÃO: apaga a auditoria, as ações, as respostas, as preferências e as
   METAS de faturamento da inteligência. Os movimentos de estoque feitos pela
   inteligência NÃO são afetados (estão em estoque_movimentacoes_multi,
   imutável). Exporte intelligence_eventos antes, se precisar guardar o histórico.
   Só apaga tabela/função marcada como desta migração (comentário hefisto:ic-01). */
begin;

do $$
declare
  t text;
begin
  foreach t in array array['intelligence_preferencias','intelligence_feedback','intelligence_acoes','intelligence_eventos'] loop
    if to_regclass('public.' || t) is not null
       and coalesce(obj_description(to_regclass('public.' || t), 'pg_class'), '') not like 'hefisto:ic-01%' then
      raise exception 'Rollback IC-01: public.% existe mas não é da IC-01. Nada foi apagado.', t;
    end if;
  end loop;
end $$;

drop table if exists public.intelligence_preferencias;
drop table if exists public.intelligence_feedback;
drop table if exists public.intelligence_acoes;
drop trigger if exists intelligence_eventos_imutavel on public.intelligence_eventos;
drop trigger if exists intelligence_eventos_sem_truncate on public.intelligence_eventos;
drop table if exists public.intelligence_eventos;
drop function if exists public.intelligence_eventos_imutavel_trg();
commit;
