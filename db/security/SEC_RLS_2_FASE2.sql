/* SEC-RLS-2 · FASE 2 DO ISOLAMENTO (HDEV-SEC-002)
   ═══════════════════════════════════════════════════════════════════════════

   Depende da SEC-RLS-1 (aplicada em 08/10/2026). NÃO reverte nada dela.
   Auditoria só leitura no Supabase real em 08/10 (docs/brain/02_ARQUITETURA/SEC_RLS_2_MAPA.md).

   O QUE FAZ
   1. pode_ver_todas() e hefisto_ve_todas_unidades() = SÓ super admin.
      Antes: escopo 'empresa'/'todos' via TODAS as unidades de TODAS as empresas.
      hefisto_unidades_do_usuario(): unidade principal + escopos de unidade +
      escopo 'empresa'/'todos' = unidades DA PRÓPRIA empresa (dono).
   2. colaboradores: dados sensíveis (CPF, salário, RG, PIX, endereço,
      biometria…) só para RH/gerência autorizados da unidade
      (rh.employees.view), o próprio funcionário (usuarios_erp.colaborador_id
      ou funcionario_id) e o super admin. As telas operacionais leem a lista
      sem dados sensíveis por hefisto_colaboradores_operacional().
   3. 7 tabelas da unidade com dados legados (burguer, ticotico, todas, nulo):
      policy sec_unidade. Os registros inválidos NÃO são apagados nem movidos:
      ficam só para o super admin e entram em public.sec_dados_legados
      (LEGADO / ORFAO / AMBIGUO, com a evidência).
   4. 15 tabelas-filhas: policy sec_pai = "vejo a filha se vejo a mãe" (a RLS da
      mãe vale dentro da subconsulta). Sem mãe: só o super admin.
   5. suprimentos_catalogo e tarefas_templates ganham unidade_id (coluna nova,
      nula) e sec_unidade; o registro antigo sem unidade fica LEGADO.
   6. Cadastro e acesso: usuarios_erp (o próprio, gestão de usuários da unidade,
      super admin), usuario_escopos (idem), unidades (as do usuário; editar só
      com permissão; criar/apagar só super admin), perfis_acesso (perfis do
      sistema + super admin), permissoes_auditoria (super admin).
      unidades.token_nfe deixa de ser LIDO pelo navegador (só gravado):
      hefisto_token_nfe_configurado() diz se está preenchido.
   7. ponto (tabela antiga vazia): RLS sem policy = fechada.
   8. fin_categorias, fin_categorias_legado, fin_centros_custo: catálogos GLOBAIS
      do sistema, só leitura (sem policy de escrita). Ficam como estão.

   EFEITO HOJE (1 empresa, 1 unidade, 16 usuários, nenhum ligado a colaborador):
   - gerente-geral (2) e super admin: nada muda;
   - cozinheiro (2) e somente-consulta (11): deixam de ver CPF/salário/endereço
     dos colegas; as telas continuam com nome, cargo e horários;
   - registros legados somem para todos, menos o super admin.

   COMO RODAR: só com aprovação (APR-002). Inteiro, de uma vez. O preflight
   aborta sem mudar nada se a base não for a esperada.
   Rollback: db/security/SEC_RLS_2_ROLLBACK.sql (só com o dono).
*/

begin;
set local lock_timeout = '5s';

create temp table _sec2_unidade (tabela text primary key) on commit drop;
insert into _sec2_unidade values ('controle_limpeza'), ('controle_manutencoes'), ('suprimentos_historico'), ('suprimentos_unidades'),
  ('montagem'), ('eventos'), ('notas_fiscais'), ('suprimentos_catalogo'), ('tarefas_templates');

create temp table _sec2_filha (tabela text primary key, coluna text not null, mae text not null) on commit drop;
insert into _sec2_filha values
  ('fichas_ingredientes', 'ficha_id', 'fichas_tecnicas'), ('ficha_itens', 'ficha_id', 'fichas_tecnicas'),
  ('pedidos_itens', 'pedido_id', 'pedidos'),
  ('evento_compras', 'evento_id', 'eventos'), ('evento_custos_fixos', 'evento_id', 'eventos'), ('evento_drinks', 'evento_id', 'eventos'),
  ('evento_ingredientes', 'evento_id', 'eventos'), ('evento_pratos', 'evento_id', 'eventos'), ('evento_preparos', 'evento_id', 'eventos'),
  ('evento_reservas', 'evento_id', 'eventos'),
  ('op_secoes', 'processo_id', 'op_processos'), ('op_itens', 'processo_id', 'op_processos'), ('op_respostas', 'execucao_id', 'op_execucoes'),
  ('op_acoes_corretivas', 'nao_conformidade_id', 'op_nao_conformidades'),
  ('documentos_rh', 'colaborador_id', 'colaboradores');

create temp table _sec2_todas (tabela text primary key) on commit drop;
insert into _sec2_todas select tabela from _sec2_unidade union select tabela from _sec2_filha
  union values ('colaboradores'), ('ponto'), ('usuarios_erp'), ('usuario_escopos'), ('unidades'), ('perfis_acesso'), ('permissoes_auditoria');

-- ── PREFLIGHT (aborta sem mudar nada) ───────────────────────────────────────
do $$
declare t text; r record; n bigint; pol record;
begin
  if (select count(*) from _sec2_todas) <> 31 then raise exception 'SEC-RLS-2 preflight: lista de tabelas mudou'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and policyname = 'sec_unidade';
  if n < 88 then raise exception 'SEC-RLS-2 preflight: a SEC-RLS-1 não está aplicada (% policies sec_unidade). Nada foi alterado.', n; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and policyname in ('sec_colab_ler', 'sec_pai')) then
    raise exception 'SEC-RLS-2 preflight: já aplicada. Nada foi alterado.';
  end if;
  for t in select tabela from _sec2_todas loop
    if to_regclass('public.' || t) is null then raise exception 'SEC-RLS-2 preflight: falta public.%. Nada foi alterado.', t; end if;
  end loop;
  for r in select * from _sec2_filha loop
    if to_regclass('public.' || r.mae) is null or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = r.tabela and column_name = r.coluna) then
      raise exception 'SEC-RLS-2 preflight: %.% ou a mãe % não existe. Nada foi alterado.', r.tabela, r.coluna, r.mae;
    end if;
  end loop;
  for t in select unnest(array['colaboradores.cpf', 'colaboradores.salario', 'usuarios_erp.colaborador_id', 'usuarios_erp.funcionario_id', 'usuarios_erp.perfil_id',
                               'unidades.empresa_id', 'unidades.token_nfe', 'usuario_escopos.empresa_id', 'perfis_acesso.sistema']) loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = split_part(t, '.', 1) and column_name = split_part(t, '.', 2)) then
      raise exception 'SEC-RLS-2 preflight: falta a coluna %. Nada foi alterado.', t;
    end if;
  end loop;
  if to_regprocedure('public.hefisto_user_has_permission(uuid,text)') is null then raise exception 'SEC-RLS-2 preflight: falta hefisto_user_has_permission. Nada foi alterado.'; end if;
  -- usuário ativo que ficaria sem unidade nenhuma
  select count(*) into n from public.usuarios_erp u
   where u.status = 'ativo' and not u.super_admin and u.unidade_principal_id is null
     and not exists (select 1 from public.usuario_escopos e where e.usuario_id = u.id and (e.unidade_id is not null or e.empresa_id is not null));
  if n > 0 then raise exception 'SEC-RLS-2 preflight: % usuário(s) ativo(s) sem unidade nem empresa perderiam o acesso. Nada foi alterado.', n; end if;
  -- só troca policy conhecida (as formas abertas de 08/10 ou a sec_unidade da fase 1)
  for pol in select tablename, policyname, coalesce(qual, '') q, coalesce(with_check, '') c from pg_policies p join _sec2_todas a on a.tabela = p.tablename where p.schemaname = 'public' loop
    if not (pol.policyname = 'sec_unidade' or (
      (pol.q ~* '^\(?\s*true\s*\)?$' or pol.q = '' or pol.q ~* '^\(?\s*\(?auth\.role\(\)\)?\s*=\s*''authenticated''::text\s*\)?$' or pol.q ~* '^\(?\s*pode_ver_todas\(\)\s*\)?$'
        or pol.q ~* '^\(\s*pode_ver_todas\(\)\s+or\s+\(unidade_id\s*=\s*auth_unidade_id\(\)\)\s+or\s+\(unidade_id\s+is\s+null\)\s*\)$')
      and (pol.c ~* '^\(?\s*true\s*\)?$' or pol.c = '' or pol.c ~* '^\(?\s*pode_ver_todas\(\)\s*\)?$'
        or pol.c ~* '^\(\s*pode_ver_todas\(\)\s+or\s+\(unidade_id\s*=\s*auth_unidade_id\(\)\)\s+or\s+\(unidade_id\s+is\s+null\)\s*\)$'))) then
      raise exception 'SEC-RLS-2 preflight: policy desconhecida "%" em public.% (using=%, check=%). Revise antes. Nada foi alterado.', pol.policyname, pol.tablename, pol.q, pol.c;
    end if;
  end loop;
end $$;

-- ── BACKUP (policies e funções de antes, para o rollback) ───────────────────
create table if not exists public.sec_backup_policies_sec_rls_2 (
  tabela text not null, policyname text not null, permissive text, cmd text, roles text[],
  qual text, with_check text, rls_estava_ligado boolean, guardado_em timestamptz default now()
);
create table if not exists public.sec_backup_funcoes_sec_rls_2 (funcao text primary key, definicao text, guardado_em timestamptz default now());
revoke all on table public.sec_backup_policies_sec_rls_2 from public, anon, authenticated;
revoke all on table public.sec_backup_funcoes_sec_rls_2 from public, anon, authenticated;
alter table public.sec_backup_policies_sec_rls_2 enable row level security;
alter table public.sec_backup_funcoes_sec_rls_2 enable row level security;

insert into public.sec_backup_policies_sec_rls_2 (tabela, policyname, permissive, cmd, roles, qual, with_check, rls_estava_ligado)
select a.tabela, coalesce(p.policyname, '(sem policy)'), p.permissive, p.cmd, p.roles::text[], p.qual, p.with_check, c.relrowsecurity
  from _sec2_todas a
  join pg_class c on c.oid = ('public.' || a.tabela)::regclass
  left join pg_policies p on p.schemaname = 'public' and p.tablename = a.tabela;

insert into public.sec_backup_funcoes_sec_rls_2 (funcao, definicao)
select p.oid::regprocedure::text, pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('pode_ver_todas', 'hefisto_ve_todas_unidades', 'hefisto_unidades_do_usuario');

-- ── CLASSIFICAÇÃO DOS DADOS LEGADOS (nada é apagado nem movido) ─────────────
alter table public.suprimentos_catalogo add column if not exists unidade_id text;
alter table public.tarefas_templates add column if not exists unidade_id text;

create table if not exists public.sec_dados_legados (
  tabela text not null, registro_id text not null, unidade_original text,
  classificacao text not null check (classificacao in ('VALIDO', 'LEGADO', 'ORFAO', 'AMBIGUO')),
  evidencia text not null, acao_sugerida text, registrado_em timestamptz default now(),
  primary key (tabela, registro_id)
);
revoke all on table public.sec_dados_legados from public, anon, authenticated;
alter table public.sec_dados_legados enable row level security;

do $$
declare t text;
begin
  for t in select tabela from _sec2_unidade order by tabela loop
    execute format($q$
      insert into public.sec_dados_legados (tabela, registro_id, unidade_original, classificacao, evidencia, acao_sugerida)
      select %1$L, x.id::text, x.unidade_id,
        case
          when x.unidade_id in ('burguer', 'ticotico') then 'LEGADO'
          when %1$L = 'eventos' and x.unidade_id is null and to_jsonb(x)->>'tag' ilike 'seldeestrela%%' then 'AMBIGUO'
          when x.unidade_id = 'todas' or (%1$L = 'montagem' and x.unidade_id is null) then 'AMBIGUO'
          when %1$L = 'suprimentos_catalogo' then 'LEGADO'
          else 'ORFAO'
        end,
        case
          when x.unidade_id in ('burguer', 'ticotico') then 'unidade antiga ' || x.unidade_id || ', que não existe mais em unidades'
          when %1$L = 'eventos' and x.unidade_id is null and to_jsonb(x)->>'tag' ilike 'seldeestrela%%' then 'sem unidade; tag = ' || (to_jsonb(x)->>'tag') || ' (evidência forte)'
          when x.unidade_id = 'todas' then 'marcador "todas" gravado por app/lib/notas.js quando faltava unidade; CNPJ do destinatário não confere com nenhuma unidade'
          when %1$L = 'montagem' then 'sem unidade; criado automaticamente pelo Cardápio (itens de hamburgueria; provável unidade antiga burguer)'
          when %1$L = 'suprimentos_catalogo' then 'catálogo sem unidade; só é usado por registros da unidade antiga ticotico'
          when %1$L = 'suprimentos_historico' then 'sem unidade; mesmo catálogo e mesmo dia dos registros ticotico'
          else 'sem unidade válida e sem evidência de origem'
        end,
        case
          when %1$L = 'eventos' and x.unidade_id is null and to_jsonb(x)->>'tag' ilike 'seldeestrela%%' then 'reatribuir para seldeestrela (SEC_RLS_2_REATRIBUIR_EVENTO.sql, aprovação própria)'
          else 'manter só para o super admin; decidir com o dono (arquivar ou apagar)'
        end
        from public.%1$I x
       where x.unidade_id is null or not exists (select 1 from public.unidades u where u.id::text = x.unidade_id::text)
      on conflict (tabela, registro_id) do nothing
    $q$, t);
  end loop;
end $$;

-- ── FUNÇÕES DE ACESSO ────────────────────────────────────────────────────────
-- "ver tudo" é só do super admin (antes: escopo empresa/todos via todas as empresas)
create or replace function public.pode_ver_todas() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo'
                   and (u.locked_until is null or u.locked_until <= now()) and u.super_admin)
$$;

create or replace function public.hefisto_ve_todas_unidades() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo'
                   and (u.locked_until is null or u.locked_until <= now()) and u.super_admin)
$$;

-- unidades que o usuário alcança: principal, escopo de unidade e (dono) as da PRÓPRIA empresa
create or replace function public.hefisto_unidades_do_usuario() returns text[]
language sql stable security definer set search_path = public as $$
  with eu as (
    select u.id, u.unidade_principal_id from public.usuarios_erp u
     where u.auth_user_id = auth.uid() and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now())
  )
  select coalesce(array_agg(distinct x.unidade_id), '{}'::text[]) from (
    select eu.unidade_principal_id as unidade_id from eu where eu.unidade_principal_id is not null
    union
    select e.unidade_id from public.usuario_escopos e join eu on eu.id = e.usuario_id where e.unidade_id is not null
    union  -- escopo de empresa com empresa_id: as unidades dessa empresa
    select un.id from public.usuario_escopos e join eu on eu.id = e.usuario_id join public.unidades un on un.empresa_id = e.empresa_id
     where e.data_scope in ('empresa', 'todos') and e.empresa_id is not null
    union  -- escopo de empresa sem empresa_id: a empresa da unidade principal (nunca as outras)
    select un.id from public.usuario_escopos e join eu on eu.id = e.usuario_id
      join public.unidades up on up.id = eu.unidade_principal_id join public.unidades un on un.empresa_id = up.empresa_id
     where e.data_scope in ('empresa', 'todos') and e.empresa_id is null and up.empresa_id is not null
  ) x
$$;

-- unidades em que o usuário tem a permissão (calculada uma vez por consulta)
create or replace function public.hefisto_unidades_com_permissao(p_permission text) returns text[]
language sql stable security definer set search_path = public as $$
  select case when public.hefisto_user_has_permission(auth.uid(), p_permission) then public.hefisto_unidades_do_usuario() else '{}'::text[] end
$$;

-- colaborador(es) ligados ao usuário logado (dados próprios)
create or replace function public.hefisto_meus_colaboradores() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct c), '{}'::uuid[]) from (
    select unnest(array[u.colaborador_id, u.funcionario_id]) c from public.usuarios_erp u
     where u.auth_user_id = auth.uid() and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now())
  ) x where c is not null
$$;

-- lista da equipe SEM dados sensíveis, para as telas operacionais (ponto, escala, produção…)
create or replace function public.hefisto_colaboradores_operacional(p_unidade_id text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
           (select jsonb_object_agg(k.key, k.value) from jsonb_each(to_jsonb(c)) k
             where k.key = any (array['id', 'unidade_id', 'nome', 'cargo', 'status', 'status_contrato', 'tipo_contrato', 'data_admissao', 'data_desligamento',
               'horario_entrada', 'horario_saida', 'dias_trabalho', 'tempo_intervalo', 'horario_dom_entrada', 'horario_dom_saida', 'horario_por_dia', 'horarios_dia',
               'intervalo_inicio', 'intervalo_fim', 'intervalo_dom_inicio', 'intervalo_dom_fim', 'ordem_escala', 'area_escala', 'setor_entrega',
               'acesso_todas_areas', 'supervisor_id', 'supervisores_ids', 'topicos_funcao', 'foto', 'janta_ofertada', 'created_at']))
           order by c.nome), '[]'::jsonb)
    from public.colaboradores c
   where ((select public.hefisto_ve_todas_unidades()) or c.unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
     and (p_unidade_id is null or c.unidade_id = p_unidade_id)
$$;

-- o navegador não lê mais o token da NF-e; só sabe se está preenchido
create or replace function public.hefisto_token_nfe_configurado(p_unidade_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(u.token_nfe, '') <> '' from public.unidades u
                    where u.id = p_unidade_id and ((select public.hefisto_ve_todas_unidades()) or u.id = any (public.hefisto_unidades_do_usuario()))), false)
$$;

revoke all on function public.hefisto_unidades_com_permissao(text) from public, anon;
revoke all on function public.hefisto_meus_colaboradores() from public, anon;
revoke all on function public.hefisto_colaboradores_operacional(text) from public, anon;
revoke all on function public.hefisto_token_nfe_configurado(text) from public, anon;
revoke all on function public.pode_ver_todas() from public, anon;
grant execute on function public.hefisto_unidades_com_permissao(text) to authenticated;
grant execute on function public.hefisto_meus_colaboradores() to authenticated;
grant execute on function public.hefisto_colaboradores_operacional(text) to authenticated;
grant execute on function public.hefisto_token_nfe_configurado(text) to authenticated;
grant execute on function public.pode_ver_todas() to authenticated;

-- ── TROCA DAS POLICIES ───────────────────────────────────────────────────────
do $$
declare t text; r record; pol record; nulo boolean;
  v_unidade constant text := '(select public.hefisto_ve_todas_unidades()) or unidade_id::text in (select unnest(public.hefisto_unidades_do_usuario()))';
begin
  -- todas as 31: tira as policies de antes (estão no backup)
  for t in select tabela from _sec2_todas loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- tabelas da unidade (registro legado fica só para o super admin)
  for t in select tabela from _sec2_unidade loop
    execute format('create policy sec_unidade on public.%I for all to authenticated using (%s) with check (%s)', t, v_unidade, v_unidade);
    select is_nullable = 'YES' into nulo from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'unidade_id';
    if nulo then
      execute format('drop trigger if exists sec_unidade_padrao on public.%I', t);
      execute format('create trigger sec_unidade_padrao before insert on public.%I for each row execute function public.hefisto_unidade_padrao()', t);
    end if;
  end loop;

  -- tabelas-filhas: a filha segue a mãe (a RLS da mãe vale na subconsulta)
  for r in select * from _sec2_filha loop
    execute format('create policy sec_pai on public.%1$I for all to authenticated
      using ((select public.hefisto_ve_todas_unidades()) or exists (select 1 from public.%2$I m where m.id = %1$I.%3$I))
      with check ((select public.hefisto_ve_todas_unidades()) or exists (select 1 from public.%2$I m where m.id = %1$I.%3$I))', r.tabela, r.mae, r.coluna);
  end loop;
end $$;

-- colaboradores: o próprio, RH/gerência autorizados da unidade, super admin
create policy sec_colab_ler on public.colaboradores for select to authenticated using (
  (select public.hefisto_ve_todas_unidades())
  or id in (select unnest(public.hefisto_meus_colaboradores()))
  or unidade_id in (select unnest(public.hefisto_unidades_com_permissao('rh.employees.view'))));
create policy sec_colab_criar on public.colaboradores for insert to authenticated with check (
  (select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_com_permissao('rh.employees.create'))));
create policy sec_colab_editar on public.colaboradores for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_com_permissao('rh.employees.edit'))))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_com_permissao('rh.employees.edit'))));
create policy sec_colab_apagar on public.colaboradores for delete to authenticated using (
  (select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_com_permissao('rh.employees.delete'))));

-- usuarios_erp e usuario_escopos: só leitura pelo navegador (a gestão é pelo servidor)
create policy sec_usuario_ler on public.usuarios_erp for select to authenticated using (
  auth_user_id = auth.uid() or (select public.hefisto_ve_todas_unidades())
  or unidade_principal_id in (select unnest(public.hefisto_unidades_com_permissao('configuracoes.users.view'))));
create policy sec_escopo_ler on public.usuario_escopos for select to authenticated using (
  (select public.hefisto_ve_todas_unidades())
  or usuario_id in (select u.id from public.usuarios_erp u where u.auth_user_id = auth.uid())
  or unidade_id in (select unnest(public.hefisto_unidades_com_permissao('configuracoes.users.view'))));

-- unidades: as do usuário; editar com permissão; criar/apagar só super admin
create policy sec_unidades_ler on public.unidades for select to authenticated using (
  (select public.hefisto_ve_todas_unidades()) or id in (select unnest(public.hefisto_unidades_do_usuario())));
create policy sec_unidades_editar on public.unidades for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or id in (select unnest(public.hefisto_unidades_com_permissao('configuracoes.units.edit')))
         or id in (select unnest(public.hefisto_unidades_com_permissao('configuracoes.store.edit'))))
  with check ((select public.hefisto_ve_todas_unidades()) or id in (select unnest(public.hefisto_unidades_com_permissao('configuracoes.units.edit')))
         or id in (select unnest(public.hefisto_unidades_com_permissao('configuracoes.store.edit'))));
create policy sec_unidades_criar on public.unidades for insert to authenticated with check ((select public.hefisto_ve_todas_unidades()));
create policy sec_unidades_apagar on public.unidades for delete to authenticated using ((select public.hefisto_ve_todas_unidades()));

-- token da NF-e: o navegador grava, mas não lê
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'unidades' and column_name <> 'token_nfe';
  execute 'revoke select on table public.unidades from authenticated';
  execute format('grant select (%s) on table public.unidades to authenticated', cols);
end $$;

-- perfis: os do sistema para todos os logados; perfis próprios (sem empresa ainda) só super admin
create policy sec_perfis_ler on public.perfis_acesso for select to authenticated using (sistema or (select public.hefisto_ve_todas_unidades()));
create policy sec_auditoria_perm_ler on public.permissoes_auditoria for select to authenticated using ((select public.hefisto_ve_todas_unidades()));
-- ponto (tabela antiga, vazia): RLS ligado e nenhuma policy = fechada

-- ── VERIFICAÇÃO (aborta e desfaz tudo se algo não bateu) ────────────────────
do $$
declare n int;
begin
  select count(*) into n from _sec2_todas a join pg_class c on c.oid = ('public.' || a.tabela)::regclass where not c.relrowsecurity;
  if n > 0 then raise exception 'SEC-RLS-2 verificação: % tabela(s) sem RLS', n; end if;
  select count(*) into n from pg_policies p join _sec2_todas a on a.tabela = p.tablename
   where p.schemaname = 'public' and (coalesce(p.qual, '') ~* '^\(?\s*true\s*\)?$' or coalesce(p.with_check, '') ~* '^\(?\s*true\s*\)?$'
     or coalesce(p.qual, '') ~* 'auth\.role\(\)' or coalesce(p.qual, '') ~* 'unidade_id\s+is\s+null');
  if n > 0 then raise exception 'SEC-RLS-2 verificação: % policy aberta', n; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and policyname = 'sec_pai';
  if n <> 15 then raise exception 'SEC-RLS-2 verificação: % sec_pai (esperado 15)', n; end if;
  select count(*) into n from pg_policies p join _sec2_unidade a on a.tabela = p.tablename where p.schemaname = 'public' and p.policyname = 'sec_unidade';
  if n <> 9 then raise exception 'SEC-RLS-2 verificação: % sec_unidade nas tabelas da fase 2 (esperado 9)', n; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'colaboradores' and policyname = 'sec_unidade') then
    raise exception 'SEC-RLS-2 verificação: colaboradores ainda com sec_unidade';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ponto') then raise exception 'SEC-RLS-2 verificação: ponto com policy'; end if;
  if has_column_privilege('authenticated', 'public.unidades', 'token_nfe', 'select') then raise exception 'SEC-RLS-2 verificação: token_nfe ainda legível'; end if;
  if not has_column_privilege('authenticated', 'public.unidades', 'token_nfe', 'update') then raise exception 'SEC-RLS-2 verificação: token_nfe deixou de ser gravável'; end if;
  if pg_get_functiondef('public.pode_ver_todas()'::regprocedure) ~* 'empresa|todos' then raise exception 'SEC-RLS-2 verificação: pode_ver_todas ainda aceita escopo amplo'; end if;
  if has_function_privilege('anon', 'public.hefisto_colaboradores_operacional(text)', 'execute') then raise exception 'SEC-RLS-2 verificação: anon executa a lista'; end if;
end $$;

commit;

/* ── CONFERÊNCIA (só leitura; rode depois) ─────────────────────────────────
select classificacao, tabela, count(*) from public.sec_dados_legados group by 1, 2 order by 1, 2;
select md5(string_agg(tablename || ':' || policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), '|' order by tablename, policyname))
  from pg_policies where schemaname = 'public' and policyname in ('sec_pai', 'sec_colab_ler', 'sec_colab_criar', 'sec_colab_editar', 'sec_colab_apagar',
    'sec_usuario_ler', 'sec_escopo_ler', 'sec_unidades_ler', 'sec_unidades_editar', 'sec_unidades_criar', 'sec_unidades_apagar', 'sec_perfis_ler', 'sec_auditoria_perm_ler');
   ─────────────────────────────────────────────────────────────────────────── */

/* ── ROLLBACK: db/security/SEC_RLS_2_ROLLBACK.sql (só com o dono) ── */
