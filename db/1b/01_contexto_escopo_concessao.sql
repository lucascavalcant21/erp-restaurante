/*
  HEFISTO — FASE 1B — MIGRAÇÃO 01 DE 04: CONTEXTO, ESCOPO E CONCESSÃO

  PRÉ-REQUISITO
    Etapa 3 da Fase 1A aplicada (db/migracao_rbac_tabelas_sensiveis.sql).

  O QUE FAZ
    Corrige e completa as funções de acesso que as policies e as rotas já usam.
    Não cria um segundo sistema de permissão: o mesmo catálogo, as mesmas
    tabelas (usuarios_erp, perfis_acesso, perfil_permissoes, usuario_permissoes,
    usuario_escopos), as mesmas funções — com quatro correções:

    a) ESCOPO "empresa" valia como "todas as unidades de todas as empresas".
       Agora vale só para as unidades da empresa do escopo.
    b) PERFIL DESATIVADO continuava dando permissão. Agora não dá.
    c) USUÁRIO VÁLIDO passa a ser uma regra só (ativo, não bloqueado, dentro da
       vigência, do dia e do horário permitidos, e com perfil ativo, permissão
       própria ou administrador geral). Usuário sem nada disso tem escopo vazio.
    d) CONCESSÃO: funções para a API de acessos recusar quem tenta dar
       permissão, perfil ou escopo que não tem, ou mexer em usuário fora do
       próprio escopo (antes, quem podia "configurar usuários" se dava "*").

    E acrescenta, para o RequestContext do servidor e a auditoria futura:
      hefisto_contexto_requisicao(unidade)  quem é, perfil, unidade validada,
                                             empresa da unidade, permissões
      hefisto_contexto_auditoria()          request id e canal da requisição

  DADOS
    Unidade sem empresa: se existir UMA empresa só, a unidade passa a ser dela
    (sem isso o escopo "empresa" deixaria de enxergá-la). Com mais de uma
    empresa, nada é alterado e o relatório lista as unidades.

  ROLLBACK
    db/1b/rollback_01_contexto_escopo_concessao.sql (restaura as definições
    fotografadas e o empresa_id das unidades ajustadas).
*/

begin;

create temp table if not exists hefisto_relatorio (
  ordem serial, etapa text, verificacao text, situacao text, detalhe text
) on commit preserve rows;
truncate hefisto_relatorio;

/* 1. PRÉ-CHECK */
do $$
declare
  v_faltando text;
begin
  if to_regprocedure('public.hefisto_user_has_permission(uuid,text)') is null
     or to_regprocedure('public.hefisto_escopo_unidades()') is null
     or to_regprocedure('public.hefisto_unidades_com_permissao(text[])') is null then
    raise exception '1B-01 abortada: controle de acesso ou Etapa 3 não instalados.';
  end if;
  if to_regclass('hefisto_privado.snapshot_seguranca') is null
     or not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = 'etapa3') then
    raise exception '1B-01 abortada: a Etapa 3 da Fase 1A não foi aplicada.';
  end if;

  select string_agg(format('%s.%s', t, c), ', ') into v_faltando
  from (values ('empresas', 'id'), ('unidades', 'empresa_id'), ('usuario_escopos', 'empresa_id'),
               ('usuario_escopos', 'data_scope'), ('perfis_acesso', 'ativo'), ('usuarios_erp', 'super_admin')) x(t, c)
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = x.t and column_name = x.c);
  if v_faltando is not null then
    raise exception '1B-01 abortada. Colunas ausentes: %', v_faltando;
  end if;

  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values ('01 pré-check', 'Etapa 3 e controle de acesso', 'OK', '');
end $$;

insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
select '01 pré-check', 'escopos "empresa" sem empresa_id (passam a valer a empresa da unidade principal)',
       case when count(*) = 0 then 'OK' else 'ATENÇÃO' end,
       case when count(*) = 0 then 'nenhum' else string_agg(u.login, ', ') end
from public.usuario_escopos e join public.usuarios_erp u on u.id = e.usuario_id
where e.data_scope = 'empresa' and e.empresa_id is null;

insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
select '01 pré-check', 'usuários ativos que perdem acesso por perfil desativado',
       case when count(*) = 0 then 'OK' else 'ATENÇÃO' end,
       case when count(*) = 0 then 'nenhum' else string_agg(u.login, ', ') end
from public.usuarios_erp u join public.perfis_acesso p on p.id = u.perfil_id
where u.status = 'ativo' and not u.super_admin and not p.ativo;

/* 2. FOTOGRAFIA das funções substituídas e das unidades ajustadas (só na primeira execução) */
do $$
declare
  f text;
  v_empresas integer;
begin
  if exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-01') then
    insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values ('01 fotografia', 'fotografia anterior preservada', 'OK', 'reexecução');
    return;
  end if;

  foreach f in array array['public.hefisto_user_has_permission(uuid,text)', 'public.hefisto_user_in_unit(uuid,text)',
                           'public.hefisto_escopo_unidades()', 'public.hefisto_unidades_com_permissao(text[])'] loop
    insert into hefisto_privado.snapshot_seguranca (etapa, tipo, objeto, dados)
    values ('1b-01', 'funcao', f, jsonb_build_object('definicao', pg_get_functiondef(f::regprocedure)));
  end loop;

  select count(*) into v_empresas from public.empresas;
  if v_empresas = 1 then
    insert into hefisto_privado.snapshot_seguranca (etapa, tipo, objeto, dados)
    select '1b-01', 'unidade_sem_empresa', format('public.unidades.%s', u.id), jsonb_build_object('unidade_id', u.id)
    from public.unidades u where u.empresa_id is null;
  end if;

  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
  select '01 fotografia', 'estado anterior guardado', 'OK',
         (select count(*) from hefisto_privado.snapshot_seguranca where etapa = '1b-01')::text || ' registros';
end $$;

/* 3. DADOS: unidade sem empresa, quando só existe uma empresa */
do $$
declare
  v_empresas integer;
  v_ajustadas integer := 0;
  v_lista text;
begin
  select count(*) into v_empresas from public.empresas;
  if v_empresas = 1 then
    update public.unidades set empresa_id = (select id from public.empresas limit 1) where empresa_id is null;
    get diagnostics v_ajustadas = row_count;
    insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
    values ('01 dados', 'unidades sem empresa ligadas à única empresa', 'OK', v_ajustadas::text);
  else
    select string_agg(id, ', ') into v_lista from public.unidades where empresa_id is null;
    insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
    values ('01 dados', 'unidades sem empresa (mais de uma empresa: não alterado)',
            case when v_lista is null then 'OK' else 'ATENÇÃO' end, coalesce(v_lista, 'nenhuma'));
  end if;
end $$;

/* 4. FUNÇÕES */

/* Usuário pode agir agora? Mesmas regras em todo lugar (policy, rota, função). */
create or replace function public.hefisto_usuario_valido(p_auth_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user public.usuarios_erp%rowtype;
  v_local timestamp;
begin
  if p_auth_user_id is null then return false; end if;
  select * into v_user from public.usuarios_erp where auth_user_id = p_auth_user_id;
  if not found or v_user.status <> 'ativo' then return false; end if;
  if v_user.locked_until is not null and v_user.locked_until > now() then return false; end if;
  if v_user.valid_from is not null and v_user.valid_from > now() then return false; end if;
  if v_user.valid_until is not null and v_user.valid_until < now() then return false; end if;
  v_local := now() at time zone coalesce(v_user.timezone, 'America/Sao_Paulo');
  if not (extract(dow from v_local)::smallint = any(v_user.allowed_days)) then return false; end if;
  if v_user.allowed_start_time is not null and v_local::time < v_user.allowed_start_time then return false; end if;
  if v_user.allowed_end_time is not null and v_local::time > v_user.allowed_end_time then return false; end if;
  if v_user.super_admin then return true; end if;
  return exists (select 1 from public.perfis_acesso p where p.id = v_user.perfil_id and p.ativo)
      or exists (select 1 from public.usuario_permissoes up where up.usuario_id = v_user.id and up.effect = 'allow');
end;
$$;

/* Tem ALGUMA das permissões? Uma consulta só (as policies pedem listas longas).
   Negação explícita vence a concessão da mesma chave; perfil desativado não concede. */
create or replace function public.hefisto_tem_alguma_permissao(p_auth_user_id uuid, p_chaves text[])
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user public.usuarios_erp%rowtype;
begin
  if not public.hefisto_usuario_valido(p_auth_user_id) then return false; end if;
  select * into v_user from public.usuarios_erp where auth_user_id = p_auth_user_id;
  if v_user.super_admin then return true; end if;
  return exists (
    select 1
    from unnest(coalesce(p_chaves, array[]::text[])) as w(chave)
    where not exists (
            select 1 from public.usuario_permissoes d
            where d.usuario_id = v_user.id and d.effect = 'deny'
              and public.hefisto_permission_match(d.permission_key, w.chave))
      and (
            exists (select 1 from public.usuario_permissoes a
                    where a.usuario_id = v_user.id and a.effect = 'allow'
                      and public.hefisto_permission_match(a.permission_key, w.chave))
         or exists (select 1 from public.perfil_permissoes pp
                    join public.perfis_acesso p on p.id = pp.perfil_id and p.ativo
                    where pp.perfil_id = v_user.perfil_id
                      and public.hefisto_permission_match(pp.permission_key, w.chave))
      )
  );
end;
$$;

/* Mesma assinatura de sempre: quem já chama continua funcionando. */
create or replace function public.hefisto_user_has_permission(p_auth_user_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.hefisto_tem_alguma_permissao(p_auth_user_id, array[p_permission])
$$;

/* Unidades do escopo de um usuário (sem checar validade). '*' = todas. */
create or replace function public.hefisto_unidades_do_usuario(p_auth_user_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user public.usuarios_erp%rowtype;
begin
  select * into v_user from public.usuarios_erp where auth_user_id = p_auth_user_id;
  if not found then return array[]::text[]; end if;
  if v_user.super_admin then return array['*']; end if;
  if exists (select 1 from public.usuario_escopos e where e.usuario_id = v_user.id and e.data_scope = 'todos') then
    return array['*'];
  end if;
  return array(
    select distinct x from (
      select v_user.unidade_principal_id as x
      union all
      select e.unidade_id from public.usuario_escopos e
      where e.usuario_id = v_user.id and e.data_scope <> 'empresa' and e.unidade_id is not null
      union all
      /* Escopo "empresa": as unidades DAQUELA empresa. Sem empresa no escopo,
         vale a empresa da unidade principal; sem nenhuma das duas, nada. */
      select u.id
      from public.usuario_escopos e
      join public.unidades u on u.empresa_id = coalesce(
        e.empresa_id,
        (select up.empresa_id from public.unidades up where up.id = v_user.unidade_principal_id))
      where e.usuario_id = v_user.id and e.data_scope = 'empresa'
    ) s
    where x is not null
    order by 1
  );
end;
$$;

create or replace function public.hefisto_escopo_unidades()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.hefisto_usuario_valido(auth.uid())
              then public.hefisto_unidades_do_usuario(auth.uid())
              else array[]::text[] end
$$;

create or replace function public.hefisto_unidades_com_permissao(p_permissoes text[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is not null and public.hefisto_tem_alguma_permissao(auth.uid(), p_permissoes)
              then public.hefisto_unidades_do_usuario(auth.uid())
              else array[]::text[] end
$$;

/* Mesma assinatura: unidade nula = operação sem unidade (a permissão decide).
   Agora exige usuário VÁLIDO: a visão equipe_unidade e as funções de PIN usam
   esta função, e ativo sem perfil passava por elas. */
create or replace function public.hefisto_user_in_unit(p_auth_user_id uuid, p_unidade_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.hefisto_usuario_valido(p_auth_user_id)
     and (p_unidade_id is null
          or p_unidade_id = any (public.hefisto_unidades_do_usuario(p_auth_user_id))
          or '*' = any (public.hefisto_unidades_do_usuario(p_auth_user_id)))
$$;

/* Contexto da requisição do usuário ATUAL (auth.uid()). A unidade pedida pelo
   cliente só volta em unidade_id se estiver no escopo; a empresa é sempre a da
   unidade no banco, nunca a que o cliente mandou. */
create or replace function public.hefisto_contexto_requisicao(p_unidade_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_user public.usuarios_erp%rowtype;
  v_perfil public.perfis_acesso%rowtype;
  v_unidades text[];
  v_unidade text;
  v_empresa uuid;
  v_permissoes jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('autenticado', false);
  end if;
  select * into v_user from public.usuarios_erp where auth_user_id = v_uid;
  if not found then
    return jsonb_build_object('autenticado', true, 'cadastrado', false, 'valido', false);
  end if;
  select * into v_perfil from public.perfis_acesso where id = v_user.perfil_id;

  v_unidades := public.hefisto_unidades_do_usuario(v_uid);
  if p_unidade_id is not null
     and (p_unidade_id = any (v_unidades) or '*' = any (v_unidades))
     and exists (select 1 from public.unidades where id = p_unidade_id) then
    v_unidade := p_unidade_id;
  end if;
  select empresa_id into v_empresa from public.unidades
  where id = coalesce(v_unidade, v_user.unidade_principal_id);

  if v_user.super_admin then
    v_permissoes := '["*"]'::jsonb;
  else
    select coalesce(jsonb_agg(distinct k order by k), '[]'::jsonb) into v_permissoes
    from (
      select pp.permission_key as k
      from public.perfil_permissoes pp
      join public.perfis_acesso p on p.id = pp.perfil_id and p.ativo
      where pp.perfil_id = v_user.perfil_id
      union
      select up.permission_key from public.usuario_permissoes up
      where up.usuario_id = v_user.id and up.effect = 'allow'
    ) g
    where not exists (select 1 from public.usuario_permissoes d
                      where d.usuario_id = v_user.id and d.effect = 'deny'
                        and public.hefisto_permission_match(d.permission_key, g.k));
  end if;

  return jsonb_build_object(
    'autenticado', true,
    'cadastrado', true,
    'valido', public.hefisto_usuario_valido(v_uid),
    'auth_user_id', v_uid,
    'usuario_erp_id', v_user.id,
    'super_admin', v_user.super_admin,
    'tipo_acesso', v_user.tipo_acesso,
    'perfil_id', v_user.perfil_id,
    'perfil_codigo', v_perfil.codigo,
    'perfil_ativo', coalesce(v_perfil.ativo, false),
    'unidade_solicitada', p_unidade_id,
    'unidade_id', v_unidade,
    'unidade_permitida', (p_unidade_id is null or v_unidade is not null),
    'unidade_principal_id', v_user.unidade_principal_id,
    'empresa_id', v_empresa,
    'unidades', to_jsonb(v_unidades),
    'permissoes', v_permissoes,
    'negacoes', coalesce((select jsonb_agg(d.permission_key order by d.permission_key)
                          from public.usuario_permissoes d
                          where d.usuario_id = v_user.id and d.effect = 'deny'), '[]'::jsonb)
  );
end;
$$;

/* Contexto para AUDITORIA dentro do banco: quem (auth.uid), request id e canal
   que o servidor mandou nos cabeçalhos. Serve para correlacionar; NUNCA para
   autorizar (cabeçalho é informação do chamador). */
create or replace function public.hefisto_contexto_auditoria()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_request text;
  v_canal text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_request := v_headers ->> 'x-request-id';
  v_canal := v_headers ->> 'x-hefisto-canal';
  return jsonb_build_object(
    'auth_user_id', auth.uid(),
    'usuario_erp_id', (select id from public.usuarios_erp where auth_user_id = auth.uid()),
    'request_id', case when v_request ~ '^[A-Za-z0-9._:-]{8,64}$' then v_request end,
    'canal', case when v_canal in ('web', 'quiosque', 'sistema', 'integracao', 'agente') then v_canal end
  );
end;
$$;

/* ── Concessão (só a API administrativa, com service role, chama) ─────────── */

/* Chaves que o ATOR não pode conceder: as que ele mesmo não tem. */
create or replace function public.hefisto_chaves_nao_concediveis(p_ator uuid, p_chaves text[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct w.chave order by w.chave), array[]::text[])
  from unnest(coalesce(p_chaves, array[]::text[])) as w(chave)
  where not public.hefisto_tem_alguma_permissao(p_ator, array[w.chave])
$$;

/* O ator pode gerenciar este usuário? Só se todas as unidades do alvo estiverem
   no escopo do ator. Administrador geral só é gerenciado por administrador geral.
   Ninguém gerencia a si mesmo por aqui (promoção própria). */
create or replace function public.hefisto_pode_gerenciar_usuario(p_ator uuid, p_alvo_usuario_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ator public.usuarios_erp%rowtype;
  v_alvo public.usuarios_erp%rowtype;
  v_do_ator text[];
  v_do_alvo text[];
begin
  if not public.hefisto_usuario_valido(p_ator) then return false; end if;
  select * into v_ator from public.usuarios_erp where auth_user_id = p_ator;
  select * into v_alvo from public.usuarios_erp where id = p_alvo_usuario_id;
  if not found then return false; end if;
  if v_ator.super_admin then return true; end if;
  if v_alvo.auth_user_id = p_ator then return false; end if;
  if v_alvo.super_admin then return false; end if;
  v_do_ator := public.hefisto_unidades_do_usuario(p_ator);
  if '*' = any (v_do_ator) then return true; end if;
  v_do_alvo := case when v_alvo.auth_user_id is null
                    then array(select distinct x from (
                           select v_alvo.unidade_principal_id x
                           union all select e.unidade_id from public.usuario_escopos e where e.usuario_id = v_alvo.id
                         ) s where x is not null)
                    else public.hefisto_unidades_do_usuario(v_alvo.auth_user_id) end;
  if '*' = any (v_do_alvo) or cardinality(v_do_alvo) = 0 then return false; end if;
  return v_do_alvo <@ v_do_ator;
end;
$$;

/* Escopos pedidos cabem no escopo do ator? jsonb: [{data_scope, unidade_id, empresa_id}] */
create or replace function public.hefisto_escopos_nao_concediveis(p_ator uuid, p_escopos jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ator public.usuarios_erp%rowtype;
  v_do_ator text[];
  v_negados jsonb := '[]'::jsonb;
  e jsonb;
  v_unidades text[];
begin
  select * into v_ator from public.usuarios_erp where auth_user_id = p_ator;
  if not found or not public.hefisto_usuario_valido(p_ator) then return coalesce(p_escopos, '[]'::jsonb); end if;
  if v_ator.super_admin then return v_negados; end if;
  v_do_ator := public.hefisto_unidades_do_usuario(p_ator);
  for e in select * from jsonb_array_elements(coalesce(p_escopos, '[]'::jsonb)) loop
    if e ->> 'data_scope' = 'todos' then
      if not ('*' = any (v_do_ator)) then v_negados := v_negados || jsonb_build_array(e); end if;
    elsif e ->> 'data_scope' = 'empresa' then
      v_unidades := array(select u.id from public.unidades u where u.empresa_id::text = e ->> 'empresa_id');
      if e ->> 'empresa_id' is null or cardinality(v_unidades) = 0
         or not ('*' = any (v_do_ator) or v_unidades <@ v_do_ator) then
        v_negados := v_negados || jsonb_build_array(e);
      end if;
    elsif e ->> 'unidade_id' is not null then
      if not ('*' = any (v_do_ator) or (e ->> 'unidade_id') = any (v_do_ator)) then
        v_negados := v_negados || jsonb_build_array(e);
      end if;
    end if;
  end loop;
  return v_negados;
end;
$$;

/* 5. PRIVILÉGIOS */
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.hefisto_usuario_valido(uuid)', 'public.hefisto_tem_alguma_permissao(uuid,text[])',
    'public.hefisto_user_has_permission(uuid,text)', 'public.hefisto_unidades_do_usuario(uuid)',
    'public.hefisto_escopo_unidades()', 'public.hefisto_unidades_com_permissao(text[])',
    'public.hefisto_user_in_unit(uuid,text)', 'public.hefisto_contexto_requisicao(text)',
    'public.hefisto_contexto_auditoria()', 'public.hefisto_chaves_nao_concediveis(uuid,text[])',
    'public.hefisto_pode_gerenciar_usuario(uuid,uuid)', 'public.hefisto_escopos_nao_concediveis(uuid,jsonb)'
  ] loop
    execute format('revoke all on function %s from public', f);
    begin
      execute format('revoke all on function %s from anon', f);
      execute format('revoke all on function %s from authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    exception when undefined_object then null;
    end;
  end loop;

  /* O usuário logado só executa o que fala DELE MESMO (auth.uid()). Funções que
     recebem o id de outra pessoa ficam com a service role: senão qualquer um
     descobriria permissões e escopo alheios. */
  foreach f in array array[
    'public.hefisto_escopo_unidades()', 'public.hefisto_unidades_com_permissao(text[])',
    'public.hefisto_user_in_unit(uuid,text)', 'public.hefisto_contexto_requisicao(text)',
    'public.hefisto_contexto_auditoria()'
  ] loop
    begin
      execute format('grant execute on function %s to authenticated', f);
    exception when undefined_object then null;
    end;
  end loop;
end $$;

/* 6. PÓS-CHECK */
do $$
declare
  v_lista text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_lista
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('hefisto_usuario_valido', 'hefisto_tem_alguma_permissao', 'hefisto_user_has_permission',
                      'hefisto_unidades_do_usuario', 'hefisto_escopo_unidades', 'hefisto_unidades_com_permissao',
                      'hefisto_user_in_unit', 'hefisto_contexto_requisicao', 'hefisto_contexto_auditoria',
                      'hefisto_chaves_nao_concediveis', 'hefisto_pode_gerenciar_usuario', 'hefisto_escopos_nao_concediveis')
    and (not p.prosecdef or not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false));
  if v_lista is not null then raise exception 'Pós-check falhou: função sem SECURITY DEFINER ou search_path fixo: %', v_lista; end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    select string_agg(x, ', ') into v_lista
    from unnest(array['public.hefisto_contexto_requisicao(text)', 'public.hefisto_user_has_permission(uuid,text)',
                      'public.hefisto_chaves_nao_concediveis(uuid,text[])', 'public.hefisto_pode_gerenciar_usuario(uuid,uuid)',
                      'public.hefisto_unidades_do_usuario(uuid)', 'public.hefisto_tem_alguma_permissao(uuid,text[])']) x
    where has_function_privilege('anon', x, 'EXECUTE');
    if v_lista is not null then raise exception 'Pós-check falhou: anônimo executa %', v_lista; end if;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    select string_agg(x, ', ') into v_lista
    from unnest(array['public.hefisto_user_has_permission(uuid,text)', 'public.hefisto_chaves_nao_concediveis(uuid,text[])',
                      'public.hefisto_pode_gerenciar_usuario(uuid,uuid)', 'public.hefisto_escopos_nao_concediveis(uuid,jsonb)',
                      'public.hefisto_unidades_do_usuario(uuid)', 'public.hefisto_tem_alguma_permissao(uuid,text[])',
                      'public.hefisto_usuario_valido(uuid)']) x
    where has_function_privilege('authenticated', x, 'EXECUTE');
    if v_lista is not null then raise exception 'Pós-check falhou: usuário logado executa função sobre terceiros: %', v_lista; end if;
  end if;

  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values
    ('01 pós-check', 'funções com SECURITY DEFINER e search_path fixo', 'OK', ''),
    ('01 pós-check', 'funções sobre terceiros só com service role', 'OK', '');
end $$;

insert into hefisto_privado.snapshot_seguranca (etapa, tipo, objeto, dados)
select '1b-01', 'marcador', 'aplicada', jsonb_build_object('em', now())
where not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-01' and tipo = 'marcador');

insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
values ('01 fim', 'Migração 01 concluída', 'OK', '');

commit;

select etapa, verificacao, situacao, detalhe from hefisto_relatorio order by ordem;
