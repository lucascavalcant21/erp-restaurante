/* SEC-DADOS-2 · LEITURA ANÔNIMA — quem não está logado deixa de ler o negócio
   ═══════════════════════════════════════════════════════════════════════════

   O QUE FOI CONFIRMADO (30/09/2026)
   Sem login, a chave pública lia linhas de 20 tabelas, entre elas:
     pedidos .......... cliente_nome, cliente_telefone, endereco_entrega (LGPD)
     unidades ......... cnpj, endereco_fiscal e TOKEN_NFE (credencial!)
     hefisto_auditoria  nomes de usuários e valores antes/depois
     notas_fiscais, insumos, fichas_tecnicas (custos), etiquetas, estoque...

   PRÉ-REQUISITO: o código de beebb13 no ar (deploy m3fvq5hpo em diante).
   Com ele, cardápio, pedido do cardápio, rastreio e cabeçalho de eventos vão
   pelo servidor (/api/public/*) e nenhuma página pública lê tabela como anon.

   O QUE FAZ: revoga SELECT, INSERT, UPDATE e DELETE do anon em TODAS as
   tabelas e views do schema public — inclusive o INSERT em pedidos que a
   SEC-DADOS-1 tinha mantido (o pedido agora é gravado pelo servidor).
   Registra cada revogação em sec_backup_grants_anon. Não mexe em
   authenticated, service_role, policies nem dados. Não revoga de PUBLIC.

   DEPOIS: troque o token da NF-e no provedor — ele esteve legível sem login.
*/

begin;

create table if not exists public.sec_backup_grants_anon (
  tabela text not null, privilegio text not null, revogado_em timestamptz not null default now(),
  primary key (tabela, privilegio)
);
alter table public.sec_backup_grants_anon enable row level security;
revoke all on table public.sec_backup_grants_anon from anon, authenticated;

do $$
declare t record; p text;
begin
  for t in
    select c.oid, c.relname
      from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
  loop
    foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege('anon', t.oid, p) then
        insert into public.sec_backup_grants_anon (tabela, privilegio) values (t.relname, p)
          on conflict do nothing;
        execute format('revoke %s on table public.%I from anon', p, t.relname);
        if has_table_privilege('anon', t.oid, p) then
          delete from public.sec_backup_grants_anon where tabela = t.relname and privilegio = p;
        end if;
      end if;
    end loop;
  end loop;
end $$;

commit;

select 'leitura anon revogada nesta fase (tabelas/views)' as item,
       count(*)::text as valor from public.sec_backup_grants_anon where privilegio = 'SELECT'
union all
select 'INSERT anon em pedidos revogado', (count(*) > 0)::text
  from public.sec_backup_grants_anon where tabela = 'pedidos' and privilegio = 'INSERT'
union all
select 'acesso anon que AINDA resta (esperado: nenhum)',
       coalesce(string_agg(c.relname || ' ' || p.priv ||
                case when exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                                   where a.grantee = 0 and a.privilege_type = p.priv) then ' (vem de PUBLIC!)' else '' end, ', '), 'nenhum')
  from pg_class c cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
 where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
   and has_table_privilege('anon', c.oid, p.priv);

/* ROLLBACK desta fase — devolve só a leitura e o INSERT em pedidos:
     select format('grant %s on table public.%I to anon;', privilegio, tabela)
       from public.sec_backup_grants_anon
      where privilegio = 'SELECT' or (tabela = 'pedidos' and privilegio = 'INSERT');
   Reabre a leitura anônima de pedidos (dados de clientes), unidades (token da NF-e) etc. */
