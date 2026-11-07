// /api/sinalizacao: sem sessão 401, sem a permissão 403, outra unidade 403.
// Rota real, com o Supabase simulado por fetch (mesmo molde de sec-rotas-2.test.mjs).
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

let chaves = [];
const tocadas = [];
const USUARIO = { id: "u1", nome: "Ana", unidade_id: "casa", status: "ativo", super_admin: false, perfil_id: "p1" };
const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("/auth/v1/user")) return json({ id: "auth1", aud: "authenticated", email: "a@a.co" });
  const tabela = (u.match(/\/rest\/v1\/([a-z_]+)/) || [])[1];
  if (tabela?.startsWith("sinal_")) tocadas.push(tabela);
  const linhas = {
    usuarios_erp: [USUARIO],
    usuario_escopos: [{ unidade_id: "casa", data_scope: "setor" }],
    perfis_acesso: [{ id: "p1", ativo: true }],
    perfil_permissoes: chaves.map((permission_key) => ({ permission_key })),
    usuario_permissoes: [],
  }[tabela] ?? [];
  const umaLinha = (new Headers(init.headers).get("accept") || "").includes("vnd.pgrst.object");
  return json(umaLinha ? linhas[0] ?? null : linhas);
};

const rota = () => import(pathToFileURL(path.join(api, "sinalizacao/route.js")).href);
const pedido = (url, init = {}, token = "valido") => new Request(`http://app.teste${url}`, {
  ...init, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json", ...init.headers },
});

test("sem sessão: 401", async () => {
  const r = await (await rota()).GET(pedido("/api/sinalizacao?unidadeId=casa", {}, null));
  assert.equal(r.status, 401);
});

test("sem a permissão da Sinalização: 403 e nenhuma tabela sinal_* tocada", async () => {
  chaves = ["bar.recipes.view"];
  tocadas.length = 0;
  const r = await (await rota()).GET(pedido("/api/sinalizacao?unidadeId=casa"));
  assert.equal(r.status, 403);
  assert.deepEqual(tocadas, []);
});

test("só visualizar não pareia nem troca conteúdo", async () => {
  chaves = ["clientes.signage.view"];
  tocadas.length = 0;
  const m = await rota();
  for (const acao of ["parear", "trocar_conteudo", "excluir_midia", "salvar_programacao"]) {
    const r = await m.POST(pedido("/api/sinalizacao", { method: "POST", body: JSON.stringify({ unidadeId: "casa", acao }) }));
    assert.equal(r.status, 403, acao);
  }
  assert.deepEqual(tocadas, []);
});

test("unidade de outra loja: 403 mesmo com a permissão", async () => {
  chaves = ["clientes.signage.*"];
  const r = await (await rota()).GET(pedido("/api/sinalizacao?unidadeId=outra-loja"));
  assert.equal(r.status, 403);
});

test("com a permissão e na própria unidade: lê", async () => {
  chaves = ["clientes.signage.view"];
  const r = await (await rota()).GET(pedido("/api/sinalizacao?unidadeId=casa"));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.deepEqual(j.telas, []);
});

test("ação desconhecida: 400", async () => {
  chaves = ["clientes.signage.*"];
  const r = await (await rota()).POST(pedido("/api/sinalizacao", { method: "POST", body: JSON.stringify({ unidadeId: "casa", acao: "apagar_tudo" }) }));
  assert.equal(r.status, 400);
});
