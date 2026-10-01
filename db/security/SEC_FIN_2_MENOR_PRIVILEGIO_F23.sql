/* ═══════════════════════════════════════════════════════════════════════════
   SEC-FIN-2 · MENOR PRIVILÉGIO NOS OBJETOS DA F2.3

   STATUS: PROPOSTA. Rodar só com aprovação do dono, DEPOIS da prévia
   (SEC_FIN_2_PREVIA_MENOR_PRIVILEGIO.sql).

   O QUE ESTÁ SOBRANDO (auditoria de produção de 01/10/2026)
   O Supabase concede, por padrão, ALL ao `authenticated` em tabela/view nova.
   A F2.1 retirou só parte. Ficou:
     views vw_fin_contas_receber / vw_fin_fluxo_caixa / vw_fin_saldo_contas_financeiras
       → DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
     fin_recebimentos                                   → REFERENCES, SELECT, TRIGGER
     fin_contas_receber / fin_contas_financeiras / fin_taxas_meio_pagamento
       → INSERT, REFERENCES, SELECT, TRIGGER, UPDATE (UPDATE em TODAS as colunas)
   Isso é GRANT, não RLS: o isolamento por unidade está correto e NÃO é tocado.

   ESTADO FINAL (só o que a F2.3 usa; o resto das gravações é das RPCs, que
   rodam como dono e não dependem destes grants):
     views financeiras            → authenticated: SELECT
     fin_recebimentos             → authenticated: SELECT
     fin_contas_receber           → authenticated: SELECT, INSERT, UPDATE só nas 17 colunas
                                    que a tela edita/cancela
     fin_contas_financeiras       → authenticated: SELECT, INSERT, UPDATE(nome, ativa)
                                    (saldo inicial deixa de ser alterável pela API)
     fin_taxas_meio_pagamento     → authenticated: SELECT, INSERT, UPDATE(ativa, vigente_ate)
                                    (taxa já cadastrada não é reescrita; encerra-se a vigência)
     anon / PUBLIC                → nada (como já está)

   NÃO FAZ: não altera dados, policies, RLS, funções, contas_pagar, F2.2,
   nem privilégios de service_role (rotas de servidor).
   Uma transação; verificação prévia aborta sem mudar nada. Rollback no fim.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
declare v_obj text;
begin
  foreach v_obj in array array['vw_fin_contas_receber','vw_fin_fluxo_caixa','vw_fin_saldo_contas_financeiras',
      'fin_recebimentos','fin_contas_receber','fin_contas_financeiras','fin_taxas_meio_pagamento'] loop
    if to_regclass('public.' || v_obj) is null then
      raise exception 'SEC-FIN-2: public.% não existe. Nada foi alterado.', v_obj;
    end if;
  end loop;
  -- as policies por unidade precisam estar lá (esta correção não as cria)
  if (select count(*) from pg_policies where schemaname = 'public'
       and policyname in ('fin_recebimentos_unidade_f21','fin_contas_receber_unidade_f21',
                          'fin_contas_financeiras_unidade_f21','fin_taxas_meio_pagamento_unidade_f21')) <> 4 then
    raise exception 'SEC-FIN-2: policies por unidade da F2.1 ausentes. Nada foi alterado.';
  end if;
end $$;

-- backup do estado de antes (uma vez), para auditoria e conferência do rollback
create table if not exists public.sec_backup_privilegios_sec_fin_2 (
  objeto      text not null,
  papel       text not null,
  privilegio  text not null,
  coluna      text not null default '',
  salvo_em    timestamptz not null default now(),
  primary key (objeto, papel, privilegio, coluna)
);
alter table public.sec_backup_privilegios_sec_fin_2 enable row level security;
revoke all on table public.sec_backup_privilegios_sec_fin_2 from public, anon, authenticated;

insert into public.sec_backup_privilegios_sec_fin_2 (objeto, papel, privilegio)
select table_name, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC')
   and table_name in ('vw_fin_contas_receber','vw_fin_fluxo_caixa','vw_fin_saldo_contas_financeiras',
                      'fin_recebimentos','fin_contas_receber','fin_contas_financeiras','fin_taxas_meio_pagamento')
on conflict do nothing;

-- 1. views financeiras: só leitura
revoke all on public.vw_fin_contas_receber, public.vw_fin_fluxo_caixa, public.vw_fin_saldo_contas_financeiras
  from public, anon, authenticated;
grant select on public.vw_fin_contas_receber, public.vw_fin_fluxo_caixa, public.vw_fin_saldo_contas_financeiras
  to authenticated;

-- 2. recebimentos: só leitura (gravação só pelas RPCs fin_registrar/estornar_recebimento)
revoke all on public.fin_recebimentos from public, anon, authenticated;
grant select on public.fin_recebimentos to authenticated;

-- 3. contas a receber: lê, cria, e altera só o que a tela edita/cancela
--    (revogar UPDATE da tabela também revoga UPDATE de colunas; depois concede por coluna)
revoke all on public.fin_contas_receber from public, anon, authenticated;
grant select, insert on public.fin_contas_receber to authenticated;
grant update (descricao, adquirente, bandeira, nsu, autorizacao, observacao, conta_financeira_prevista_id,
              data_venda, data_prevista, valor_bruto, valor_taxa_previsto, taxa_regra_id,
              taxa_percentual_prevista, taxa_fixa_prevista, status, cancelado_em, motivo_cancelamento)
  on public.fin_contas_receber to authenticated;

-- 4. contas financeiras: lê, cria, renomeia/ativa (saldo inicial e data ficam fixos)
revoke all on public.fin_contas_financeiras from public, anon, authenticated;
grant select, insert on public.fin_contas_financeiras to authenticated;
grant update (nome, ativa) on public.fin_contas_financeiras to authenticated;

-- 5. taxas: lê, cria, encerra (ativa/vigente_ate); taxa cadastrada não é reescrita
revoke all on public.fin_taxas_meio_pagamento from public, anon, authenticated;
grant select, insert on public.fin_taxas_meio_pagamento to authenticated;
grant update (ativa, vigente_ate) on public.fin_taxas_meio_pagamento to authenticated;

commit;


/* ── CONFERÊNCIA (só leitura): rode SEC_FIN_2_PREVIA_MENOR_PRIVILEGIO.sql de
   novo. Esperado: todas as linhas do bloco 1 com "sem mudança"; bloco 2 com as
   4 policies intactas.
   ────────────────────────────────────────────────────────────────────────── */


/* ── ROLLBACK (só se algo der errado; volta ao estado auditado em 01/10) ─────
begin;
grant delete, insert, references, select, trigger, truncate, update
  on public.vw_fin_contas_receber, public.vw_fin_fluxo_caixa, public.vw_fin_saldo_contas_financeiras to authenticated;
grant references, select, trigger on public.fin_recebimentos to authenticated;
revoke update on public.fin_contas_receber, public.fin_contas_financeiras, public.fin_taxas_meio_pagamento from authenticated;
grant insert, references, select, trigger, update
  on public.fin_contas_receber, public.fin_contas_financeiras, public.fin_taxas_meio_pagamento to authenticated;
commit;
   ────────────────────────────────────────────────────────────────────────── */
