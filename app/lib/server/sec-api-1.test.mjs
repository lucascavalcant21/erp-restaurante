// SEC-API-1: rotas que gastam IA paga ou leem dado com service_role exigem
// sessão de um cadastro ATIVO do ERP. Carrega as rotas REAIS e chama sem
// sessão e com token falso: tem de dar 401 e a IA (Anthropic/OpenAI) nunca
// pode ser chamada. Também confere que toda tela que chama essas rotas
// manda a sessão (fetchComSessao).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "next/server") return next("next/server.js", ctx);
    // O Next resolve import relativo sem extensão; o Node puro, não.
    if (spec.startsWith(".") && !path.extname(spec)) {
      try { return next(spec + ".js", ctx); } catch { /* segue */ }
    }
    return next(spec, ctx);
  },
});

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const api = path.join(raiz, "app", "api");
const PROTEGIDAS = [
  ...fs.readdirSync(api).filter((d) => d.startsWith("ia-")),
  "hefisto", "ocr", "saas/export", "fiscal/emitir",
];

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.teste";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste";
process.env.ANTHROPIC_API_KEY = "chave-de-teste";
process.env.OPENAI_API_KEY = "chave-de-teste";
process.env.FISCAL_API_URL = "http://fiscal.teste/emitir";
process.env.FISCAL_API_TOKEN = "chave-de-teste";

const chamadasExternas = [];
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.startsWith("http://supabase.teste/auth/v1/user")) {
    return new Response(JSON.stringify({ code: 401, msg: "invalid JWT" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  chamadasExternas.push(u);
  return new Response("{}", { status: 500 });
};

const corpo = JSON.stringify({ texto: "arroz", mensagem: "oi", imageBase64: "x", pedido_id: "p", unidade_id: "u", servico: "s", valor: 1 });
async function chamar(rota, token) {
  const mod = await import(pathToFileURL(path.join(api, rota, "route.js")).href);
  const metodo = mod.POST ? "POST" : "GET";
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new Request(`http://app.teste/api/${rota}?empresa_id=e1`, { method: metodo, headers, body: metodo === "POST" ? corpo : undefined });
  return mod[metodo](req);
}

for (const rota of PROTEGIDAS) {
  test(`${rota}: sem sessão e com token falso → 401, sem chamar IA nem motor fiscal`, async () => {
    chamadasExternas.length = 0;
    const sem = await chamar(rota, null);
    assert.equal(sem.status, 401, `${rota} sem sessão`);
    const falso = await chamar(rota, "token-falso");
    assert.equal(falso.status, 401, `${rota} com token falso`);
    assert.deepEqual(chamadasExternas, [], `${rota} chamou serviço externo sem sessão`);
  });
}

test("toda tela que chama essas rotas manda a sessão", () => {
  const achados = [];
  const varrer = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { if (f.name !== "api" && f.name !== "node_modules") varrer(p); continue; }
      if (!/\.(m?js)$/.test(f.name) || f.name.endsWith(".test.mjs")) continue;
      const s = fs.readFileSync(p, "utf8");
      const re = /\bfetch\(\s*["'`]\/api\/(ia-[a-z-]+|hefisto|ocr|saas\/export|fiscal\/emitir)\b/g;
      for (const m of s.matchAll(re)) achados.push(`${path.relative(raiz, p)} → /api/${m[1]}`);
    }
  };
  varrer(path.join(raiz, "app"));
  assert.deepEqual(achados, [], "use fetchComSessao (app/lib/api-sessao.js)");
});

test("integrações (rotas que passam a chegar ao Next): sem sessão → 401; antes a checagem era pulada", async () => {
  const carregar = (r) => import(pathToFileURL(path.join(api, r, "route.js")).href);
  const lista = await carregar("integrations");
  assert.equal((await lista.GET(new Request("http://app.teste/api/integrations?unidade_id=seldeestrela"))).status, 401);
  const eventos = await carregar("integrations/events");
  assert.equal((await eventos.GET(new Request("http://app.teste/api/integrations/events?unidade_id=seldeestrela"))).status, 401);
  const teste = await carregar("integrations/[provider]/test");
  const req = new Request("http://app.teste/api/integrations/ifood/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unidade_id: "seldeestrela" }) });
  assert.equal((await teste.POST(req, { params: Promise.resolve({ provider: "ifood" }) })).status, 401);
  const semUnidade = new Request("http://app.teste/api/integrations/ifood/test", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.notEqual((await teste.POST(semUnidade, { params: Promise.resolve({ provider: "ifood" }) })).status, 200, "sem unidade não testa conexão");
});

test("cron de automações: sem CRON_SECRET ninguém entra; o segredo padrão antigo não vale", async () => {
  const cron = await import(pathToFileURL(path.join(api, "hefisto/automation/cron", "route.js")).href);
  delete process.env.CRON_SECRET;
  for (const req of [
    new Request("http://app.teste/api/hefisto/automation/cron"),
    new Request("http://app.teste/api/hefisto/automation/cron?secret=hefisto_cron_secret_dev"),
    new Request("http://app.teste/api/hefisto/automation/cron", { headers: { authorization: "Bearer hefisto_cron_secret_dev" } }),
  ]) assert.equal((await cron.GET(req)).status, 401);
  process.env.CRON_SECRET = "segredo-do-teste";
  assert.equal((await cron.GET(new Request("http://app.teste/api/hefisto/automation/cron?secret=segredo-do-teste"))).status, 401, "segredo na URL não vale");
  delete process.env.CRON_SECRET;
});

test("chamados do salão (S-29): GET e PATCH sem sessão → 401; antes liam e alteravam qualquer unidade", async () => {
  const mod = await import(pathToFileURL(path.join(api, "public/experience/[unidade]/chamados", "route.js")).href);
  const params = { params: Promise.resolve({ unidade: "seldeestrela" }) };
  assert.equal((await mod.GET(new Request("http://app.teste/api/public/experience/seldeestrela/chamados"), params)).status, 401);
  const patch = new Request("http://app.teste/api/public/experience/seldeestrela/chamados", {
    method: "PATCH", headers: { "content-type": "application/json", authorization: "Bearer token-falso" },
    body: JSON.stringify({ chamadoId: "x", novoStatus: "concluido" }),
  });
  assert.equal((await mod.PATCH(patch, params)).status, 401);
});
