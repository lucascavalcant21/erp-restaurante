// S-27: /api/auth/policy. Carrega a rota REAL com um banco de mentira no
// lugar do cliente service_role e confere:
// - o aviso anônimo de "senha errada" não trava nem bloqueia ninguém, por mais
//   que se repita (antes, 5 avisos = conta bloqueada para sempre);
// - a auditoria tem teto por janela;
// - o PUT do próprio usuário não limpa a trava posta pelo administrador;
// - a política legítima continua: conta inativa, travada ou fora do horário é
//   recusada no precheck; conta normal entra.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const FALSO = "data:text/javascript," + encodeURIComponent("export const getSupabaseServerClient = () => globalThis.__bancoFalso;");
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "next/server") return next("next/server.js", ctx);
    if (spec.endsWith("/supabase-server.mjs")) return { url: FALSO, shortCircuit: true };
    return next(spec, ctx);
  },
});

function bancoFalso(usuarios) {
  const auditoria = [];
  const updates = [];
  const db = {
    auditoria, updates,
    auth: { getUser: async (t) => (t === "token-bom" ? { data: { user: { id: "auth-1" } } } : { data: { user: null } }) },
    from(tabela) {
      const filtros = [];
      let op = "select", payload = null, contar = false;
      const linhas = () => (tabela === "usuarios_erp" ? usuarios : auditoria)
        .filter((l) => filtros.every(([c, v, tipo]) => (tipo === "gte" ? String(l[c]) >= v : l[c] === v)));
      const q = {
        select(_c, opts) { contar = Boolean(opts?.count); return q; },
        eq(c, v) { filtros.push([c, v]); return q; },
        gte(c, v) { filtros.push([c, v, "gte"]); return q; },
        update(p) { op = "update"; payload = p; return q; },
        insert(p) { auditoria.push({ ...p, created_at: new Date().toISOString() }); return Promise.resolve({ error: null }); },
        maybeSingle() { return Promise.resolve({ data: linhas()[0] || null }); },
        then(res, rej) {
          if (op === "update") { for (const l of linhas()) { Object.assign(l, payload); updates.push(payload); } return Promise.resolve({ error: null }).then(res, rej); }
          return Promise.resolve(contar ? { count: linhas().length } : { data: linhas() }).then(res, rej);
        },
      };
      return q;
    },
  };
  return db;
}

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const rota = await import(pathToFileURL(path.join(raiz, "app/api/auth/policy/route.js")).href);
const post = (corpo) => rota.POST(new Request("http://app.teste/api/auth/policy", {
  method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "200.1.2.3" }, body: JSON.stringify(corpo) }));
const usuario = (extra = {}) => ({ id: "u1", auth_user_id: "auth-1", login: "maria", status: "ativo", acesso_externo: true,
  failed_attempts: 0, max_failed_attempts: 5, locked_until: null, ...extra });

test("S-27: 50 avisos anônimos de falha não travam nem bloqueiam a conta", async () => {
  const u = usuario();
  globalThis.__bancoFalso = bancoFalso([u]);
  for (let i = 0; i < 50; i++) assert.equal((await post({ login: "maria", event: "failure" })).status, 403);
  assert.equal(u.status, "ativo");
  assert.equal(u.locked_until, null);
  assert.deepEqual(globalThis.__bancoFalso.updates, [], "o aviso anônimo não altera o cadastro");
  assert.equal(globalThis.__bancoFalso.auditoria.length, 20, "auditoria com teto por janela");
  const ok = await (await post({ login: "maria", event: "precheck" })).json();
  assert.equal(ok.ok, true, "a dona da conta continua entrando");
});

test("S-27: o PUT do próprio usuário não limpa a trava do administrador", async () => {
  const trava = new Date(Date.now() + 3600e3).toISOString();
  const u = usuario({ locked_until: trava, failed_attempts: 2 });
  globalThis.__bancoFalso = bancoFalso([u]);
  const r = await rota.PUT(new Request("http://app.teste/api/auth/policy", { method: "PUT", headers: { authorization: "Bearer token-bom" }, body: "{}" }));
  assert.equal(r.status, 200);
  assert.equal(u.locked_until, trava);
  assert.equal(u.failed_attempts, 0);
  assert.equal((await post({ login: "maria", event: "precheck" })).status, 403, "continua travado no precheck");
});

test("política legítima continua valendo no precheck", async () => {
  for (const [extra, esperado] of [
    [{}, 200], [{ status: "inativo" }, 403], [{ valid_until: "2020-01-01" }, 403],
    [{ locked_until: new Date(Date.now() + 60e3).toISOString() }, 403], [{ acesso_externo: false }, 403],
    [{ acesso_externo: false, allowed_ips: ["200.1.2.3"] }, 200],
  ]) {
    globalThis.__bancoFalso = bancoFalso([usuario(extra)]);
    assert.equal((await post({ login: "maria", event: "precheck" })).status, esperado, JSON.stringify(extra));
  }
  globalThis.__bancoFalso = bancoFalso([]);
  assert.equal((await (await post({ login: "ninguem", event: "precheck" })).json()).ok, true, "login desconhecido segue para o Supabase Auth");
  assert.equal((await post({ login: "x'; drop", event: "precheck" })).status, 403);
});
