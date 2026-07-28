import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sezccspqxgklicfndwxx.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const json = (body, status = 200) => NextResponse.json(body, { status });
const clean = (value) => String(value ?? "").trim();
const nullable = (value) => clean(value) || null;
const loginEmail = (login) => {
  const value = clean(login).toLowerCase();
  if (value.includes("@")) return value;
  return `${value.replace(/\s+/g, ".")}@hefisto.app`;
};

async function requireAdmin(request, permission = "configuracoes.users.view") {
  const db = adminClient();
  if (!db) {
    return { response: json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para administrar acessos." }, 503) };
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { response: json({ error: "Sessão ausente." }, 401) };
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth?.user) return { response: json({ error: "Sessão inválida ou expirada." }, 401) };
  const wanted = Array.isArray(permission) ? permission : [permission];
  let allowed = false;
  for (const item of wanted) {
    const result = await db.rpc("hefisto_user_has_permission", {
      p_auth_user_id: auth.user.id,
      p_permission: item,
    });
    if (result.data) { allowed = true; break; }
  }
  if (!allowed) return { response: json({ error: "Você não tem permissão para esta operação." }, 403) };
  const actorRecord = await db.from("usuarios_erp").select("*").eq("auth_user_id", auth.user.id).maybeSingle();
  return { db, actor: auth.user, actorRecord: actorRecord.data };
}

async function audit(db, actorId, targetType, targetId, event, before = null, after = null) {
  await db.from("permissoes_auditoria").insert({
    ator_auth_user_id: actorId,
    alvo_tipo: targetType,
    alvo_id: targetId || null,
    evento: event,
    antes: before,
    depois: after,
  });
}

async function replacePermissions(db, table, idColumn, id, permissions = [], effect = null) {
  await db.from(table).delete().eq(idColumn, id);
  const unique = [...new Set((permissions || []).filter(Boolean))];
  if (!unique.length) return;
  const rows = unique.map((permission_key) => ({
    [idColumn]: id,
    permission_key,
    ...(effect ? { effect } : {}),
  }));
  const { error } = await db.from(table).insert(rows);
  if (error) throw error;
}

async function replaceScopes(db, userId, scopes = []) {
  await db.from("usuario_escopos").delete().eq("usuario_id", userId);
  const normalized = scopes
    .filter((scope) => scope.empresa_id || scope.unidade_id || scope.setor_id)
    .map((scope) => ({
      usuario_id: userId,
      empresa_id: nullable(scope.empresa_id),
      unidade_id: nullable(scope.unidade_id),
      setor_id: nullable(scope.setor_id),
      data_scope: scope.data_scope || "setor",
    }));
  if (normalized.length) {
    const { error } = await db.from("usuario_escopos").insert(normalized);
    if (error) throw error;
  }
}

function userPayload(input, actorId, allowSuperAdmin = false) {
  return {
    nome: clean(input.nome),
    funcionario_id: nullable(input.funcionario_id),
    avatar_url: nullable(input.avatar_url),
    email: nullable(input.email),
    telefone: nullable(input.telefone),
    login: clean(input.login).toLowerCase(),
    setor_principal_id: nullable(input.setor_principal_id),
    cargo: nullable(input.cargo),
    unidade_principal_id: nullable(input.unidade_principal_id),
    status: input.status || "ativo",
    tipo_acesso: input.tipo_acesso || "funcionario",
    perfil_id: nullable(input.perfil_id),
    pagina_inicial: input.pagina_inicial || "/dashboard",
    super_admin: allowSuperAdmin && !!input.super_admin,
    exigir_troca_senha: input.exigir_troca_senha !== false,
    allowed_days: Array.isArray(input.allowed_days) && input.allowed_days.length ? input.allowed_days : [0,1,2,3,4,5,6],
    allowed_start_time: nullable(input.allowed_start_time),
    allowed_end_time: nullable(input.allowed_end_time),
    timezone: input.timezone || "America/Sao_Paulo",
    max_failed_attempts: Math.max(1, Number(input.max_failed_attempts || 5)),
    valid_from: nullable(input.valid_from),
    valid_until: nullable(input.valid_until),
    encerrar_sessoes_anteriores: !!input.encerrar_sessoes_anteriores,
    allowed_device_ids: Array.isArray(input.allowed_device_ids) ? input.allowed_device_ids : [],
    acesso_externo: input.acesso_externo !== false,
    allowed_ips: Array.isArray(input.allowed_ips) ? input.allowed_ips : [],
    criado_por: actorId,
  };
}

export async function GET(request) {
  const context = await requireAdmin(request, ["configuracoes.users.view", "configuracoes.profiles.view"]);
  if (context.response) return context.response;
  const { db } = context;
  const results = await Promise.all([
    db.from("usuarios_erp").select("*").order("created_at", { ascending: false }),
    db.from("perfis_acesso").select("*").order("nome"),
    db.from("perfil_permissoes").select("*"),
    db.from("usuario_permissoes").select("*"),
    db.from("usuario_escopos").select("*"),
    db.from("empresas").select("*").eq("ativo", true).order("nome"),
    db.from("unidades").select("*").order("nome"),
    db.from("setores").select("*").eq("ativo", true).order("nome"),
    db.from("funcionarios").select("id,nome,cargo,email,telefone,unidade_id,ativo").order("nome"),
    db.from("acessos_modulo").select("id", { count: "exact", head: true }),
    db.from("acessos_auditoria").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  const firstError = results.find((result, index) => index < 9 && result.error)?.error;
  if (firstError) return json({ error: firstError.message }, 500);

  const [users, profiles, profilePermissions, userPermissions, scopes, companies, units, sectors, employees, legacy, accessLogs] = results;
  return json({
    users: users.data || [],
    profiles: (profiles.data || []).map((profile) => ({
      ...profile,
      permissions: (profilePermissions.data || [])
        .filter((item) => item.perfil_id === profile.id)
        .map((item) => item.permission_key),
    })),
    userPermissions: userPermissions.data || [],
    scopes: scopes.data || [],
    companies: companies.data || [],
    units: units.data || [],
    sectors: sectors.data || [],
    employees: employees.data || [],
    legacyCount: legacy.count || 0,
    accessLogs: accessLogs.data || [],
  });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const permissionByAction = {
    "create-user": "configuracoes.users.create",
    "update-user": "configuracoes.users.edit",
    "set-user-status": "configuracoes.users.edit",
    "reset-password": "configuracoes.users.settings",
    "delete-user": "configuracoes.users.delete",
    "save-user-permissions": "configuracoes.users.settings",
    "save-profile": "configuracoes.profiles.edit",
    "duplicate-profile": "configuracoes.profiles.create",
    "set-profile-status": "configuracoes.profiles.edit",
    "delete-profile": "configuracoes.profiles.delete",
    "apply-profile": "configuracoes.profiles.settings",
    "migrate-legacy": "configuracoes.users.settings",
  };
  const context = await requireAdmin(request, permissionByAction[body.action] || "configuracoes.users.settings");
  if (context.response) return context.response;
  const { db, actor, actorRecord } = context;

  try {
    if (body.action === "create-user") {
      const input = body.user || {};
      if (!clean(input.nome) || !clean(input.login)) return json({ error: "Nome e login são obrigatórios." }, 400);
      if (!/^[a-z0-9._@+-]+$/i.test(clean(input.login))) return json({ error: "O login contém caracteres não permitidos." }, 400);
      if (clean(input.password).length < 8) return json({ error: "A senha temporária deve ter ao menos 8 caracteres." }, 400);
      if (!input.perfil_id && input.profile_code) {
        const foundProfile = await db.from("perfis_acesso").select("id")
          .eq("codigo", input.profile_code).eq("is_current", true).maybeSingle();
        input.perfil_id = foundProfile.data?.id || null;
      }
      const authEmail = loginEmail(input.login);
      const { data: created, error: createError } = await db.auth.admin.createUser({
        email: authEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: { nome: clean(input.nome), login: clean(input.login).toLowerCase(), papel: input.tipo_acesso || "funcionario" },
      });
      if (createError) return json({ error: createError.message }, 400);
      const payload = { ...userPayload(input, actor.id, !!actorRecord?.super_admin), auth_user_id: created.user.id };
      const { data: user, error } = await db.from("usuarios_erp")
        .update(payload).eq("auth_user_id", created.user.id).select().single();
      if (error) {
        await db.auth.admin.deleteUser(created.user.id);
        throw error;
      }
      await replaceScopes(db, user.id, body.scopes || []);
      await replacePermissions(db, "usuario_permissoes", "usuario_id", user.id, body.allowPermissions || [], "allow");
      if ((body.denyPermissions || []).length) {
        const rows = [...new Set(body.denyPermissions)].map((permission_key) => ({ usuario_id: user.id, permission_key, effect: "deny" }));
        await db.from("usuario_permissoes").insert(rows);
      }
      await audit(db, actor.id, "usuario", user.id, "criado", null, user);
      return json({ user }, 201);
    }

    if (body.action === "update-user") {
      const { data: before, error: findError } = await db.from("usuarios_erp").select("*").eq("id", body.id).single();
      if (findError) throw findError;
      if (!/^[a-z0-9._@+-]+$/i.test(clean(body.user?.login))) return json({ error: "O login contém caracteres não permitidos." }, 400);
      const payload = userPayload(body.user || {}, before.criado_por || actor.id, !!actorRecord?.super_admin);
      delete payload.criado_por;
      if (!actorRecord?.super_admin) payload.super_admin = before.super_admin;
      const { data: user, error } = await db.from("usuarios_erp").update(payload).eq("id", body.id).select().single();
      if (error) throw error;
      if (user.auth_user_id) {
        await db.auth.admin.updateUserById(user.auth_user_id, {
          email: loginEmail(user.login),
          user_metadata: { nome: user.nome, login: user.login, papel: user.tipo_acesso },
        });
      }
      await replaceScopes(db, user.id, body.scopes || []);
      await audit(db, actor.id, "usuario", user.id, "atualizado", before, user);
      return json({ user });
    }

    if (body.action === "save-user-permissions") {
      const existing = await db.from("usuario_permissoes").select("*").eq("usuario_id", body.id);
      await db.from("usuario_permissoes").delete().eq("usuario_id", body.id);
      const rows = [
        ...[...new Set(body.allowPermissions || [])].map((permission_key) => ({ usuario_id: body.id, permission_key, effect: "allow" })),
        ...[...new Set(body.denyPermissions || [])].map((permission_key) => ({ usuario_id: body.id, permission_key, effect: "deny" })),
      ];
      if (rows.length) {
        const { error } = await db.from("usuario_permissoes").insert(rows);
        if (error) throw error;
      }
      await audit(db, actor.id, "usuario", body.id, "permissoes_atualizadas", existing.data, rows);
      return json({ ok: true });
    }

    if (body.action === "set-user-status") {
      const { data: before } = await db.from("usuarios_erp").select("*").eq("id", body.id).single();
      if (before?.auth_user_id === actor.id && body.status !== "ativo") return json({ error: "Você não pode bloquear ou desativar o próprio usuário." }, 400);
      const { data: user, error } = await db.from("usuarios_erp")
        .update({ status: body.status, locked_until: body.status === "bloqueado" ? "infinity" : null, failed_attempts: 0 })
        .eq("id", body.id).select().single();
      if (error) throw error;
      await audit(db, actor.id, "usuario", body.id, `status_${body.status}`, before, user);
      return json({ user });
    }

    if (body.action === "reset-password") {
      if (clean(body.password).length < 8) return json({ error: "A nova senha deve ter ao menos 8 caracteres." }, 400);
      const { data: user, error } = await db.from("usuarios_erp").select("*").eq("id", body.id).single();
      if (error) throw error;
      const authResult = await db.auth.admin.updateUserById(user.auth_user_id, { password: body.password });
      if (authResult.error) throw authResult.error;
      await db.from("usuarios_erp").update({ exigir_troca_senha: body.requireChange !== false, failed_attempts: 0, locked_until: null }).eq("id", body.id);
      await audit(db, actor.id, "usuario", body.id, "senha_redefinida");
      return json({ ok: true });
    }

    if (body.action === "delete-user") {
      const { data: user, error } = await db.from("usuarios_erp").select("*").eq("id", body.id).single();
      if (error) throw error;
      if (user.auth_user_id === actor.id) return json({ error: "Você não pode excluir o próprio usuário." }, 400);
      if (user.super_admin && !actorRecord?.super_admin) return json({ error: "Somente um administrador geral pode excluir outro administrador geral." }, 403);
      await audit(db, actor.id, "usuario", body.id, "excluido", user, null);
      const result = await db.auth.admin.deleteUser(user.auth_user_id);
      if (result.error) throw result.error;
      return json({ ok: true });
    }

    if (body.action === "save-profile") {
      const input = body.profile || {};
      if (!clean(input.nome)) return json({ error: "Informe o nome do perfil." }, 400);
      let profile;
      if (!input.id) {
        const inserted = await db.from("perfis_acesso").insert({
          nome: clean(input.nome), codigo: nullable(input.codigo), descricao: nullable(input.descricao),
          tipo: input.tipo || "personalizado", ativo: input.ativo !== false, created_by: actor.id,
        }).select().single();
        if (inserted.error) throw inserted.error;
        profile = inserted.data;
      } else if (body.applyMode === "new_only") {
        const old = await db.from("perfis_acesso").select("*").eq("id", input.id).single();
        if (old.error) throw old.error;
        await db.from("perfis_acesso").update({ is_current: false }).eq("id", input.id);
        const inserted = await db.from("perfis_acesso").insert({
          nome: clean(input.nome), codigo: old.data.codigo, descricao: nullable(input.descricao),
          tipo: input.tipo || old.data.tipo, ativo: input.ativo !== false, sistema: old.data.sistema,
          version: old.data.version + 1, supersedes_id: old.data.id, created_by: actor.id,
        }).select().single();
        if (inserted.error) throw inserted.error;
        profile = inserted.data;
      } else {
        const updated = await db.from("perfis_acesso").update({
          nome: clean(input.nome), descricao: nullable(input.descricao), tipo: input.tipo || "personalizado",
          ativo: input.ativo !== false,
        }).eq("id", input.id).select().single();
        if (updated.error) throw updated.error;
        profile = updated.data;
      }
      await replacePermissions(db, "perfil_permissoes", "perfil_id", profile.id, body.permissions || []);
      await audit(db, actor.id, "perfil", profile.id, input.id ? "atualizado" : "criado", null, { ...profile, permissions: body.permissions || [] });
      return json({ profile });
    }

    if (body.action === "duplicate-profile") {
      const source = await db.from("perfis_acesso").select("*").eq("id", body.id).single();
      if (source.error) throw source.error;
      const inserted = await db.from("perfis_acesso").insert({
        nome: `${source.data.nome} (cópia)`, descricao: source.data.descricao,
        tipo: source.data.tipo, created_by: actor.id,
      }).select().single();
      if (inserted.error) throw inserted.error;
      const permissions = await db.from("perfil_permissoes").select("permission_key").eq("perfil_id", body.id);
      await replacePermissions(db, "perfil_permissoes", "perfil_id", inserted.data.id, (permissions.data || []).map((p) => p.permission_key));
      await audit(db, actor.id, "perfil", inserted.data.id, "duplicado", source.data, inserted.data);
      return json({ profile: inserted.data });
    }

    if (body.action === "set-profile-status") {
      const { data, error } = await db.from("perfis_acesso").update({ ativo: !!body.ativo }).eq("id", body.id).select().single();
      if (error) throw error;
      await audit(db, actor.id, "perfil", body.id, body.ativo ? "ativado" : "desativado", null, data);
      return json({ profile: data });
    }

    if (body.action === "delete-profile") {
      const users = await db.from("usuarios_erp").select("id", { count: "exact", head: true }).eq("perfil_id", body.id);
      if (users.count) return json({ error: "Este perfil está em uso. Aplique outro perfil aos usuários antes de excluir." }, 400);
      const { data: profile } = await db.from("perfis_acesso").select("*").eq("id", body.id).single();
      if (profile?.sistema) return json({ error: "Perfis iniciais do sistema podem ser desativados, mas não excluídos." }, 400);
      const { error } = await db.from("perfis_acesso").delete().eq("id", body.id);
      if (error) throw error;
      await audit(db, actor.id, "perfil", body.id, "excluido", profile, null);
      return json({ ok: true });
    }

    if (body.action === "apply-profile") {
      const ids = Array.isArray(body.userIds) ? body.userIds : [];
      if (!ids.length) return json({ error: "Selecione ao menos um usuário." }, 400);
      const { error } = await db.from("usuarios_erp").update({ perfil_id: body.profileId }).in("id", ids);
      if (error) throw error;
      await audit(db, actor.id, "perfil", body.profileId, "aplicado_a_usuarios", null, { userIds: ids });
      return json({ ok: true });
    }

    if (body.action === "migrate-legacy") {
      const legacy = await db.from("acessos_modulo").select("*");
      if (legacy.error) throw legacy.error;
      const permissionMap = {
        ponto: ["ponto.*"], rotina: ["checklist.*"], estoque: ["estoque.*"],
        etiquetas: ["estoque.labels.*"], fichas: ["fichas.*"], montagem: ["fichas.assembly.*"],
        compras: ["compras.*"], producao: ["cozinha.production.*"], orcamento: ["compras.orders.*"],
        setor_salao: ["salao.*","checklist.execution.*"], setor_cozinha: ["cozinha.*","estoque.*","checklist.*","fichas.*","compras.*"],
        setor_bar: ["bar.*","estoque.*","checklist.*","compras.*"], setor_rh: ["rh.*","ponto.*"],
        setor_financeiro: ["financeiro.*","relatorios.*"], setor_gestao: ["relatorios.*","configuracoes.store.*"],
      };
      const migrated = [];
      for (const item of legacy.data || []) {
        const authEmail = loginEmail(item.email);
        const created = await db.auth.admin.createUser({
          email: authEmail, password: item.senha, email_confirm: true,
          user_metadata: { nome: item.email, login: item.email, papel: "setor" },
        });
        if (created.error) continue;
        const updated = await db.from("usuarios_erp").update({
          nome: item.email, login: clean(item.email).toLowerCase(), status: item.ativo ? "ativo" : "desativado",
          tipo_acesso: item.modulo === "ponto" ? "terminal_ponto" : "setor",
          unidade_principal_id: item.unidade_id, exigir_troca_senha: true, criado_por: actor.id,
        }).eq("auth_user_id", created.data.user.id).select().single();
        if (updated.data) {
          await replacePermissions(db, "usuario_permissoes", "usuario_id", updated.data.id, permissionMap[item.modulo] || [], "allow");
          await db.from("acessos_modulo").delete().eq("id", item.id);
          migrated.push(item.id);
        }
      }
      await audit(db, actor.id, "migracao", null, "acessos_legados_migrados", null, { count: migrated.length });
      return json({ migrated: migrated.length, total: (legacy.data || []).length });
    }

    return json({ error: "Operação desconhecida." }, 400);
  } catch (error) {
    return json({ error: error?.message || "Não foi possível concluir a operação." }, 500);
  }
}
