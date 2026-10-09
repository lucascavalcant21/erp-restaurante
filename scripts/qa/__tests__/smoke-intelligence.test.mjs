// Testa o smoke contra um servidor HTTP falso (TESTADO EM MOCK): valida a
// lógica dos casos, não o deploy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rodarSmoke, montarCasos } from "../smoke-intelligence.mjs";

const TOKEN = "token-de-teste";
const UNIDADE = "11111111-1111-4111-8111-111111111111";
const OUTRA = "22222222-2222-4222-8222-222222222222";

function servidorFalso({ vazar = false } = {}) {
  return createServer(async (req, res) => {
    const json = (status, corpo) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(corpo)); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(401, { erro: "Sessão inválida.", codigo: "SEM_SESSAO" });
    const unidade = req.headers["x-hefisto-unidade"];
    if (unidade === OUTRA && !vazar) return json(403, { erro: "Sem acesso.", codigo: "UNIDADE_NEGADA" });
    if (req.url === "/api/intelligence/brief") return json(200, { brief: { critical: [] }, correlationId: "ic-1" });
    if (req.url === "/api/intelligence/history") return json(200, { itens: [] });
    if (req.url === "/api/intelligence/ask") return json(200, { tipo: "resposta", texto: "R$ …", fontesConsultadas: ["vendas"] });
    return json(404, {});
  });
}

async function comServidor(opcoes, fn) {
  const srv = servidorFalso(opcoes);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try { return await fn(`http://127.0.0.1:${srv.address().port}`); } finally { srv.close(); }
}

test("sem token: só os casos de 401", () => {
  const casos = montarCasos({ token: null });
  assert.equal(casos.length, 3);
  assert.ok(casos.every((c) => !c.headers.authorization || c.headers.authorization.includes("invalido")));
});

test("deploy correto: tudo OK, nada crítico", async () => {
  const r = await comServidor({}, (baseUrl) => rodarSmoke({ baseUrl, token: TOKEN, unidade: UNIDADE, outraUnidade: OUTRA }));
  assert.equal(r.ok, true, JSON.stringify(r.resultados));
  assert.equal(r.critico, false);
  assert.equal(r.resultados.length, 7);
});

test("vazamento entre empresas: falha e marca CRÍTICO", async () => {
  const r = await comServidor({ vazar: true }, (baseUrl) => rodarSmoke({ baseUrl, token: TOKEN, unidade: UNIDADE, outraUnidade: OUTRA }));
  assert.equal(r.ok, false);
  assert.equal(r.critico, true);
});

test("token errado: casos com sessão falham", async () => {
  const r = await comServidor({}, (baseUrl) => rodarSmoke({ baseUrl, token: "outro", unidade: UNIDADE }));
  assert.equal(r.ok, false);
  assert.ok(r.resultados.filter((x) => x.nome.includes("401")).every((x) => x.ok));
});

test("rede fora: falha com erro, sem lançar", async () => {
  const r = await rodarSmoke({ baseUrl: "http://127.0.0.1:1", timeoutMs: 2000 });
  assert.equal(r.ok, false);
  assert.ok(r.resultados.every((x) => x.erro));
});

test("BASE_URL inválida lança", async () => {
  await assert.rejects(() => rodarSmoke({ baseUrl: "app.hefisto.com.br" }), /BASE_URL/);
});
