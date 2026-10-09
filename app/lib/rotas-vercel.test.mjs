// Trava (08/10/2026): o vercel.json só manda para o Next as rotas /api da lista do primeiro
// "routes"; o resto vai para o servidor antigo (backend_cloud_code/server.js), que responde 404.
// As APIs do Intelligence Core ficaram de fora e dariam 404 em produção (achado no smoke do
// preview do PR #127). Rota NOVA em app/api precisa entrar na lista.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const vercel = JSON.parse(fs.readFileSync(path.join(raiz, "vercel.json"), "utf8"));
const lista = new RegExp(vercel.routes[0].src.replace(/^\^\/api\//, "^"));

// Já estavam fora do Next em produção antes do PR #127 (B-013). Não liberar no escuro:
// saas/export não tem autenticação (S-05). A lista só pode diminuir.
const FORA_CONHECIDAS = new Set([
  "admin/access-control", "auth/policy", "comprovante-email", "fiscal/emitir", "hefisto/automation/cron",
  "ia-cardapio-fichas", "ia-evidencia", "ia-ficha-assistente", "integrations", "integrations/events",
  "integrations/[provider]/test", "ocr", "saas/export", "versao",
]);

function rotas(dir, base = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    if (!f.isDirectory()) return f.name === "route.js" && base ? [base] : [];
    return rotas(path.join(dir, f.name), base ? `${base}/${f.name}` : f.name);
  });
}

test("toda rota nova de app/api chega ao Next pela Vercel", () => {
  const todas = rotas(path.join(raiz, "app", "api"));
  const fora = todas.filter((r) => !lista.test(r));
  assert.deepEqual(fora.filter((r) => !FORA_CONHECIDAS.has(r)), [], "rota nova fora do vercel.json (daria 404 em produção)");
  assert.deepEqual([...FORA_CONHECIDAS].filter((r) => !fora.includes(r)), [], "já chega ao Next: tire da lista FORA_CONHECIDAS");
});

test("as APIs do Intelligence Core chegam ao Next; saas/export continua fora (sem autenticação)", () => {
  for (const r of ["intelligence/brief", "intelligence/ask", "intelligence/history", "intelligence/preferences", "intelligence/feedback", "intelligence/actions/confirm", "intelligence/actions/cancel"]) {
    assert.ok(lista.test(r), r);
  }
  assert.ok(!lista.test("saas/export"));
});
