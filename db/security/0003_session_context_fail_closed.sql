/* PROPOSTA (NÃO EXECUTADA): hefisto_session_context() fechada por padrão.

   O QUE ESTÁ ERRADO
   A versão de docs/controle-acesso-rbac.sql devolve o contexto completo —
   papel, permissões, escopos, unidade — para qualquer usuário encontrado em
   usuarios_erp, inclusive 'bloqueado' e 'desativado'. Bloquear alguém hoje
   depende de a interface olhar o campo `status` e deslogar; quem chamar o RPC
   direto (ou usar um cliente próprio com o token) continua recebendo o
   contexto privilegiado.

   O QUE ESTA MIGRAÇÃO FAZ
   Só isso: nega o contexto para usuário inexistente e para usuário que não
   esteja 'ativo'. Mesma assinatura, mesmo retorno, mesmas permissões de
   execução. Nada mais muda.

   EFEITO NA INTERFACE
   Sessão sem contexto vira papel `sem_acesso` (app/lib/papeis.mjs) — nenhum
   módulo aparece. É o mesmo que o app já fazia ao ver status diferente de
   ativo, agora garantido no banco.

   Idempotente (create or replace). Ainda não aplicada em lugar nenhum.
*/

/* ═══════════════════════════════════════════════════════════════════════════
   PRÉVIA (rode sozinha): quem perde o contexto ao aplicar isto
   ═══════════════════════════════════════════════════════════════════════════

select login, nome, status, tipo_acesso, super_admin
from usuarios_erp
where status is distinct from 'ativo'
order by status, login;

   ═══════════════════════════════════════════════════════════════════════════ */

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'usuarios_erp'
  ) then
    raise exception 'PREFLIGHT: public.usuarios_erp não existe. Rode docs/controle-acesso-rbac.sql antes.';
  end if;
end $$;

create or replace function public.hefisto_session_context()
returns jsonb
language plpgsql security definer stable set search_path = public
as $$
declare
  v_user usuarios_erp%rowtype;
  v_permissions jsonb;
  v_scopes jsonb;
  v_profile_name text;
begin
  /* Fechado por padrão: sem cadastro, ou com cadastro não ativo, não existe
     contexto. Era aqui que um usuário bloqueado continuava recebendo papel,
     permissões e escopos. */
  select * into v_user
  from usuarios_erp
  where auth_user_id = auth.uid()
    and status = 'ativo';
  if not found then return null; end if;

  if v_user.super_admin then
    v_permissions := '"*"'::jsonb;
  else
    select coalesce(jsonb_agg(distinct permission_key), '[]'::jsonb)
    into v_permissions
    from (
      select pp.permission_key
      from perfil_permissoes pp
      where pp.perfil_id = v_user.perfil_id
        and not exists (
          select 1 from usuario_permissoes d
          where d.usuario_id = v_user.id and d.effect = 'deny'
            and hefisto_permission_match(d.permission_key, pp.permission_key)
        )
      union
      select up.permission_key from usuario_permissoes up
      where up.usuario_id = v_user.id and up.effect = 'allow'
    ) p;
  end if;

  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
    into v_scopes from usuario_escopos e where e.usuario_id = v_user.id;
  select nome into v_profile_name from perfis_acesso where id = v_user.perfil_id;

  return jsonb_build_object(
    'erp_user_id', v_user.id,
    'nome', v_user.nome,
    'login', v_user.login,
    'email', v_user.email,
    'papel', case when v_user.super_admin then 'admin' else v_user.tipo_acesso end,
    'tipo_acesso', v_user.tipo_acesso,
    'status', v_user.status,
    'super_admin', v_user.super_admin,
    'perfil_id', v_user.perfil_id,
    'perfil', v_profile_name,
    'unidade', v_user.unidade_principal_id,
    'setor_id', v_user.setor_principal_id,
    'home', v_user.pagina_inicial,
    'must_change_password', v_user.exigir_troca_senha,
    'terminate_previous_sessions', v_user.encerrar_sessoes_anteriores,
    'permissions', v_permissions,
    'scopes', v_scopes
  );
end $$;

revoke all on function public.hefisto_session_context() from public;
grant execute on function public.hefisto_session_context() to authenticated, service_role;

/* ═══════════════════════════════════════════════════════════════════════════
   CONFERÊNCIA (rode depois, logado como um usuário bloqueado de teste)

select hefisto_session_context();

   Esperado: null.
   ═══════════════════════════════════════════════════════════════════════════ */
