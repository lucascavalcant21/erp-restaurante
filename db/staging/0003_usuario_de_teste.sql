/* USUÁRIO DE TESTE DO STAGING — liga um login do Auth ao cadastro do ERP.

   ANTES DE RODAR: crie o usuário no painel do hefisto-staging, em
   Authentication -> Users -> Add user, com um e-mail claramente de teste
   (ex.: teste.hefisto@exemplo.local) e a senha que você escolher. A senha é
   sua: ela não passa por aqui, não fica no Git e não me é mostrada.

   Depois troque o e-mail no bloco abaixo e execute. Idempotente.

   O que este script faz: cria (ou atualiza) a linha em usuarios_erp apontando
   para aquele auth.users, com o perfil "Teste Héfisto" do 0002, unidade
   principal "unidade-teste-a" e escopo na unidade. Não cria senha, não mexe em
   auth.users e não dá super_admin.
*/

do $$
declare
  /* ↓↓↓ TROQUE PELO E-MAIL QUE VOCÊ CRIOU NO AUTH ↓↓↓ */
  v_email text := 'teste.hefisto@exemplo.local';
  /* ↑↑↑ ---------------------------------------- ↑↑↑ */
  v_auth_id uuid;
  v_perfil uuid := 'cccccccc-cccc-4ccc-8ccc-000000000001';
  v_usuario uuid;
begin
  select id into v_auth_id from auth.users where lower(email) = lower(v_email);
  if v_auth_id is null then
    raise exception 'Não achei % em auth.users. Crie o usuário em Authentication -> Users antes de rodar este script.', v_email;
  end if;

  if not exists (select 1 from perfis_acesso where id = v_perfil) then
    raise exception 'Perfil de teste não existe. Rode db/staging/0002_seed_sintetico_staging.sql antes.';
  end if;

  insert into usuarios_erp (auth_user_id, nome, email, login, unidade_principal_id, perfil_id, status, tipo_acesso, pagina_inicial, super_admin)
  values (v_auth_id, 'Usuário de Teste', v_email, split_part(v_email, '@', 1), 'unidade-teste-a', v_perfil, 'ativo', 'gerente', '/dashboard', false)
  on conflict (auth_user_id) do update
    set nome = excluded.nome,
        email = excluded.email,
        unidade_principal_id = excluded.unidade_principal_id,
        perfil_id = excluded.perfil_id,
        status = 'ativo',
        tipo_acesso = excluded.tipo_acesso,
        super_admin = false,
        updated_at = now()
  returning id into v_usuario;

  delete from usuario_escopos where usuario_id = v_usuario;
  insert into usuario_escopos (usuario_id, unidade_id, data_scope)
  values (v_usuario, 'unidade-teste-a', 'unidade');

  raise notice 'Usuário de teste pronto: % (usuarios_erp.id=%)', v_email, v_usuario;
end $$;

/* ── CONFERÊNCIA (rode depois, separadamente) ─────────────────────────────

   1. O cadastro ficou certo?

select u.login, u.status, u.tipo_acesso, u.unidade_principal_id, p.nome as perfil,
       (select count(*) from usuario_escopos e where e.usuario_id = u.id) as escopos,
       (select count(*) from perfil_permissoes pp where pp.perfil_id = u.perfil_id) as permissoes
from usuarios_erp u left join perfis_acesso p on p.id = u.perfil_id
order by u.created_at desc;

   Esperado: 1 linha, status ativo, 1 escopo, 8 permissões.

   2. Logado como ele no app (ou com o token dele), o contexto responde?

select hefisto_session_context();

   Esperado: JSON com papel "gerente", unidade "unidade-teste-a" e a lista de
   permissões. Se vier null, o usuário não está ativo ou não está ligado.

   3. O acesso por linha está fechado onde deve estar?

select hefisto_user_in_unit_strict((select id from auth.users where lower(email)=lower('teste.hefisto@exemplo.local')), 'unidade-teste-a') as ve_a,
       hefisto_user_in_unit_strict((select id from auth.users where lower(email)=lower('teste.hefisto@exemplo.local')), 'unidade-teste-b') as ve_b;

   Esperado: ve_a = true, ve_b = false.

   ───────────────────────────────────────────────────────────────────────── */
