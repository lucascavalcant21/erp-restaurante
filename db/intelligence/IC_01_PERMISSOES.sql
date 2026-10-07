/* ═══════════════════════════════════════════════════════════════════════════
   IC-01 · QUEM ENXERGA A CENTRAL DE INTELIGÊNCIA (SOMENTE LEITURA)

   Rode no SQL Editor do Supabase (antes e depois de conceder permissões).
   Um único SELECT. Não mostra nome, e-mail nem login: só a contagem por
   perfil. Usa as MESMAS funções do banco que o servidor usa
   (hefisto_user_has_permission = permissão; hefisto_usuario_valido = ativo,
   dentro da vigência, do dia e do horário permitidos — vale para AGORA).

   dashboard.intelligence.view      abrir a Central e o "Pergunte ao Héfisto"
   dashboard.intelligence.settings  alterar metas e alertas da inteligência

   Esperado, sem mudar nada no banco (presets do docs/controle-acesso-rbac.sql):
     super_admin / administrador-geral ('*')     → passa
     gerente-geral ('dashboard.*')                → passa
     demais perfis ('dashboard.overview.view')    → não passa
   Perfil editado no montador visual guarda chaves explícitas: se o gerente
   foi editado, conceda dashboard.intelligence.view pela tela de acessos.
   ═══════════════════════════════════════════════════════════════════════════ */

select
  perfil,
  tipo_acesso,
  perfil_ativo,
  count(*) as usuarios_ativos,
  count(*) filter (where public.hefisto_usuario_valido(auth_user_id)) as validos_agora,
  count(*) filter (where public.hefisto_user_has_permission(auth_user_id, 'dashboard.intelligence.view')) as ve_central,
  count(*) filter (where public.hefisto_user_has_permission(auth_user_id, 'dashboard.intelligence.settings')) as configura_central,
  -- mesmas chaves de app/lib/intelligence/permissions/mapa.mjs (registrar_perda)
  count(*) filter (where public.hefisto_tem_alguma_permissao(auth_user_id, array['estoque.losses.record_loss','estoque.movements.create',
                      'estoque.outputs.create','estoque.overview.adjust_stock','estoque.operation.adjust_stock','estoque.operation.create'])) as registra_perda,
  chaves_dashboard_do_perfil
from (
  select
    case when u.super_admin then 'super_admin' else coalesce(p.codigo, '(sem perfil)') end as perfil,
    u.tipo_acesso,
    case when u.super_admin then true else coalesce(p.ativo, false) end as perfil_ativo,
    u.auth_user_id,
    case when u.super_admin then '* (super admin)'
         else (select string_agg(distinct pp.permission_key, ', ' order by pp.permission_key)
               from public.perfil_permissoes pp
               where pp.perfil_id = p.id and (pp.permission_key = '*' or pp.permission_key like 'dashboard.%')) end as chaves_dashboard_do_perfil
  from public.usuarios_erp u
  left join public.perfis_acesso p on p.id = u.perfil_id
  where u.status = 'ativo' and u.auth_user_id is not null
) x
group by perfil, tipo_acesso, perfil_ativo, chaves_dashboard_do_perfil
order by ve_central desc, usuarios_ativos desc;
