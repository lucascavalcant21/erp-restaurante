// Trava do roteamento da Vercel (SEC-API-1, 14/10/2026).
//
// Antes: o vercel.json mandava para o Next só uma lista de rotas /api; o resto
// caía no servidor antigo (backend_cloud_code/server.js). Isso deixava 14 rotas
// do Next mortas em produção (Usuários e Perfis, emissão fiscal, OCR…, B-013) e
// expunha o servidor antigo sem login: /api/ocr repassava para a OpenAI com a
// chave de produção e as rotas de escrita gravavam no Firestore.
//
// Agora: TODO /api vai para o Next. No servidor antigo ficam só:
//   - /api/auth/policy: a versão do Next bloqueia conta de terceiros por 5
//     tentativas sem login (S-27); até ser corrigida, o login segue como hoje
//     (o servidor antigo responde 404 e o login segue sem a política).
//   - /api/triggers/verificar: o cron antigo (dados de demonstração).
// Essa lista só pode diminuir.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const vercel = JSON.parse(fs.readFileSync(path.join(raiz, "vercel.json"), "utf8"));
const NO_SERVIDOR_ANTIGO = ["auth/policy", "triggers/verificar"];

// Primeiro route que casa decide, como na Vercel.
function destino(caminho) {
  for (const r of vercel.routes) {
    const m = caminho.match(new RegExp(r.src));
    if (m) return r.dest.replace(/\$(\d)/g,(_, i) => m[Number(i)]);
  }
  return null;
}

function rotas(dir, base = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    if (!f.isDirectory()) return f.name === "route.js" && base ? [base] : [];
    return rotas(path.join(dir, f.name), base ? `${base}/${f.name}` : f.name);
  });
}

test("toda rota de app/api chega ao Next, exceto a lista do servidor antigo", () => {
  for (const r of rotas(path.join(raiz, "app", "api"))) {
    const caminho = "/api/" + r.replace(/\[[^\]]+\]/g, "x");
    const esperado = NO_SERVIDOR_ANTIGO.includes(r) ? "backend_cloud_code/server.js" : caminho.replace(/^\/api\/(.*)$/, "/api/$1");
    assert.equal(destino(caminho), esperado, r);
  }
});

test("o servidor antigo não recebe mais nenhuma outra rota /api", () => {
  for (const c of ["/api/ocr", "/api/chat", "/api/db/lojas", "/api/contexto", "/api/config/unidades", "/api/crm/clientes", "/api/firebase/reload", "/api/qualquer/coisa"]) {
    assert.notEqual(destino(c), "backend_cloud_code/server.js", c);
  }
  const antigos = vercel.routes.filter((r) => r.dest === "backend_cloud_code/server.js" && r.src.includes("/api/"));
  assert.deepEqual(antigos.map((r) => r.src).sort(), NO_SERVIDOR_ANTIGO.map((r) => `^/api/${r}$`).sort(), "a lista só pode diminuir");
});

test("as APIs do Intelligence Core e as públicas seguem no Next", () => {
  for (const c of ["/api/intelligence/ask", "/api/intelligence/brief", "/api/public/pedidos", "/api/ifood/webhook", "/api/etiquetas/financeiro/drenar"]) {
    assert.equal(destino(c), c, c);
  }
});
