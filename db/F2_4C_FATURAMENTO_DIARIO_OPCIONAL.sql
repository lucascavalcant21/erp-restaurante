/* ═══════════════════════════════════════════════════════════════════════════
   F2.4C (OPCIONAL) · FATURAMENTO DIÁRIO INFORMADO — base do CMV %

   STATUS: PROPOSTA. Só rodar se o dono decidir lançar o faturamento à mão.
   Sem ela, o CMV R$ funciona e o CMV % fica NÃO APURADO (com o motivo).

   POR QUE: a auditoria de 01/10 mostrou que o Héfisto NÃO tem fonte de
   faturamento — vendas = 0 linhas; pedidos/comandas usados só em testes
   (jun–ago, R$ 29,90); lancamentos = 1. As vendas reais estão no Saipos, que
   não está integrado. Para o CMV % é preciso a receita do MESMO período das
   contagens; por isso o registro é por DIA (qualquer intervalo entre
   contagens soma os dias; faltou um dia → NÃO APURADO, nunca zero).

   REGRA DA RECEITA (padrão Héfisto para o CMV %):
     receita = vendas brutas − cancelamentos − descontos comerciais
   Não é entrada bancária nem valor líquido de taxa de cartão; taxa de serviço
   (garçom) fica fora das vendas brutas. Cada dia guarda a FONTE declarada
   (ex.: "Saipos — relatório de vendas do dia") e quem lançou/alterou.

   NÃO FAZ: não toca em vendas/pedidos/Saipos, DRE, contas ou estoque.
   Uma transação; aborta sem mudar nada se faltar a base da F2.1.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.unidades') is null
     or to_regprocedure('public.fin_auditoria_trg()') is null
     or to_regprocedure('public.auth_unidade_id()') is null
     or to_regprocedure('public.pode_ver_todas()') is null then
    raise exception 'F2.4C: base da F2.1 ausente. Nada foi alterado.';
  end if;
end $$;

create table if not exists public.fin_faturamento_diario (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     text not null references public.unidades(id),
  data           date not null,
  vendas_brutas  numeric(14,2) not null check (vendas_brutas >= 0),
  cancelamentos  numeric(14,2) not null default 0 check (cancelamentos >= 0),
  descontos      numeric(14,2) not null default 0 check (descontos >= 0),
  receita        numeric(14,2) generated always as (vendas_brutas - cancelamentos - descontos) stored,
  fonte          text not null check (btrim(fonte) <> ''),
  observacao     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  criado_por     uuid,
  atualizado_por uuid,
  unique (unidade_id, data),
  check (cancelamentos + descontos <= vendas_brutas)
);
comment on table public.fin_faturamento_diario is 'hefisto:f2.4c — faturamento diário informado (receita = vendas − cancelamentos − descontos), base do CMV %';

create or replace trigger fin_faturamento_diario_auditoria_f24c before insert or update on public.fin_faturamento_diario
  for each row execute function public.fin_auditoria_trg();

alter table public.fin_faturamento_diario enable row level security;
revoke all on public.fin_faturamento_diario from public, anon, authenticated;
grant select, insert on public.fin_faturamento_diario to authenticated;
grant update (vendas_brutas, cancelamentos, descontos, fonte, observacao) on public.fin_faturamento_diario to authenticated;
drop policy if exists fin_faturamento_diario_unidade on public.fin_faturamento_diario;
create policy fin_faturamento_diario_unidade on public.fin_faturamento_diario for all to authenticated
  using (public.pode_ver_todas() or unidade_id = public.auth_unidade_id())
  with check (public.pode_ver_todas() or unidade_id = public.auth_unidade_id());

commit;


/* ── ROLLBACK (só se algo der errado; apaga os faturamentos lançados) ─────────
begin;
drop table if exists public.fin_faturamento_diario;
commit;
   ────────────────────────────────────────────────────────────────────────── */
