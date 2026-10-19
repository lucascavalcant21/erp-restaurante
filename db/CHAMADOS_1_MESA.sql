/* ═══════════════════════════════════════════════════════════════════════════
   CHAMADOS-1 · CHAMAR GARÇOM E PEDIR A CONTA PELO QR DA MESA

   STATUS: NÃO APLICADA. Aguarda o dono (APR-015 em
   docs/brain/06_OPERACAO/APROVACOES_PENDENTES.md). Testada no PGlite
   (app/lib/chamados-banco.test.mjs).

   POR QUÊ: o cardápio digital no modo mesa (QR da mesa, pedido do dono de
   18/10, estudo do Goomer) ganhou os botões "Chamar garçom" e "Pedir a
   conta". O servidor e a tela do Salão (Salão → Mesas → Chamados Mesas) já
   existiam, mas a tabela nunca foi criada no banco real (conferido em
   19/10/2026: to_regclass('public.experience_chamados') = null). Sem ela o
   cliente vê "acene para a equipe" e nada chega ao salão.

   FAZ (uma transação; só aditiva — não altera nenhuma linha existente):
     1. tabela experience_chamados (o nome que o servidor já usa): mesa,
        tipo (garcom, agua, talheres, guardanapos, limpeza, conta, duvida),
        status (pendente → em_atendimento → concluido | cancelado), quem
        pediu, observação e quem atendeu, com limites de tamanho;
     2. no máximo UM chamado aberto por mesa e tipo (índice único parcial):
        o cliente tocar dez vezes não vira dez chamados;
     3. RLS: a equipe só vê e muda chamados das unidades dela (mesma regra
        de pedidos, sec_unidade); anônimo não lê nem grava nada. O cliente
        chama pelo servidor (service_role), que confere unidade e limite.
   NÃO FAZ: não mexe em pedidos, mesas, produtos nem em nenhuma tabela
   existente; não cria policy aberta; não muda RLS de tabela existente.
   BACKUP: desnecessário (nenhuma linha existente é tocada).

   VERIFICAÇÃO: o select do fim devolve a impressão digital (colunas,
   índices e policy). Esperado: 479c60f3e90fae069d1b785189a8ce22 (conferido no PGlite por
   app/lib/chamados-banco.test.mjs).

   ROLLBACK (não rodar sem decisão do dono; os chamados gravados somem):
     drop table if exists public.experience_chamados;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- Preflight: aborta sem mudar nada.
do $$
begin
  if to_regclass('public.unidades') is null or to_regclass('public.mesas') is null then
    raise exception 'CHAMADOS-1: tabela unidades ou mesas ausente. Nada foi alterado.';
  end if;
  if to_regprocedure('public.hefisto_ve_todas_unidades()') is null or to_regprocedure('public.hefisto_unidades_do_usuario()') is null then
    raise exception 'CHAMADOS-1: funções de acesso por unidade ausentes. Nada foi alterado.';
  end if;
  if to_regclass('public.experience_chamados') is not null then
    raise exception 'CHAMADOS-1: experience_chamados já existe (já aplicada?). Nada foi alterado.';
  end if;
end $$;

-- 1. Chamados ------------------------------------------------------------------
create table public.experience_chamados (
  id               uuid primary key default gen_random_uuid(),
  unidade_id       text not null references public.unidades(id) on delete cascade,
  mesa_id          uuid references public.mesas(id) on delete set null,
  mesa_numero      text not null check (char_length(mesa_numero) between 1 and 10),
  tipo             text not null default 'garcom'
                   check (tipo in ('garcom', 'agua', 'talheres', 'guardanapos', 'limpeza', 'conta', 'duvida')),
  status           text not null default 'pendente'
                   check (status in ('pendente', 'em_atendimento', 'concluido', 'cancelado')),
  solicitante_nome text check (solicitante_nome is null or char_length(solicitante_nome) <= 60),
  observacao       text check (observacao is null or char_length(observacao) <= 200),
  atendido_por     text check (atendido_por is null or char_length(atendido_por) <= 120),
  atendido_em      timestamptz,
  concluido_em     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index experience_chamados_unidade_status
  on public.experience_chamados (unidade_id, status, created_at desc);

-- 2. Um chamado aberto por mesa e tipo ------------------------------------------
create unique index experience_chamados_um_aberto
  on public.experience_chamados (unidade_id, mesa_numero, tipo)
  where status in ('pendente', 'em_atendimento');

-- 3. Quem lê e quem muda ---------------------------------------------------------
alter table public.experience_chamados enable row level security;
revoke all on public.experience_chamados from public, anon, authenticated;
grant select, update on public.experience_chamados to authenticated;
grant all on public.experience_chamados to service_role;
create policy sec_unidade on public.experience_chamados for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

commit;

-- Verificação (só leitura): impressão digital das colunas, índices e policy.
select md5(
  (select string_agg(column_name || ':' || data_type || ':' || is_nullable, '|' order by column_name) from information_schema.columns
    where table_schema = 'public' and table_name = 'experience_chamados')
  || '#' || (select string_agg(indexname, '|' order by indexname) from pg_indexes
              where schemaname = 'public' and tablename = 'experience_chamados')
  || '#' || (select string_agg(policyname || ':' || cmd, '|' order by policyname) from pg_policies
              where schemaname = 'public' and tablename = 'experience_chamados')
  || '#' || (select relrowsecurity::text from pg_class where oid = 'public.experience_chamados'::regclass)
) as impressao_digital;
