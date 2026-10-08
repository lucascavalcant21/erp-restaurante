/* SEC-RLS-1 · ISOLAMENTO POR UNIDADE — FASE 1 (HDEV-SEC-001)
   ═══════════════════════════════════════════════════════════════════════════

   PROBLEMA (TESTADO NO SUPABASE REAL, 08/10/2026, só leitura)
   - colaboradores e registro_ponto com RLS DESLIGADO (S-01);
   - ~110 tabelas com policy aberta: USING (true), WITH CHECK (true),
     "auth.role() = 'authenticated'" ou "… OR unidade_id IS NULL" (S-02).
     Qualquer usuário logado de qualquer empresa lê e grava os dados de todas.
   - O anon NÃO tem grant em nenhuma delas (SEC-DADOS-1/2): o risco é entre
     usuários logados, não público.

   O QUE ESTA FASE FAZ (88 tabelas com unidade_id e dados limpos)
   1. Cria duas funções (SECURITY DEFINER, search_path fixo):
        hefisto_ve_todas_unidades()  → super_admin ou escopo 'todos'
        hefisto_unidades_do_usuario() → unidade principal + escopos de unidade
      Usuário inativo, bloqueado ou sem cadastro: nada. Escopo 'empresa' NÃO dá
      todas as unidades (não existe empresa_id em unidades ainda): falha fechada.
   2. Guarda TODAS as policies atuais dessas tabelas em
      public.sec_backup_policies_sec_rls_1 (para o rollback) e as troca por UMA:
        sec_unidade: for all to authenticated
          using/with check ((select hefisto_ve_todas_unidades())
                            or unidade_id::text in (select unnest(hefisto_unidades_do_usuario())))
      O "(select …)" faz o Postgres calcular uma vez por consulta, não por linha.
   3. Liga o RLS onde está desligado (colaboradores, registro_ponto).
   4. Insert sem unidade_id em coluna que aceita nulo recebe a unidade do
      usuário (gatilho sec_unidade_padrao), para nenhuma tela que não manda a
      unidade passar a falhar. service_role (servidor) continua ignorando RLS.

   EFEITO HOJE (1 unidade, 16 usuários): nenhum usuário perde acesso. Os 15
   com unidade principal 'seldeestrela' e o super admin passam (conferido no
   banco real, só leitura). O que muda: outra empresa/unidade não vê nem grava.

   FORA DESTA FASE (fase 2, precisa de decisão do dono sobre os dados)
   - dados órfãos: controle_limpeza e controle_manutencoes ('burguer'),
     suprimentos_historico/suprimentos_unidades ('ticotico' e nulo), montagem
     (12 nulos), eventos (1 nulo), notas_fiscais (15 com 'todas', gravado por
     app/lib/notas.js);
   - sem coluna de unidade (policy pela tabela-mãe): fichas_ingredientes,
     pedidos_itens, evento_*, op_itens/op_respostas/op_secoes/op_acoes_corretivas,
     documentos_rh, ficha_itens, tarefas_templates, suprimentos_catalogo, ponto;
   - cadastro e catálogos globais: usuarios_erp, usuario_escopos, unidades,
     perfis_acesso, permissoes_auditoria, fin_categorias(_legado), fin_centros_custo;
   - colunas sensíveis dentro da mesma unidade (salário, CPF em colaboradores).

   COMO RODAR: só com aprovação do dono (APROVACOES_PENDENTES.md). Inteiro, de
   uma vez. O preflight aborta SEM mudar nada se a base não for a esperada:
   tabela/coluna faltando, linha com unidade fora de public.unidades ou nula,
   usuário ativo sem unidade, ou policy desconhecida numa das tabelas
   (alguém criou uma regra nova: revisar antes de trocar).
   Rollback: no fim do arquivo (só com o dono).
*/

begin;

-- ── PREFLIGHT (aborta sem mudar nada) ───────────────────────────────────────
create temp table _sec_rls_1_alvo (tabela text primary key) on commit drop;
insert into _sec_rls_1_alvo values
  ('acessos_modulo'), ('caixas'), ('candidatos'), ('cervejas'), ('checklists_execucoes'), ('checklists_templates'),
  ('colaboradores'), ('comandas'), ('config_impressoes'), ('config_pins'), ('config_sistema'), ('controle_gas'),
  ('controle_oleo'), ('drinks'), ('empresa_documentos'), ('escalas_dia'), ('estoque_atual'), ('estoques'),
  ('etiquetas'), ('extras_cadastros'), ('fichas_alergenicos'), ('fichas_armazenamento'), ('fichas_custo_historico'),
  ('fichas_equipamentos'), ('fichas_etapas'), ('fichas_montagem_passos'), ('fichas_tecnicas'), ('fichas_versoes'),
  ('gastos_administrativos'), ('guias_operacionais'), ('hefisto_auditoria'), ('insumos'), ('insumos_fornecedores'),
  ('insumos_precos_historico'), ('inventario_itens'), ('inventario_movimentos'), ('listas_etiquetas'),
  ('manutencao_servicos'), ('memorandos_operacao'), ('mesas'), ('op_agendas'), ('op_alertas'), ('op_auditoria'),
  ('op_evidencias'), ('op_execucoes'), ('op_nao_conformidades'), ('op_processos'), ('operacao_embalagens'),
  ('operacao_embalagens_consumo'), ('pdv_caixas'), ('pdv_movimentacoes'), ('pedidos'), ('ponto_marcacao'),
  ('producao_diaria'), ('producoes'), ('produtos'), ('registro_ponto'), ('reservas'), ('rh_advertencias_colab'),
  ('rh_atas'), ('rh_atas_reuniao'), ('rh_atestados'), ('rh_banco_horas'), ('rh_bonificacoes'), ('rh_cargos'),
  ('rh_consumo_funcionarios'), ('rh_espelho_fechado'), ('rh_feriados'), ('rh_folgas_esporadicas'), ('rh_historico'),
  ('rh_recibos_prestacao'), ('rh_regulamentos'), ('rh_tipos_bonificacao'), ('rh_turnos'), ('tarefas_instancias'),
  ('treinamentos'), ('venda_itens'), ('vendas'),
  -- achadas pela AUDITORIA_RLS.sql (só auth.role() = 'authenticated' ou … OR unidade_id IS NULL; vazias em 08/10)
  ('advertencias'), ('avaliacoes_nps'), ('avisos'), ('campanhas'), ('cardapio'), ('clientes'), ('cupons'), ('cursos'), ('func_documentos'), ('observacoes_padrao');

do $$
declare
  t text; n bigint; pol record;
begin
  if (select count(*) from _sec_rls_1_alvo) <> 88 then raise exception 'SEC-RLS-1 preflight: lista de tabelas mudou'; end if;
  if to_regclass('public.unidades') is null or to_regclass('public.usuarios_erp') is null or to_regclass('public.usuario_escopos') is null then
    raise exception 'SEC-RLS-1 preflight: falta unidades/usuarios_erp/usuario_escopos. Nada foi alterado.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'sec_unidade') then
    raise exception 'SEC-RLS-1 preflight: já aplicada (existe policy sec_unidade). Nada foi alterado.';
  end if;
  -- todo usuário ativo tem como ver alguma unidade (senão perderia o acesso)
  select count(*) into n from public.usuarios_erp u
   where u.status = 'ativo' and not u.super_admin and u.unidade_principal_id is null
     and not exists (select 1 from public.usuario_escopos e where e.usuario_id = u.id and (e.data_scope = 'todos' or e.unidade_id is not null));
  if n > 0 then raise exception 'SEC-RLS-1 preflight: % usuário(s) ativo(s) sem unidade nem escopo perderiam o acesso. Nada foi alterado.', n; end if;

  for t in select tabela from _sec_rls_1_alvo order by tabela loop
    if to_regclass('public.' || t) is null then raise exception 'SEC-RLS-1 preflight: tabela public.% não existe. Nada foi alterado.', t; end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'unidade_id') then
      raise exception 'SEC-RLS-1 preflight: public.% sem coluna unidade_id. Nada foi alterado.', t;
    end if;
    -- linha que ficaria invisível para a equipe (unidade nula ou que não existe)
    execute format('select count(*) from public.%I x where x.unidade_id is null or not exists (select 1 from public.unidades u where u.id::text = x.unidade_id::text)', t) into n;
    if n > 0 then raise exception 'SEC-RLS-1 preflight: public.% tem % linha(s) sem unidade válida (ficariam invisíveis). Nada foi alterado.', t, n; end if;
    -- só troca policy que reconhece como aberta; policy nova/desconhecida para tudo
    for pol in select policyname, coalesce(qual, '') q, coalesce(with_check, '') c from pg_policies where schemaname = 'public' and tablename = t loop
      if not (
        (pol.q ~* '^\(?\s*true\s*\)?$' or pol.q = '' or pol.q ~* '^\(?\s*\(?auth\.role\(\)\)?\s*=\s*''authenticated''::text\s*\)?$'
          or pol.q ~* '^\(\s*pode_ver_todas\(\)\s+or\s+\(unidade_id\s*=\s*auth_unidade_id\(\)\)\s+or\s+\(unidade_id\s+is\s+null\)\s*\)$')
        and (pol.c ~* '^\(?\s*true\s*\)?$' or pol.c = ''
          or pol.c ~* '^\(\s*pode_ver_todas\(\)\s+or\s+\(unidade_id\s*=\s*auth_unidade_id\(\)\)\s+or\s+\(unidade_id\s+is\s+null\)\s*\)$')
      ) then
        raise exception 'SEC-RLS-1 preflight: policy desconhecida "%" em public.% (using=%, check=%). Revise antes. Nada foi alterado.', pol.policyname, t, pol.q, pol.c;
      end if;
    end loop;
  end loop;
end $$;

-- ── FUNÇÕES DE ACESSO ────────────────────────────────────────────────────────
create or replace function public.hefisto_ve_todas_unidades() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios_erp u
     where u.auth_user_id = auth.uid() and u.status = 'ativo'
       and (u.locked_until is null or u.locked_until <= now())
       and (u.super_admin or exists (select 1 from public.usuario_escopos e where e.usuario_id = u.id and e.data_scope = 'todos'))
  )
$$;

create or replace function public.hefisto_unidades_do_usuario() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x.unidade_id), '{}'::text[]) from (
    select u.unidade_principal_id as unidade_id from public.usuarios_erp u
     where u.auth_user_id = auth.uid() and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now()) and u.unidade_principal_id is not null
    union
    select e.unidade_id from public.usuario_escopos e join public.usuarios_erp u on u.id = e.usuario_id
     where u.auth_user_id = auth.uid() and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now()) and e.unidade_id is not null
  ) x
$$;

-- unidade padrão no insert sem unidade_id (mantém as telas que não mandam a unidade)
create or replace function public.hefisto_unidade_padrao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.unidade_id is null and auth.uid() is not null then
    new.unidade_id := (select u.unidade_principal_id from public.usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo' limit 1);
  end if;
  return new;
end $$;

revoke all on function public.hefisto_ve_todas_unidades() from public, anon;
revoke all on function public.hefisto_unidades_do_usuario() from public, anon;
revoke all on function public.hefisto_unidade_padrao() from public, anon, authenticated;
grant execute on function public.hefisto_ve_todas_unidades() to authenticated;
grant execute on function public.hefisto_unidades_do_usuario() to authenticated;

-- ── BACKUP DAS POLICIES E DO ESTADO DO RLS (para o rollback) ────────────────
create table if not exists public.sec_backup_policies_sec_rls_1 (
  tabela text not null, policyname text not null, permissive text, cmd text, roles text[],
  qual text, with_check text, rls_estava_ligado boolean, guardado_em timestamptz default now()
);
revoke all on table public.sec_backup_policies_sec_rls_1 from public, anon, authenticated;
alter table public.sec_backup_policies_sec_rls_1 enable row level security;

insert into public.sec_backup_policies_sec_rls_1 (tabela, policyname, permissive, cmd, roles, qual, with_check, rls_estava_ligado)
select a.tabela, coalesce(p.policyname, '(sem policy)'), p.permissive, p.cmd, p.roles::text[], p.qual, p.with_check, c.relrowsecurity
  from _sec_rls_1_alvo a
  join pg_class c on c.oid = ('public.' || a.tabela)::regclass
  left join pg_policies p on p.schemaname = 'public' and p.tablename = a.tabela;

-- ── TROCA ────────────────────────────────────────────────────────────────────
do $$
declare t text; pol record; nulo boolean;
begin
  for t in select tabela from _sec_rls_1_alvo order by tabela loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy sec_unidade on public.%I for all to authenticated
      using ((select public.hefisto_ve_todas_unidades()) or unidade_id::text in (select unnest(public.hefisto_unidades_do_usuario())))
      with check ((select public.hefisto_ve_todas_unidades()) or unidade_id::text in (select unnest(public.hefisto_unidades_do_usuario())))$p$, t);
    select is_nullable = 'YES' into nulo from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'unidade_id';
    if nulo then
      execute format('drop trigger if exists sec_unidade_padrao on public.%I', t);
      execute format('create trigger sec_unidade_padrao before insert on public.%I for each row execute function public.hefisto_unidade_padrao()', t);
    end if;
  end loop;
end $$;

-- ── VERIFICAÇÃO (aborta e desfaz tudo se algo não bateu) ────────────────────
do $$
declare n int;
begin
  select count(*) into n from _sec_rls_1_alvo a join pg_class c on c.oid = ('public.' || a.tabela)::regclass where not c.relrowsecurity;
  if n > 0 then raise exception 'SEC-RLS-1 verificação: % tabela(s) sem RLS', n; end if;
  select count(*) into n from pg_policies p join _sec_rls_1_alvo a on a.tabela = p.tablename where p.schemaname = 'public' and p.policyname <> 'sec_unidade';
  if n > 0 then raise exception 'SEC-RLS-1 verificação: sobrou % policy antiga', n; end if;
  select count(*) into n from pg_policies p join _sec_rls_1_alvo a on a.tabela = p.tablename where p.schemaname = 'public' and p.policyname = 'sec_unidade';
  if n <> 88 then raise exception 'SEC-RLS-1 verificação: % policies sec_unidade (esperado 88)', n; end if;
  select count(*) into n from pg_policies p join _sec_rls_1_alvo a on a.tabela = p.tablename
   where p.schemaname = 'public' and (coalesce(p.qual, '') ~* '^\(?\s*true\s*\)?$' or coalesce(p.with_check, '') ~* '^\(?\s*true\s*\)?$');
  if n > 0 then raise exception 'SEC-RLS-1 verificação: % policy aberta', n; end if;
  if has_function_privilege('anon', 'public.hefisto_unidades_do_usuario()', 'execute') then raise exception 'SEC-RLS-1 verificação: anon executa a função'; end if;
end $$;

commit;

/* ── CONFERÊNCIA (só leitura; rode depois) ─────────────────────────────────
select count(*) filter (where p.policyname = 'sec_unidade') as policies_sec_unidade,
       count(*) filter (where coalesce(p.qual,'') ~* '^\(?\s*true\s*\)?$') as abertas_restantes_no_banco
  from pg_policies p where p.schemaname = 'public';
select count(*) as linhas_no_backup from public.sec_backup_policies_sec_rls_1;
-- impressão digital: md5 das 88 definições sec_unidade
select md5(string_agg(tablename || ':' || qual || ':' || with_check, '|' order by tablename))
  from pg_policies where schemaname = 'public' and policyname = 'sec_unidade';
   ─────────────────────────────────────────────────────────────────────────── */

/* ── ROLLBACK: db/security/SEC_RLS_1_ROLLBACK.sql (só com o dono; testado no PGlite) ── */
