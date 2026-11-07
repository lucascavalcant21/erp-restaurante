/* ═══════════════════════════════════════════════════════════════════════════
   SINAL-2 · HORÁRIO DE FUNCIONAMENTO DA TV

   STATUS: APLICADA em 07/11/2026 (~20:20, horário de Brasília) com aprovação
   do dono no chat ("vamos fazer essa mudança no horário de funcionamento da
   tv"), APR-023. Conferido no banco real: coluna jsonb nula em todas as
   telas; authenticated sem leitura. Testada no PGlite (sinalizacao-banco.test.mjs).

   POR QUÊ: o dono quer que a TV fique com a tela preta sozinha fora do
   horário (ex.: das 10:00 às 23:00), sem ninguém precisar pausar à mão.

   FAZ (uma transação; só aditiva):
     1. sinal_telas.horario jsonb — { inicio: "HH:MM", fim: "HH:MM", dias: [0..6] }
        ou null (sempre ligada). Validação de conteúdo no servidor
        (app/lib/sinalizacao.mjs, normalizarHorario).
   NÃO FAZ: não muda nenhuma linha existente (todas ficam null = como hoje),
   não mexe em RLS, policy nem grant (sinal_telas segue só do servidor).

   VERIFICAÇÃO: o select do fim devolve a coluna nova.
   ROLLBACK (não rodar sem decisão do dono; os horários configurados somem):
     alter table public.sinal_telas drop column if exists horario;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.sinal_telas') is null then
    raise exception 'SINAL-2: sinal_telas ausente (SINAL-1 não aplicada). Nada foi alterado.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sinal_telas' and column_name = 'horario') then
    raise exception 'SINAL-2: coluna horario já existe (já aplicada?). Nada foi alterado.';
  end if;
end $$;

alter table public.sinal_telas
  add column horario jsonb check (horario is null or jsonb_typeof(horario) = 'object');

commit;

-- Verificação (só leitura)
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'sinal_telas' and column_name = 'horario';
