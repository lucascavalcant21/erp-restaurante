/* ═══════════════════════════════════════════════════════════════════════════
   EVENTOS-ORC-1 · COLUNAS QUE O ORÇAMENTO DE EVENTOS USA E O BANCO NÃO TEM

   STATUS: ESCRITA em 17/10/2026. NÃO APLICADA. Aplicar só com aprovação do
   dono (APR-004 em docs/brain/06_OPERACAO/APROVACOES_PENDENTES.md).

   PROBLEMA (conferido no banco real em 17/10/2026, information_schema):
   a tabela eventos não tem operacao_detalhes, historico_pagamentos,
   hora_inicio, hora_fim nem observacoes. O SQL que as criaria
   (docs/eventos-custos-equipe.sql) nunca foi aplicado. Efeito no app:
     · orçamento em etapas: "Não gravou: Could not find the
       'operacao_detalhes' column" — nada do orçamento fica salvo;
     · pagamentos do evento não gravam;
     · Agenda: "column eventos.hora_inicio does not exist" e os eventos somem;
     · duplicar evento falha.

   BACKUP: plano FREE (sem PITR). O passo 0 copia a tabela eventos para
   backup_eventos_eventos_orc_1_20261017, fora da API (RLS sem política e sem
   grant), dentro da mesma transação.

   FAZ (uma transação; só aditiva):
     0. backup_eventos_eventos_orc_1_20261017
     1. eventos.operacao_detalhes    jsonb default '{}'  (orçamento + resumo do funil)
     2. eventos.historico_pagamentos jsonb default '[]'  (sinal e parcelas recebidas)
     3. eventos.hora_inicio          text                (HH:MM, do campo de hora)
     4. eventos.hora_fim             text                (HH:MM)
     5. eventos.observacoes          text                (pedido do cliente)
   As horas ficam em texto de propósito: um valor fora do formato não pode
   derrubar a gravação do orçamento inteiro (o app grava tudo num update só).
   NÃO FAZ: não altera linha existente além do default das colunas novas, não
   mexe em RLS, policy, grant, função nem trigger da tabela eventos.

   VERIFICAÇÃO: o select do fim lista as cinco colunas e a impressão digital
   (md5 de nome:tipo:default) deve ser 3ae8f62e5382a8a442f21fa488369feb — o
   valor real é conferido no teste app/lib/evento-banco.test.mjs.

   ROLLBACK (não rodar sem decisão do dono; apaga o que foi gravado nelas):
     alter table public.eventos
       drop column if exists observacoes, drop column if exists hora_fim,
       drop column if exists hora_inicio, drop column if exists historico_pagamentos,
       drop column if exists operacao_detalhes;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- Preflight: aborta sem mudar nada se a tabela não existe ou se alguma coluna
-- já existe com outro tipo (aí é outro banco, não este).
do $$
declare
  r record;
begin
  if to_regclass('public.eventos') is null then
    raise exception 'EVENTOS-ORC-1: tabela eventos não existe. Nada foi alterado.';
  end if;
  for r in
    select c.column_name, c.data_type, e.tipo
      from information_schema.columns c
      join (values ('operacao_detalhes', 'jsonb'), ('historico_pagamentos', 'jsonb'),
                   ('hora_inicio', 'text'), ('hora_fim', 'text'), ('observacoes', 'text')) e(coluna, tipo)
        on e.coluna = c.column_name
     where c.table_schema = 'public' and c.table_name = 'eventos' and c.data_type <> e.tipo
  loop
    raise exception 'EVENTOS-ORC-1: eventos.% já existe como % (esperado %). Nada foi alterado.', r.column_name, r.data_type, r.tipo;
  end loop;
end $$;

create table if not exists public.backup_eventos_eventos_orc_1_20261017 as table public.eventos;
-- cópia fora da API: RLS ligado sem política e sem grant para o app
alter table public.backup_eventos_eventos_orc_1_20261017 enable row level security;
revoke all on public.backup_eventos_eventos_orc_1_20261017 from anon, authenticated;

alter table public.eventos add column if not exists operacao_detalhes jsonb default '{}'::jsonb;
alter table public.eventos add column if not exists historico_pagamentos jsonb default '[]'::jsonb;
alter table public.eventos add column if not exists hora_inicio text;
alter table public.eventos add column if not exists hora_fim text;
alter table public.eventos add column if not exists observacoes text;

comment on column public.eventos.operacao_detalhes is 'Orçamento em etapas (orcamento) e resumo para o funil (resumo). EVENTOS-ORC-1.';
comment on column public.eventos.historico_pagamentos is 'Pagamentos recebidos do cliente: [{data, valor, forma, obs}]. EVENTOS-ORC-1.';
comment on column public.eventos.hora_inicio is 'Hora de início, HH:MM. EVENTOS-ORC-1.';
comment on column public.eventos.hora_fim is 'Hora de término, HH:MM. EVENTOS-ORC-1.';
comment on column public.eventos.observacoes is 'Observações do pedido do cliente. EVENTOS-ORC-1.';

commit;

-- Verificação (só leitura)
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'eventos'
   and column_name in ('operacao_detalhes', 'historico_pagamentos', 'hora_inicio', 'hora_fim', 'observacoes')
 order by column_name;

select md5(string_agg(column_name || ':' || data_type || ':' || coalesce(column_default, ''), '|' order by column_name)) as impressao_digital
  from information_schema.columns
 where table_schema = 'public' and table_name = 'eventos'
   and column_name in ('operacao_detalhes', 'historico_pagamentos', 'hora_inicio', 'hora_fim', 'observacoes');
