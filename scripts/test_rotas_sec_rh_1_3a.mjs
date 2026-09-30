// SEC-RH-1.3A — contrato HTTP dos HANDLERS REAIS, sem rede.
//
// O Supabase aponta para 127.0.0.1:1 (porta que recusa conexão): o que é
// decidido antes do banco (sessão ausente, entrada inválida, isca) tem de
// responder certo; o que chega ao banco tem de falhar FECHADO, sem vazar
// mensagem interna.
//
//   node scripts/test_rotas_sec_rh_1_3a.mjs
import { register } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";

register("./stub-next-server.mjs", import.meta.url);
register("./stub-supabase-cliente.mjs", import.meta.url);

process.env.HEFISTO_ENV = "test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-falsa-so-para-construir-o-cliente";
globalThis.__supabaseFalso = {};

const BASE = "https://exemplo.test";
const post = (rota, corpo, token) => new Request(`${BASE}${rota}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
});
const get = (rota) => new Request(`${BASE}${rota}`);

const { POST: assinar } = await import("../app/api/rh/arquivos/assinar/route.js");
const { POST: enviar } = await import("../app/api/rh/arquivos/enviar/route.js");
const { POST: remover } = await import("../app/api/rh/arquivos/remover/route.js");
const { POST: cadastroExtra } = await import("../app/api/public/extras/cadastro/route.js");
const { POST: convite } = await import("../app/api/public/extras/convite/route.js");
const { POST: candidatura } = await import("../app/api/public/vagas/candidatura/route.js");
const { GET: treinamento } = await import("../app/api/public/treinamento/[token]/route.js");

/** Corpo não pode trazer nada de dentro: stack, mensagem do Postgres, chave. */
async function semVazamento(resposta) {
  const txt = await resposta.clone().text();
  assert.ok(txt.length < 300, `resposta curta (${txt.length})`);
  for (const proibido of [/at \w+ \(/, /node_modules/, /postgres|PGRST|42\d{3}/i, /chave-falsa/, /service_role/i, /127\.0\.0\.1/]) {
    assert.doesNotMatch(txt, proibido);
  }
  assert.equal(resposta.headers.get("cache-control"), "no-store");
  return JSON.parse(txt);
}

test("arquivos de RH sem sessão → 401, nas três rotas", async () => {
  for (const [nome, h, corpo] of [
    ["assinar", assinar, { itens: [{ fonte: "atestado", id: "a1" }] }],
    ["enviar", enviar, { fonte: "atestado", donoId: "c1", nomeArquivo: "a.pdf", tamanho: 10 }],
    ["remover", remover, { fonte: "atestado", id: "a1" }],
  ]) {
    const r = await h(post(`/api/rh/arquivos/${nome}`, corpo));
    assert.equal(r.status, 401, nome);
    const j = await semVazamento(r);
    assert.equal(j.codigo, "sessao_ausente");
    assert.equal("url" in j || "itens" in j, false);
  }
});

test("arquivos de RH com token inventado → 401, sem URL", async () => {
  const r = await assinar(post("/api/rh/arquivos/assinar", { itens: [{ fonte: "documento", id: "d1" }] }, "token-inventado"));
  assert.equal(r.status, 401);
  await semVazamento(r);
});

test("sem sessão, a entrada nem é olhada: corpo quebrado ainda é 401, não 400", async () => {
  const r = await assinar(post("/api/rh/arquivos/assinar", "{isso nao e json"));
  assert.equal(r.status, 401);
});

test("cadastro de extra: isca preenchida finge sucesso e não grava", async () => {
  const r = await cadastroExtra(post("/api/public/extras/cadastro", { unidade: "A", website: "http://spam", form: {} }));
  assert.equal(r.status, 200);
  assert.deepEqual(await semVazamento(r), { ok: true });
});

test("cadastro de extra: entrada inválida → 400 antes do banco", async () => {
  const r1 = await cadastroExtra(post("/api/public/extras/cadastro", "nao-json"));
  assert.equal(r1.status, 400);
  const r2 = await cadastroExtra(post("/api/public/extras/cadastro", { unidade: "A", form: { nome: "Jo" } }));
  assert.equal(r2.status, 400);
  await semVazamento(r2);
});

test("cadastro de extra válido com banco fora do ar → 503 genérico", async () => {
  const r = await cadastroExtra(post("/api/public/extras/cadastro", {
    unidade: "A",
    form: { nome: "Maria Teste", telefone: "61999990000", funcao_principal: "Garçom", dias_disponiveis: ["sab"] },
  }));
  assert.equal(r.status, 503);
  const j = await semVazamento(r);
  assert.equal("convite" in j, false);
});

test("convite: token malformado ou id de cadastro → 404 igual", async () => {
  for (const token of ["curto", "8f1c0d2e-1111-2222-3333-444455556666", null]) {
    const r = await convite(post("/api/public/extras/convite", { token }));
    assert.equal(r.status, 404, String(token));
    assert.equal((await semVazamento(r)).codigo, "convite_invalido");
  }
});

test("candidatura: CPF inválido → 400; isca → 200 sem gravar", async () => {
  const r = await candidatura(post("/api/public/vagas/candidatura", { unidade: "A", dados: { nome: "João Teste", telefone: "61999990000", cpf: "123" } }));
  assert.equal(r.status, 400);
  await semVazamento(r);
  const isca = await candidatura(post("/api/public/vagas/candidatura", { unidade: "A", website: "x" }));
  assert.equal(isca.status, 200);
});

test("treinamento público: id de registro não abre; token malformado → 404", async () => {
  for (const token of ["1", "8f1c0d2e-1111-2222-3333-444455556666", "../x"]) {
    const r = await treinamento(get(`/api/public/treinamento/${encodeURIComponent(token)}`), { params: Promise.resolve({ token }) });
    assert.equal(r.status, 404, token);
    await semVazamento(r);
  }
});
