// S-31: /api/admin/access-control com as regras de concessão LIGADAS.
// Carrega a rota REAL; o cliente de service_role é um banco em memória com
// duas empresas. Quem tem "configurar usuários" na empresa A não pode:
// dar "*" a si, mexer em usuário da empresa B, conceder unidade da B, nem ver
// a empresa B na listagem. O administrador geral continua podendo tudo.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const FALSO = "data:text/javascript," + encodeURIComponent("export const getSupabaseServerClient = () => globalThis.__bancoAcesso;");
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "next/server") return next("next/server.js", ctx);
    if (spec.endsWith("/supabase-server.mjs")) return { url: FALSO, shortCircuit: true };
    return next(spec, ctx);
  },
});

const casa = (concedida, pedida) => concedida === "*" || concedida === pedida
  || concedida === `${pedida.split(".")[0]}.*` || concedida === `${pedida.split(".").slice(0, 2).join(".")}.*`;

function banco() {
  const t = {
    empresas: [{ id: "A", nome: "A", ativo: true }, { id: "B", nome: "B", ativo: true }],
    unidades: [{ id: "a1", empresa_id: "A", nome: "a1" }, { id: "a2", empresa_id: "A", nome: "a2" }, { id: "b1", empresa_id: "B", nome: "b1" }],
    perfis_acesso: [{ id: "p-adm", nome: "adm", sistema: false }, { id: "p-tudo", nome: "tudo", sistema: true }, { id: "p-coz", nome: "coz", sistema: false }],
    perfil_permissoes: [
      ...["configuracoes.users.*", "configuracoes.profiles.*", "estoque.*"].map((k) => ({ perfil_id: "p-adm", permission_key: k })),
      { perfil_id: "p-tudo", permission_key: "*" }, { perfil_id: "p-coz", permission_key: "cozinha.*" },
    ],
    usuarios_erp: [
      { id: "u-super", auth_user_id: "auth-super", super_admin: true, perfil_id: "p-tudo", unidade_principal_id: "a1", status: "ativo", nome: "Dono" },
      { id: "u-gerA", auth_user_id: "auth-gerA", super_admin: false, perfil_id: "p-adm", unidade_principal_id: "a1", status: "ativo", nome: "Gerente A" },
      { id: "u-cozA", auth_user_id: "auth-cozA", super_admin: false, perfil_id: "p-coz", unidade_principal_id: "a1", status: "ativo", nome: "Cozinha A" },
      { id: "u-cozB", auth_user_id: "auth-cozB", super_admin: false, perfil_id: "p-coz", unidade_principal_id: "b1", status: "inativo", nome: "Cozinha B" },
    ],
    usuario_permissoes: [], usuario_escopos: [{ usuario_id: "u-gerA", data_scope: "empresa", unidade_id: null, empresa_id: null, setor_id: null }],
    setores: [], funcionarios: [], acessos_modulo: [], acessos_auditoria: [], permissoes_auditoria: [],
  };
  const escritas = [];
  const db = {
    t, escritas,
    auth: {
      getUser: async (token) => ({ data: { user: token?.startsWith("tok-") ? { id: token.slice(4) } : null }, error: null }),
      admin: { createUser: async () => ({ data: { user: { id: "auth-novo" } }, error: null }), updateUserById: async () => ({ error: null }), deleteUser: async () => ({ error: null }) },
    },
    async rpc(nome, a) {
      if (nome !== "hefisto_user_has_permission") return { data: null, error: { message: "rpc" } };
      const u = t.usuarios_erp.find((x) => x.auth_user_id === a.p_auth_user_id);
      if (!u || u.status !== "ativo") return { data: false };
      if (u.super_admin) return { data: true };
      const chaves = t.perfil_permissoes.filter((p) => p.perfil_id === u.perfil_id).map((p) => p.permission_key)
        .concat(t.usuario_permissoes.filter((p) => p.usuario_id === u.id && p.effect !== "deny").map((p) => p.permission_key));
      return { data: chaves.some((k) => casa(k, a.p_permission)) };
    },
    from(tabela) {
      const f = [];
      let op = "select", payload = null, um = false, talvez = false, contar = false;
      const linhas = () => (t[tabela] || []).filter((l) => f.every(([c, v, tipo]) => (tipo === "in" ? v.includes(l[c]) : l[c] === v)));
      const executar = () => {
        if (op === "insert") { const novas = [].concat(payload).map((p) => ({ id: `novo-${t[tabela].length}`, ...p })); t[tabela].push(...novas); escritas.push([tabela, "insert", novas]); return novas; }
        if (op === "update") { const ls = linhas(); ls.forEach((l) => Object.assign(l, payload)); escritas.push([tabela, "update", payload]); return ls; }
        if (op === "delete") { const ls = linhas(); t[tabela] = t[tabela].filter((l) => !ls.includes(l)); escritas.push([tabela, "delete", ls.length]); return ls; }
        return linhas().map((l) => ({ ...l })); // cópia, como o Supabase (o "antes" não muda com o update)
      };
      const b = {
        select(_c, o) { if (o?.count) contar = true; return b; },
        insert(p) { op = "insert"; payload = p; return b; }, update(p) { op = "update"; payload = p; return b; },
        upsert(p) { op = "insert"; payload = p; return b; }, delete() { op = "delete"; return b; },
        eq(c, v) { f.push([c, v]); return b; }, in(c, v) { f.push([c, v, "in"]); return b; }, neq() { return b; },
        order() { return b; }, limit() { return b; }, is() { return b; },
        single() { um = true; return b; }, maybeSingle() { talvez = true; return b; },
        then(res, rej) {
          const d = executar();
          const r = contar ? { count: d.length, data: null, error: null } : (um || talvez) ? { data: d[0] || null, error: um && !d[0] ? { message: "nada" } : null } : { data: d, error: null };
          return Promise.resolve(r).then(res, rej);
        },
      };
      return b;
    },
  };
  return db;
}

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const rota = await import(pathToFileURL(path.join(raiz, "app/api/admin/access-control/route.js")).href);
const post = async (quem, corpo) => {
  const r = await rota.POST(new Request("http://app.teste/api/admin/access-control", {
    method: "POST", headers: { authorization: `Bearer tok-auth-${quem}`, "content-type": "application/json" }, body: JSON.stringify(corpo) }));
  return { status: r.status, corpo: await r.json() };
};
const get = async (quem) => {
  const r = await rota.GET(new Request("http://app.teste/api/admin/access-control", { headers: { authorization: `Bearer tok-auth-${quem}` } }));
  return { status: r.status, corpo: await r.json() };
};

test("S-31: gerente da empresa A não se promove nem alcança a empresa B", async () => {
  globalThis.__bancoAcesso = banco();
  const db = globalThis.__bancoAcesso;
  const casos = [
    ["dar '*' a si mesmo", { action: "save-user-permissions", id: "u-gerA", allowPermissions: ["*"] }],
    ["dar a si o que já tem (gerenciar a si)", { action: "save-user-permissions", id: "u-gerA", allowPermissions: ["estoque.*"] }],
    ["dar a outro o que não tem", { action: "save-user-permissions", id: "u-cozA", allowPermissions: ["financeiro.*"] }],
    ["mexer em usuário da empresa B (inativo)", { action: "set-user-status", id: "u-cozB", status: "ativo" }],
    ["redefinir senha do administrador geral", { action: "reset-password", id: "u-super", password: "12345678" }],
    ["conceder unidade da empresa B", { action: "update-user", id: "u-cozA", user: { nome: "Cozinha A", unidade_principal_id: "a1" }, scopes: [{ data_scope: "unidade", unidade_id: "b1" }] }],
    ["conceder escopo da empresa B", { action: "update-user", id: "u-cozA", user: { nome: "Cozinha A" }, scopes: [{ data_scope: "empresa", empresa_id: "B" }] }],
    ["criar usuário na empresa B", { action: "create-user", user: { nome: "X", login: "x", password: "12345678", unidade_principal_id: "b1", perfil_id: "p-coz" } }],
    ["criar usuário com perfil '*'", { action: "create-user", user: { nome: "Y", login: "y", password: "12345678", unidade_principal_id: "a1", perfil_id: "p-tudo" } }],
    ["promover a administrador geral", { action: "update-user", id: "u-cozA", user: { nome: "Cozinha A", super_admin: true } }],
    ["editar perfil do sistema", { action: "set-profile-status", id: "p-tudo", ativo: false }],
    ["editar o próprio perfil", { action: "save-profile", profile: { id: "p-adm", nome: "adm" }, permissions: ["estoque.*"] }],
    ["migrar legado", { action: "migrate-legacy" }],
  ];
  for (const [nome, corpo] of casos) {
    const r = await post("gerA", corpo);
    assert.equal(r.status, 403, `${nome}: ${JSON.stringify(r.corpo)}`);
  }
  assert.deepEqual(db.escritas, [], "nenhuma recusa escreveu no banco");
  assert.equal(db.t.usuario_permissoes.length, 0);

  // o que é legítimo continua: dar a alguém da própria empresa o que se tem
  const ok = await post("gerA", { action: "save-user-permissions", id: "u-cozA", allowPermissions: ["estoque.overview.view"], denyPermissions: [] });
  assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  assert.ok(db.t.usuario_permissoes.some((p) => p.usuario_id === "u-cozA" && p.permission_key === "estoque.overview.view"));
});

test("S-31: listagem do gerente da empresa A não mostra a empresa B", async () => {
  globalThis.__bancoAcesso = banco();
  const r = await get("gerA");
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.users.map((u) => u.id).sort(), ["u-cozA", "u-gerA"], "nem o dono (administrador geral) nem a empresa B");
  assert.deepEqual(r.corpo.units.map((u) => u.id).sort(), ["a1", "a2"]);
  assert.deepEqual(r.corpo.companies.map((c) => c.id), ["A"]);
  const s = await get("super");
  assert.equal(s.corpo.users.length, 4, "administrador geral vê tudo");
  assert.equal((await get("cozA")).status, 403, "sem permissão da tela");
});

test("S-31: administrador geral continua podendo, menos mexer em si pela regra de gerência", async () => {
  globalThis.__bancoAcesso = banco();
  const r = await post("super", { action: "save-user-permissions", id: "u-cozB", allowPermissions: ["financeiro.*"], denyPermissions: [] });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
});

test("auditoria: toda alteração fica registrada e só aparece para quem pode ver o alvo", async () => {
  globalThis.__bancoAcesso = banco();
  const db = globalThis.__bancoAcesso;
  // recusa não audita (nada escrito)
  assert.equal((await post("gerA", { action: "save-user-permissions", id: "u-gerA", allowPermissions: ["*"] })).status, 403);
  assert.equal(db.t.permissoes_auditoria.length, 0, "recusa não grava auditoria");

  assert.equal((await post("gerA", { action: "save-user-permissions", id: "u-cozA", allowPermissions: ["estoque.overview.view"], denyPermissions: [] })).status, 200);
  assert.equal((await post("super", { action: "set-user-status", id: "u-cozB", status: "ativo" })).status, 200);
  const [a, b] = db.t.permissoes_auditoria;
  assert.equal(db.t.permissoes_auditoria.length, 2, "uma linha por alteração");
  assert.deepEqual([a.ator_auth_user_id, a.alvo_tipo, a.alvo_id, a.evento], ["auth-gerA", "usuario", "u-cozA", "permissoes_atualizadas"]);
  assert.ok(a.depois.some((p) => p.permission_key === "estoque.overview.view"), "o depois guarda a permissão concedida");
  assert.deepEqual([b.ator_auth_user_id, b.alvo_id, b.evento], ["auth-super", "u-cozB", "status_ativo"]);
  assert.equal(b.antes.status, "inativo", "o antes guarda o estado anterior");

  // consulta: gerente da empresa A só vê o histórico de quem gerencia
  const g = await get("gerA");
  assert.deepEqual(g.corpo.permissionLogs.map((l) => l.alvo_id), ["u-cozA"], "não vê alteração na empresa B");
  const s = await get("super");
  assert.deepEqual(s.corpo.permissionLogs.map((l) => l.alvo_id).sort(), ["u-cozA", "u-cozB"]);
});

test("auditoria: se a gravação falhar, o erro vai para o log (não some em silêncio)", async () => {
  globalThis.__bancoAcesso = banco();
  const db = globalThis.__bancoAcesso;
  const de = db.from.bind(db);
  db.from = (tb) => (tb === "permissoes_auditoria" ? { insert: async () => ({ error: { message: "falha simulada" } }) } : de(tb));
  const erros = [];
  const original = console.error;
  console.error = (...a) => erros.push(a.join(" "));
  try {
    assert.equal((await post("super", { action: "set-user-status", id: "u-cozB", status: "ativo" })).status, 200);
  } finally { console.error = original; }
  assert.ok(erros.some((e) => /auditoria NÃO gravada/.test(e) && /falha simulada/.test(e)), JSON.stringify(erros));
});
