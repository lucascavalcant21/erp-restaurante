/* ═══════════════════════════════════════════════════════════════════════════
   OP-CONTEUDO-1 · FOTOS, VÍDEOS E DETALHES NOS PROCEDIMENTOS DA CASA

   STATUS: APLICADA no banco do restaurante (sezccspqxgklicfndwxx) em 24/11/2026 com o OK do dono (BLQ-024: um sistema só). Antes: ESCRITA, NÃO APLICADA. É do SISTEMA DE TESTE (branch hefisto-teste):
   o banco do restaurante não recebe. Aplicar no banco de teste depois que a
   estrutura for copiada para ele (ACESSO-008).

   PEDIDO DO DONO (14/11/2026): o Nico ensina a usar e limpar cada equipamento
   (liquidificador: 110 ou 220 V, como usar, como higienizar, onde guardar),
   a limpeza da chapa, do fogão e do piso (qual produto, quanto) e o
   fechamento do restaurante passo a passo, com fotos e vídeos.

   FAZ (uma transação; só aditiva):
     op_processos.conteudo jsonb: tipo do procedimento (resolver, rotina,
       limpeza, equipamento), dados do equipamento (voltagem, onde fica,
       cuidados), apelidos ("fechar", "fechamento") e a foto ou vídeo de capa.
     op_itens.conteudo jsonb: por passo, o detalhe, o produto, a quantidade,
       fotos e vídeos e o procedimento que o passo abre ("Limpar o forno" →
       "Limpeza do forno").
   As duas colunas nascem com '{}' e só aceitam objeto JSON. As políticas
   (RLS) das tabelas não mudam: valem para as colunas novas.
   NÃO FAZ: não mexe em execução de checklist nem em procedimento existente
   (os antigos continuam iguais, com conteudo vazio).

   Os arquivos (fotos e vídeos) ficam no bucket `anexos`, como os vídeos de
   treinamento que o Héfisto já tem: é material de ensino da equipe, não dado
   pessoal. Não filme cliente nem documento.

   VERIFICAÇÃO: o select do fim devolve 09d81d652d476b94c5b327e76440869b
   (conferida no PGlite por app/lib/procedimentos-conteudo-banco.test.mjs).

   ROLLBACK (não rodar sem decisão do dono; perde fotos, vídeos e detalhes):
     alter table public.op_itens drop column if exists conteudo;
     alter table public.op_processos drop column if exists conteudo;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.op_processos') is null or to_regclass('public.op_itens') is null then
    raise exception 'OP-CONTEUDO-1: faltam op_processos ou op_itens. Nada foi alterado.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
               and table_name in ('op_processos', 'op_itens') and column_name = 'conteudo') then
    raise exception 'OP-CONTEUDO-1: a coluna conteudo já existe. Nada foi alterado.';
  end if;
end $$;

alter table public.op_processos
  add column conteudo jsonb not null default '{}'::jsonb
  constraint op_processos_conteudo_objeto check (jsonb_typeof(conteudo) = 'object' and pg_column_size(conteudo) <= 65536);

alter table public.op_itens
  add column conteudo jsonb not null default '{}'::jsonb
  constraint op_itens_conteudo_objeto check (jsonb_typeof(conteudo) = 'object' and pg_column_size(conteudo) <= 32768);

select md5(string_agg(table_name || '.' || column_name || ':' || data_type || ':' || coalesce(column_default, ''), ',' order by table_name))
         as impressao_digital
  from information_schema.columns
 where table_schema = 'public' and table_name in ('op_processos', 'op_itens') and column_name = 'conteudo';

commit;
