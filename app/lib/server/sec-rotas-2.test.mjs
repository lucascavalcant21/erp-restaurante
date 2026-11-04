// S-33 e S-34: além de negar quem não tem sessão, as rotas precisam respeitar a
// permissão de quem tem. Rotas reais, com o Supabase simulado por fetch.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "next/server") return next("next/server.js", ctx);
    if (spec.startsWith(".") && !path.extname(spec)) {
      try { return next(spec + ".js", ctx); } catch { /* segue */ }
    }
    return next(spec, ctx);
  },
});

const api = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "api");
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.teste";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste";

let cenario;
const gravados = [];
const USUARIO = { id: "u1", nome: "Ana", unidade_id: "casa", status: "ativo", super_admin: false, perfil_id: "p1" };
const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("/auth/v1/user")) return json({ id: "auth1", aud: "authenticated", email: "a@a.co" });
  const tabela = (u.match(/\/rest\/v1\/([a-z_]+)/) || [])[1];
  if (init.method === "POST" && tabela === "acessos_auditoria") {
    gravados.push(JSON.parse(init.body));
    return new Response(null, { status: 201 });
  }
  const linhas = {
    usuarios_erp: [USUARIO],
    usuario_escopos: [{ unidade_id: "casa", data_scope: "setor" }],
    perfis_acesso: [{ id: "p1", ativo: true }],
    perfil_permissoes: cenario.chaves.map((permission_key) => ({ permission_key })),
    usuario_permissoes: [],
    acessos_auditoria: [{ id: 1, usuario_id: "u1", evento: "login", sucesso: true, ip: "1.1.1.1", created_at: "2026-11-04T10:00:00Z", detalhes: { login: "ana" } }],
    pedidos: [],
  }[tabela] ?? [];
  const umaLinha = (new Headers(init.headers).get("accept") || "").includes("vnd.pgrst.object");
  return json(umaLinha ? linhas[0] ?? null : linhas);
};

const pedido = (url, init = {}) => new Request(`http://app.teste${url}`, { ...init, headers: { authorization: "Bearer valido", "content-type": "application/json", ...init.headers } });
const audit = () => import(pathToFileURL(path.join(api, "apps/audit/route.js")).href);
const metricas = () => import(pathToFileURL(path.join(api, "dashboard/experience/intelligence/route.js")).href);

test("registro de acessos: sem a permissão → 403", async () => {
  cenario = { chaves: ["bar.recipes.view"] };
  const r = await (await audit()).GET(pedido("/api/apps/audit?unidade=casa"));
  assert.equal(r.status, 403);
});

test("registro de acessos: com a permissão, lê", async () => {
  cenario = { chaves: ["configuracoes.users.view"] };
  const r = await (await audit()).GET(pedido("/api/apps/audit?unidade=casa"));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).logs[0].login, "ana");
});

test("gravar registro: quem é vem da sessão, nunca do corpo", async () => {
  cenario = { chaves: [] };
  gravados.length = 0;
  const r = await (await audit()).POST(pedido("/api/apps/audit", {
    method: "POST", headers: { "x-forwarded-for": "2.2.2.2" },
    body: JSON.stringify({ evento: "login_app_sucesso", usuario_id: "outra-pessoa", auth_user_id: "outra-pessoa", ip: "9.9.9.9" }),
  }));
  assert.equal(r.status, 200);
  assert.equal(gravados[0].usuario_id, "u1");
  assert.equal(gravados[0].auth_user_id, "auth1");
  assert.equal(gravados[0].ip, "2.2.2.2");
});

test("métricas: sem a permissão da tela → 403", async () => {
  cenario = { chaves: ["bar.recipes.view"] };
  const r = await (await metricas()).GET(pedido("/api/dashboard/experience/intelligence?unidade=casa"));
  assert.equal(r.status, 403);
});

test("métricas: outra unidade → recusada mesmo com a permissão", async () => {
  cenario = { chaves: ["cardapio.intelligence_exp.view"] };
  const r = await (await metricas()).GET(pedido("/api/dashboard/experience/intelligence?unidade=outra"));
  assert.equal(r.status, 403);
});

test("métricas: da própria unidade, com a permissão → 200", async () => {
  cenario = { chaves: ["cardapio.intelligence_exp.view"] };
  const r = await (await metricas()).GET(pedido("/api/dashboard/experience/intelligence?unidade=casa"));
  assert.equal(r.status, 200);
});
