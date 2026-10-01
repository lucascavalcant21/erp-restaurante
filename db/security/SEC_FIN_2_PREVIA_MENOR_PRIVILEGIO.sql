/* ═══════════════════════════════════════════════════════════════════════════
   SEC-FIN-2 · PRÉVIA (SOMENTE LEITURA) — privilégios dos objetos da F2.3

   Rode ANTES de SEC_FIN_2_MENOR_PRIVILEGIO_F23.sql. Só SELECT em
   information_schema / pg_catalog. Um único resultado.

   Mostra, para anon / authenticated / PUBLIC, o privilégio de HOJE e o que
   fica DEPOIS da correção, objeto por objeto (tabela e coluna), e marca o que
   muda. Também lista as funções fin_* que anon consegue executar (só
   informativo: a correção não mexe em funções).
   ═══════════════════════════════════════════════════════════════════════════ */
with alvo(objeto, depois_tabela, depois_update_colunas) as (values
  ('vw_fin_contas_receber',           'SELECT',        null),
  ('vw_fin_fluxo_caixa',              'SELECT',        null),
  ('vw_fin_saldo_contas_financeiras', 'SELECT',        null),
  ('fin_recebimentos',                'SELECT',        null),
  ('fin_contas_receber',              'INSERT,SELECT', 'adquirente,autorizacao,bandeira,cancelado_em,conta_financeira_prevista_id,data_prevista,data_venda,descricao,motivo_cancelamento,nsu,observacao,status,taxa_fixa_prevista,taxa_percentual_prevista,taxa_regra_id,valor_bruto,valor_taxa_previsto'),
  ('fin_contas_financeiras',          'INSERT,SELECT', 'ativa,nome'),
  ('fin_taxas_meio_pagamento',        'INSERT,SELECT', 'ativa,vigente_ate')
),
papeis(papel) as (values ('anon'), ('authenticated'), ('PUBLIC')),
hoje_tabela as (
  select table_name as objeto, grantee as papel, string_agg(privilege_type, ',' order by privilege_type) as privs
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name in (select objeto from alvo) and grantee in (select papel from papeis)
   group by table_name, grantee
),
-- UPDATE só por coluna (aparece quando não há UPDATE na tabela inteira)
hoje_colunas as (
  select table_name as objeto, grantee as papel, string_agg(distinct column_name, ',' order by column_name) as cols
    from information_schema.column_privileges
   where table_schema = 'public' and table_name in (select objeto from alvo) and grantee in (select papel from papeis)
     and privilege_type = 'UPDATE'
     and not exists (select 1 from information_schema.role_table_grants g
                      where g.table_schema = 'public' and g.table_name = column_privileges.table_name
                        and g.grantee = column_privileges.grantee and g.privilege_type = 'UPDATE')
   group by table_name, grantee
)
select * from (
  select 1 as ord, a.objeto || ' → ' || p.papel as item,
         'HOJE: ' || coalesce(h.privs, '(nada)') || coalesce(' + UPDATE(' || hc.cols || ')', '')
         || ' | DEPOIS: ' || case when p.papel = 'authenticated'
                                  then a.depois_tabela || coalesce(' + UPDATE(' || a.depois_update_colunas || ')', '')
                                  else '(nada)' end
         || ' | ' || case
              when coalesce(h.privs, '') = case when p.papel = 'authenticated' then a.depois_tabela else '' end
               and coalesce(hc.cols, '') = case when p.papel = 'authenticated' then coalesce(a.depois_update_colunas, '') else '' end
              then 'sem mudança' else 'MUDA' end as resultado
    from alvo a cross join papeis p
    left join hoje_tabela h on h.objeto = a.objeto and h.papel = p.papel
    left join hoje_colunas hc on hc.objeto = a.objeto and hc.papel = p.papel
  union all
  -- policies por unidade: NÃO são alteradas (conferência de que continuam lá)
  select 2, 'policy (não muda): ' || tablename || ' / ' || policyname,
         'USING=' || coalesce(qual, '-') || ' | CHECK=' || coalesce(with_check, '-')
    from pg_policies
   where schemaname = 'public' and tablename in ('fin_recebimentos','fin_contas_receber','fin_contas_financeiras','fin_taxas_meio_pagamento')
  union all
  -- informativo: funções fin_* executáveis por anon (fora do escopo da correção)
  select 3, 'info: função executável por anon: ' || p.proname,
         case when p.proname in ('fin_hoje','estoque_custo_medio_novo') then 'pura, sem acesso a dados'
              when p.prorettype = 'trigger'::regtype then 'função de trigger (não pode ser chamada direto)'
              else 'REVISAR' end
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'fin\_%' or p.proname like 'estoque\_%' or p.proname like 'compras\_%')
     and has_function_privilege('anon', p.oid, 'execute')
) x
order by ord, item;
