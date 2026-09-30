/* SEC-DADOS-1 · ESCRITA ANÔNIMA — quem não está logado deixa de gravar e apagar
   ═══════════════════════════════════════════════════════════════════════════

   O QUE FOI CONFIRMADO (30/09/2026, projeto sezccspqxgklicfndwxx)
   Cerca de 60 tabelas do negócio têm policy "Acesso Total …" / "…_all" com
   USING (true) para PUBLIC, e o anon tem grant de INSERT/UPDATE/DELETE nelas.
   Sem login, qualquer visitante podia ALTERAR ou APAGAR produtos, preços de
   insumos, fichas técnicas, pedidos, notas fiscais, estoque, configuração do
   sistema e o próprio log de auditoria.

   O QUE ESTE ARQUIVO FAZ
   Revoga INSERT, UPDATE e DELETE do anon em TODAS as tabelas do schema public,
   com UMA exceção: INSERT em `pedidos`, que o delivery público usa para
   registrar o pedido. Cada privilégio revogado vai para
   public.sec_backup_grants_anon (rollback no fim).

   O QUE ELE NÃO FAZ
   - Não mexe em LEITURA: o cardápio (/cardapio), a tela de chamada (/chamada)
     e o delivery ainda leem como anon. Leitura é a fase seguinte, com rotas de
     servidor — como foi feito com /extras e /vagas.
   - Não toca em authenticated, service_role, policies, RLS nem dados.
   - Não revoga de PUBLIC: se algum privilégio vier de PUBLIC, ele continua e
     aparece na conferência como "(vem de PUBLIC!)" — PARE e me mande.

   QUEM PODE SENTIR
   Ninguém logado: o painel exige sessão (app/dashboard/layout.js) e todas as
   gravações do ERP saem como authenticated. Nas páginas públicas, só o
   delivery grava (pedidos, mantido). As tentativas anônimas em `clientes`
   (pontos do delivery) e `eventos` (formulário público de eventos) JÁ falham
   hoje por falta de grant — não mudam com este arquivo.

   Idempotente. Testado em Postgres local (grant direto, grant via PUBLIC,
   exceção de pedidos, authenticated intacto, rollback).
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
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  loop
    foreach p in array array['INSERT', 'UPDATE', 'DELETE'] loop
      -- O delivery público grava o pedido como anon: só esse INSERT fica.
      continue when t.relname = 'pedidos' and p = 'INSERT';
      if has_table_privilege('anon', t.oid, p) then
        insert into public.sec_backup_grants_anon (tabela, privilegio) values (t.relname, p)
          on conflict do nothing;
        execute format('revoke %s on table public.%I from anon', p, t.relname);
        -- Se continua valendo, vinha de PUBLIC: não foi revogado, não entra no backup.
        if has_table_privilege('anon', t.oid, p) then
          delete from public.sec_backup_grants_anon where tabela = t.relname and privilegio = p;
        end if;
      end if;
    end loop;
  end loop;
end $$;

commit;

select 'privilégios de escrita revogados do anon' as item, count(*)::text as valor from public.sec_backup_grants_anon
union all
select 'tabelas afetadas', count(distinct tabela)::text from public.sec_backup_grants_anon
union all
select 'escrita anon que AINDA resta (esperado: só pedidos INSERT)',
       coalesce(string_agg(c.relname || ' ' || p.priv ||
                case when exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                                   where a.grantee = 0 and a.privilege_type = p.priv) then ' (vem de PUBLIC!)' else '' end, ', '), 'nenhuma')
  from pg_class c cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
 where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
   and has_table_privilege('anon', c.oid, p.priv)
union all
select 'leitura anon mantida (tabelas)', count(*)::text
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
   and has_table_privilege('anon', c.oid, 'SELECT');

/* ROLLBACK — devolve exatamente o que foi revogado (reabre a escrita anônima):
     select format('grant %s on table public.%I to anon;', privilegio, tabela)
       from public.sec_backup_grants_anon order by tabela, privilegio;
   (gera os comandos; rode-os se precisar desfazer) */
