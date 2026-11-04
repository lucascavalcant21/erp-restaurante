/* SEC-FICHAS-1 · FICHA TÉCNICA: VER É UMA COISA, ALTERAR É OUTRA

   STATUS: NÃO APLICADA. Aguarda a aprovação APR-016
   (docs/brain/06_OPERACAO/APROVACOES_PENDENTES.md).

   POR QUÊ: o dono quer contas que consultam a ficha sem poder alterar. Hoje a
   policy das fichas vale para ler e gravar (cmd ALL): qualquer usuário da
   unidade altera uma ficha chamando a API do banco direto, mesmo sem o botão
   na tela. Conferido no banco real em 04/11/2026.

   FAZ (uma transação):
     1. função hefisto_pode_alterar_fichas(unidade): só quem tem permissão de
        criar, editar ou apagar fichas, montagem, cardápio ou marmitas;
     2. nas tabelas abaixo, troca a policy única por quatro. Ler continua como
        está; inserir, alterar e apagar passam a exigir a função acima.
   NÃO FAZ: não muda nenhuma linha de dado nem grant; não mexe em
   fichas_custo_historico; não altera salvar_ficha_tecnica_atomica, que já
   confere permissão própria.
   IMPACTO: quem tem o perfil "Somente consulta" deixa de conseguir gravar
   fichas, inclusive nas telas que hoje deixam.

   BACKUP: as policies antigas ficam em sec_backup_policies_sec_fichas_1.
   VERIFICAÇÃO: o select do fim deve devolver b300bf3a8f1a004da40d3eaf2f104a2a.
   Testada no PGlite: app/lib/sec-fichas-1.test.mjs.
   ROLLBACK: SEC_FICHAS_1_ROLLBACK.sql (não rodar sem decisão do dono). */

begin;

/* Preflight: aborta sem mudar nada. */
do $$
declare
  v_tabela text;
begin
  if to_regprocedure('public.hefisto_user_can(text,text)') is null
    or to_regprocedure('public.hefisto_ve_todas_unidades()') is null
    or to_regprocedure('public.hefisto_unidades_do_usuario()') is null then
    raise exception 'SEC-FICHAS-1: funções de acesso ausentes. Nada foi alterado.';
  end if;
  if to_regprocedure('public.hefisto_pode_alterar_fichas(text)') is not null then
    raise exception 'SEC-FICHAS-1: já aplicada. Nada foi alterado.';
  end if;
  foreach v_tabela in array array['fichas_tecnicas','montagem','fichas_alergenicos','fichas_armazenamento',
    'fichas_equipamentos','fichas_etapas','fichas_montagem_passos','fichas_versoes'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = 'sec_unidade' and cmd = 'ALL') then
      raise exception 'SEC-FICHAS-1: policy sec_unidade ausente em %. Nada foi alterado.', v_tabela;
    end if;
  end loop;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fichas_ingredientes' and policyname = 'sec_pai' and cmd = 'ALL') then
    raise exception 'SEC-FICHAS-1: policy sec_pai ausente em fichas_ingredientes. Nada foi alterado.';
  end if;
end $$;

create table public.sec_backup_policies_sec_fichas_1 as
  select * from pg_policies
  where schemaname = 'public'
    and (tablename = 'montagem' or tablename like 'fichas\_%');
alter table public.sec_backup_policies_sec_fichas_1 enable row level security;
revoke all on public.sec_backup_policies_sec_fichas_1 from public, anon, authenticated;

create function public.hefisto_pode_alterar_fichas(p_unidade_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.hefisto_ve_todas_unidades() or exists (
    select 1
    from unnest(array[
      'fichas.recipes.create', 'fichas.recipes.edit', 'fichas.recipes.delete',
      'cozinha.recipes.create', 'cozinha.recipes.edit', 'cozinha.recipes.delete',
      'bar.recipes.create', 'bar.recipes.edit', 'bar.recipes.delete',
      'fichas.assembly.create', 'fichas.assembly.edit', 'fichas.assembly.delete',
      'cozinha.assembly.create', 'cozinha.assembly.edit', 'cozinha.assembly.delete',
      'bar.assembly.create', 'bar.assembly.edit', 'bar.assembly.delete',
      'cardapio.menu.edit', 'cardapio.products.edit',
      'marmitaria.recipes.create', 'marmitaria.recipes.edit', 'marmitaria.recipes.delete'
    ]) as chave
    where public.hefisto_user_can(chave, p_unidade_id)
  )
$$;
revoke all on function public.hefisto_pode_alterar_fichas(text) from public, anon;
grant execute on function public.hefisto_pode_alterar_fichas(text) to authenticated;

do $$
declare
  v_tabela text;
  v_unidade constant text := '((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))';
begin
  foreach v_tabela in array array['fichas_tecnicas','montagem','fichas_alergenicos','fichas_armazenamento',
    'fichas_equipamentos','fichas_etapas','fichas_montagem_passos','fichas_versoes'] loop
    execute format('drop policy sec_unidade on public.%I', v_tabela);
    execute format('create policy sec_ler on public.%I for select to authenticated using %s', v_tabela, v_unidade);
    execute format('create policy sec_inserir on public.%I for insert to authenticated with check (%s and public.hefisto_pode_alterar_fichas(unidade_id))', v_tabela, v_unidade);
    execute format('create policy sec_alterar on public.%I for update to authenticated using (%s and public.hefisto_pode_alterar_fichas(unidade_id)) with check (%s and public.hefisto_pode_alterar_fichas(unidade_id))', v_tabela, v_unidade, v_unidade);
    execute format('create policy sec_apagar on public.%I for delete to authenticated using (%s and public.hefisto_pode_alterar_fichas(unidade_id))', v_tabela, v_unidade);
  end loop;
end $$;

drop policy sec_pai on public.fichas_ingredientes;
create policy sec_ler on public.fichas_ingredientes for select to authenticated using (
  (select public.hefisto_ve_todas_unidades())
  or exists (select 1 from public.fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id)
);
create policy sec_inserir on public.fichas_ingredientes for insert to authenticated with check (
  exists (select 1 from public.fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id and public.hefisto_pode_alterar_fichas(m.unidade_id))
);
create policy sec_alterar on public.fichas_ingredientes for update to authenticated using (
  exists (select 1 from public.fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id and public.hefisto_pode_alterar_fichas(m.unidade_id))
) with check (
  exists (select 1 from public.fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id and public.hefisto_pode_alterar_fichas(m.unidade_id))
);
create policy sec_apagar on public.fichas_ingredientes for delete to authenticated using (
  exists (select 1 from public.fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id and public.hefisto_pode_alterar_fichas(m.unidade_id))
);

commit;

/* Impressão digital. */
select md5(string_agg(tablename || ':' || policyname || ':' || cmd, ',' order by tablename, policyname)) as impressao_digital
from pg_policies
where schemaname = 'public' and (tablename = 'montagem' or (tablename like 'fichas\_%' and tablename <> 'fichas_custo_historico'));
