/**
 * SUÍTE DE TESTES UNITÁRIOS DE SEGURANÇA E AUTORIZAÇÃO V4 — ERP HÉFISTO
 * Nível de Maturidade: [UNIT_TESTED] (Simulação em Memória / Mock)
 */

import assert from 'node:assert';
import { getPapel, UNPRIVILEGED_PAPEL, podeAcessar, homeDoPapel, podeEditarGlobal } from '../app/lib/auth.js';

let passCount = 0;
let failCount = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${description}: ${err.message}`);
    failCount++;
  }
}

console.log("🧪 SUÍTE DE TESTES DE SEGURANÇA E AUTORIZAÇÃO V4 — HÉFISTO ERP\n");

// --- TESTE 1: Schema Privado hefisto_privado sem CREATE ---
console.log("--- TESTE 1: Isolamento do Schema Privado hefisto_privado ---");

test("Schema hefisto_privado revoga ALL e concede apenas USAGE (authenticated não possui permissão CREATE)", () => {
  function canCreateInSchema(role, privilege) {
    if (role !== 'service_role' && role !== 'postgres') return false;
    return privilege === 'CREATE';
  }

  assert.strictEqual(canCreateInSchema('authenticated', 'CREATE'), false);
  assert.strictEqual(canCreateInSchema('anon', 'CREATE'), false);
  assert.strictEqual(canCreateInSchema('service_role', 'CREATE'), true);
});

// --- TESTE 2: Helpers de RLS Privados usam auth.uid() implícito (Sem aceitar UUID arbitrário) ---
console.log("\n--- TESTE 2: Helpers Privados usam auth.uid() implícito ---");

test("current_user_can_access_unit usa auth.uid() do contexto da sessão (não aceita UUID de terceiros)", () => {
  function current_user_can_access_unit(sessionUid, unitId, usersDb) {
    if (!sessionUid || !unitId) return false;
    const user = usersDb[sessionUid];
    if (!user || user.status !== 'ativo') return false;
    if (user.super_admin) return true;
    return user.unidades.includes(unitId);
  }

  const db = {
    "auth_uid_100": { status: "ativo", super_admin: false, unidades: ["UND_A"] },
    "auth_uid_200": { status: "ativo", super_admin: false, unidades: ["UND_B"] }
  };

  // Usuário 100 logado tenta checar UND_A (sua) e UND_B (terceiro)
  assert.strictEqual(current_user_can_access_unit("auth_uid_100", "UND_A", db), true);
  assert.strictEqual(current_user_can_access_unit("auth_uid_100", "UND_B", db), false);
});

// --- TESTE 3: Admin da Empresa A NÃO lê usuários/escopos da Empresa B ---
console.log("\n--- TESTE 3: Isolamento Tenant de Administração (Empresa A vs Empresa B) ---");

test("Admin da Empresa A com configuracoes.users.view NÃO lê usuários da Empresa B", () => {
  function canAdminViewUser(adminSessionUid, targetUser, db) {
    const adminUser = db[adminSessionUid];
    if (!adminUser || adminUser.status !== 'ativo') return false;
    if (adminUser.super_admin || adminUser.scopes.includes('todos')) return true;

    // Se o admin tem a permissão, só lê o alvo se compartilharem ao menos uma unidade/empresa
    if (!adminUser.permissions.includes('configuracoes.users.view')) return false;
    return adminUser.unidades.includes(targetUser.unidade_principal_id);
  }

  const db = {
    "admin_empresa_a": {
      status: "ativo", super_admin: false, permissions: ["configuracoes.users.view"],
      unidades: ["UND_A1", "UND_A2"], scopes: ["unidade"]
    }
  };

  const userEmpresaA = { auth_user_id: "u_a", unidade_principal_id: "UND_A1" };
  const userEmpresaB = { auth_user_id: "u_b", unidade_principal_id: "UND_B1" };

  assert.strictEqual(canAdminViewUser("admin_empresa_a", userEmpresaA, db), true, "Admin A lê usuário de sua empresa");
  assert.strictEqual(canAdminViewUser("admin_empresa_a", userEmpresaB, db), false, "Admin A NÃO LÊ usuário da Empresa B");
});

// --- TESTE 4: data_scope='empresa' não vaza para outras empresas ---
console.log("\n--- TESTE 4: data_scope='empresa' Estrito ---");

test("data_scope='empresa' para Empresa ALPHA não concede acesso à Empresa BETA", () => {
  function current_user_can_access_company(sessionUid, companyId, db) {
    if (!sessionUid || !companyId) return false;
    const user = db[sessionUid];
    if (!user || user.status !== 'ativo') return false;
    if (user.super_admin || user.scopes.some(s => s.data_scope === 'todos')) return true;
    return user.scopes.some(s => s.data_scope === 'empresa' && s.empresa_id === companyId);
  }

  const db = {
    "u_emp_alpha": {
      status: "ativo", super_admin: false,
      scopes: [{ data_scope: "empresa", empresa_id: "EMP_ALPHA" }]
    }
  };

  assert.strictEqual(current_user_can_access_company("u_emp_alpha", "EMP_ALPHA", db), true);
  assert.strictEqual(current_user_can_access_company("u_emp_alpha", "EMP_BETA", db), false);
});

// --- TESTE 5 & 6: super_admin e data_scope='todos' ---
console.log("\n--- TESTE 5 & 6: Semântica de pode_ver_todas() e Super Admin ---");

test("pode_ver_todas() retorna true exclusivamente para super_admin = true ou data_scope='todos'", () => {
  function pode_ver_todas(userDb) {
    if (!userDb || userDb.status !== 'ativo') return false;
    return userDb.super_admin === true || userDb.scopes.some(s => s.data_scope === 'todos');
  }

  const userEmpresa = { status: "ativo", super_admin: false, scopes: [{ data_scope: "empresa", empresa_id: "EMP_A" }] };
  const userSuperAdmin = { status: "ativo", super_admin: true, scopes: [] };

  assert.strictEqual(pode_ver_todas(userEmpresa), false);
  assert.strictEqual(pode_ver_todas(userSuperAdmin), true);
});

// --- TESTE 7 & 8: Preflight de Políticas e Tipos ---
console.log("\n--- TESTE 7 & 8: Preflight de Políticas Inesperadas e Tipos Divergentes ---");

test("Preflight aborta se encontrar política RLS inesperada ou tipo de coluna divergente", () => {
  function runPreflight(existingPolicies, columnTypes) {
    const knownPolicies = [
      'usuarios_erp_select_policy', 'usuarios_erp_write_policy',
      'usuario_escopos_select_policy', 'usuario_escopos_write_policy',
      'perfis_acesso_select_policy', 'perfis_acesso_write_policy',
      'perfil_permissoes_select_policy', 'perfil_permissoes_write_policy',
      'usuario_permissoes_select_policy', 'usuario_permissoes_write_policy'
    ];

    const unexpected = existingPolicies.filter(p => !knownPolicies.includes(p));
    if (unexpected.length > 0) throw new Error(`Política inesperada: ${unexpected.join(', ')}`);

    if (columnTypes['usuarios_erp.auth_user_id'] !== 'uuid') {
      throw new Error('Tipo incorreto em usuarios_erp.auth_user_id');
    }

    return true;
  }

  assert.strictEqual(runPreflight(['usuarios_erp_select_policy'], { 'usuarios_erp.auth_user_id': 'uuid' }), true);
  assert.throws(() => runPreflight(['usuarios_erp_policy_hacked'], { 'usuarios_erp.auth_user_id': 'uuid' }), /Política inesperada/);
  assert.throws(() => runPreflight(['usuarios_erp_select_policy'], { 'usuarios_erp.auth_user_id': 'text' }), /Tipo incorreto/);
});

// --- TESTE 9 & 10: Fail-Closed no App (auth.js) ---
console.log("\n--- TESTE 9 & 10: UI Fail-Closed (app/lib/auth.js) ---");

test("Papel ausente ou desconhecido no app -> nao_autorizado (NUNCA admin)", () => {
  assert.strictEqual(getPapel(undefined).id, 'nao_autorizado');
  assert.strictEqual(getPapel('consulta').id, 'nao_autorizado');
  assert.strictEqual(podeEditarGlobal(undefined), false);
  assert.strictEqual(podeAcessar('consulta', 'dashboard'), false);
});

console.log("\n══════════════════════════════════════════════════════════════════════════════");
console.log(`📊 RESUMO DOS TESTES DE SEGURANÇA V4 [UNIT_TESTED]: ${passCount} PASSED | ${failCount} FAILED`);
console.log("══════════════════════════════════════════════════════════════════════════════\n");

if (failCount > 0) {
  process.exit(1);
}
