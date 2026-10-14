// Cadastro e teste da conexão do iFood, sem rede: banco em memória, cofre e
// iFood falsos. Rode: node --test app/lib/server/ifood-conexao.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { lerConexao, salvarConexao, testarConexao, desconectar, validarCadastro, mascarar, clienteIfood, MSG } from "./ifood-conexao.mjs";

// banco mínimo no formato do supabase-js (from/select/eq/maybeSingle/upsert/update/delete)
function bancoFalso({ semTabelas = false } = {}) {
  const t = { integration_connections: [], integration_secrets: [], unidades: [{ id: "u1", ifood_conectado: true }] };
  const from = (nome) => {
    const filtros = [];
    let op = "select"; let dados = null; let conflito = null;
    const casa = (r) => filtros.every(([c, v]) => r[c] === v);
    const exec = () => {
      if (semTabelas && nome.startsWith("integration_")) return { data: null, error: { message: `relation "public.${nome}" does not exist` } };
      const lista = t[nome];
      if (op === "select") return { data: lista.find(casa) || null, error: null };
      if (op === "update") { lista.filter(casa).forEach((r) => Object.assign(r, dados)); return { error: null }; }
      if (op === "delete") { t[nome] = lista.filter((r) => !casa(r)); return { error: null }; }
      if (op === "upsert") {
        const chaves = conflito.split(",");
        const ex = lista.find((r) => chaves.every((k) => r[k] === dados[k]));
        if (ex) Object.assign(ex, dados); else lista.push({ ...dados });
        return { error: null };
      }
    };
    const b = {
      select() { op = "select"; return b; }, eq(c, v) { filtros.push([c, v]); return b; },
      maybeSingle() { return Promise.resolve(exec()); },
      upsert(d, o) { op = "upsert"; dados = d; conflito = o.onConflict; return Promise.resolve(exec()); },
      update(d) { op = "update"; dados = d; return b; }, delete() { op = "delete"; return b; },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
    };
    return b;
  };
  return { from, t };
}

const cifrar = (o) => ({ isEncrypted: true, encryptedData: Buffer.from(JSON.stringify(o)).toString("base64") });
const decifrar = (e) => JSON.parse(Buffer.from(e.encryptedData, "base64").toString());
const MERCHANT = "1b2c3d4e-0000-4000-8000-00000000abcd";
const dados = { merchantId: MERCHANT, clientId: "cliente-aplicativo-123", clientSecret: "segredo-muito-secreto" };

test("validação do cadastro e máscara", () => {
  assert.equal(validarCadastro({ merchantId: "loja", clientId: "x", clientSecret: "" }).length, 3);
  assert.deepEqual(validarCadastro(dados), []);
  assert.deepEqual(validarCadastro({ ...dados, clientSecret: "" }, { temSegredoSalvo: true }), []);
  assert.equal(mascarar("cliente-aplicativo-123"), "clie••••-123");
});

test("salvar guarda o segredo cifrado, nunca devolve e desliga o 'conectado' até testar", async () => {
  const db = bancoFalso();
  const r = await salvarConexao(db, "u1", dados, { cifrar, cofreConfigurado: true, quem: "Lucas" });
  assert.equal(r.ok, true);
  const sec = db.t.integration_secrets[0];
  assert.equal(sec.credentials_payload.isEncrypted, true);
  assert.ok(!JSON.stringify(sec).includes("segredo-muito-secreto"), "segredo em texto puro no banco");
  assert.equal(db.t.unidades[0].ifood_conectado, false);
  const tela = await lerConexao(db, "u1", { cofreConfigurado: true });
  assert.equal(tela.status, "CONFIGURED_UNVERIFIED");
  assert.equal(tela.temSegredo, true);
  assert.ok(!JSON.stringify(tela).includes("segredo-muito-secreto"));
  assert.ok(!JSON.stringify(tela).includes("cliente-aplicativo-123"), "client id completo não volta para a tela");
});

test("sem a chave do cofre o segredo não é gravado", async () => {
  const db = bancoFalso();
  const r = await salvarConexao(db, "u1", dados, { cifrar, cofreConfigurado: false });
  assert.deepEqual(r, { ok: false, erro: MSG.SEM_COFRE });
  assert.equal(db.t.integration_secrets.length, 0);
});

test("editar sem redigitar o segredo mantém o guardado; trocar o Client ID exige o segredo novo", async () => {
  const db = bancoFalso();
  await salvarConexao(db, "u1", dados, { cifrar, cofreConfigurado: true });
  assert.equal((await salvarConexao(db, "u1", { merchantId: MERCHANT, clientId: "", clientSecret: "" }, { cifrar, cofreConfigurado: true })).ok, true);
  const r = await salvarConexao(db, "u1", { merchantId: MERCHANT, clientId: "outro-aplicativo-9", clientSecret: "" }, { cifrar, cofreConfigurado: true });
  assert.equal(r.ok, false);
  assert.ok(r.erro.includes("Client Secret"));
});

const ifoodFalso = ({ lojas = [{ id: MERCHANT, nome: "Sel de Estrela Marmitas" }], recusa = false } = {}) => ({
  async token(id, secret) { if (recusa || secret !== "segredo-muito-secreto") { const e = new Error("O iFood recusou o Client ID ou o Client Secret."); e.http = 401; throw e; } return "tok"; },
  async lojas() { return lojas; },
});

test("teste real: conecta só se o Merchant ID está entre as lojas liberadas", async () => {
  const db = bancoFalso();
  await salvarConexao(db, "u1", dados, { cifrar, cofreConfigurado: true });
  const ok = await testarConexao(db, "u1", { decifrar, ifood: ifoodFalso() });
  assert.deepEqual([ok.ok, ok.status], [true, "CONNECTED"]);
  assert.ok(ok.mensagem.includes("Sel de Estrela Marmitas"));
  assert.equal(db.t.unidades[0].ifood_conectado, true);
  const outra = await testarConexao(db, "u1", { decifrar, ifood: ifoodFalso({ lojas: [{ id: "outra", nome: "X" }] }) });
  assert.equal(outra.ok, false);
  assert.ok(outra.mensagem.includes("não está entre"));
  assert.equal(db.t.unidades[0].ifood_conectado, false);
  const recusado = await testarConexao(db, "u1", { decifrar, ifood: ifoodFalso({ recusa: true }) });
  assert.deepEqual([recusado.ok, recusado.status], [false, "AUTH_EXPIRED"]);
  assert.equal((await lerConexao(db, "u1")).ultimoErro, "O iFood recusou o Client ID ou o Client Secret.");
});

test("testar sem cadastro e desconectar", async () => {
  const db = bancoFalso();
  assert.equal((await testarConexao(db, "u1", { decifrar, ifood: ifoodFalso() })).erro, MSG.SEM_CADASTRO);
  await salvarConexao(db, "u1", dados, { cifrar, cofreConfigurado: true });
  await testarConexao(db, "u1", { decifrar, ifood: ifoodFalso() });
  await desconectar(db, "u1");
  assert.equal(db.t.integration_secrets.length, 0);
  assert.equal((await lerConexao(db, "u1")).status, "DISABLED");
  assert.equal(db.t.unidades[0].ifood_conectado, false);
});

test("banco sem as tabelas: mensagem clara, nada quebra", async () => {
  const r = await lerConexao(bancoFalso({ semTabelas: true }), "u1");
  assert.deepEqual([r.ok, r.semTabelas, r.erro], [false, true, MSG.SEM_TABELAS]);
});

test("cliente iFood: chamadas certas e erro 401 vira mensagem em português", async () => {
  const chamadas = [];
  const fetchFalso = async (url, opt) => {
    chamadas.push([url, opt?.method || "GET"]);
    if (url.endsWith("/oauth/token")) {
      assert.ok(String(opt.body).includes("grantType=client_credentials"));
      return { ok: true, json: async () => ({ accessToken: "abc" }) };
    }
    assert.equal(opt.headers.Authorization, "Bearer abc");
    return { ok: true, json: async () => [{ id: MERCHANT, name: "Loja" }] };
  };
  const c = clienteIfood(fetchFalso, "https://x");
  const lojas = await c.lojas(await c.token("id", "sec"));
  assert.deepEqual(lojas, [{ id: MERCHANT, nome: "Loja" }]);
  assert.deepEqual(chamadas.map((x) => x[0]), ["https://x/authentication/v1.0/oauth/token", "https://x/merchant/v1.0/merchants"]);
  const recusa = clienteIfood(async () => ({ ok: false, status: 401 }), "https://x");
  await assert.rejects(() => recusa.token("a", "b"), /recusou/);
});
