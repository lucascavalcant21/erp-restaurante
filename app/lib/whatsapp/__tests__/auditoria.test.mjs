// HDEV-WA-COEX-001: trilha de auditoria e saúde do canal (TESTADO LOCAL).
import test from "node:test";
import assert from "node:assert/strict";
import { linhaDeEvento, criarAuditoriaWa } from "../auditoria.mjs";
import { configuracao, numerosYCloud } from "../saude.mjs";

const ADMIN = "5545998574041";

test("linha de auditoria: só campos de estado, erro da Meta, nada de texto ou segredo", () => {
  const l = linhaDeEvento({ provedor: "meta", direcao: "status", wamid: "wamid.X", status: "failed", numero: `+${ADMIN}`, erros: [{ codigo: 130497, titulo: "Business account is restricted" }], texto: "segredo" });
  assert.deepEqual(l, { provedor: "meta", direcao: "status", wamid: "wamid.X", numero: ADMIN, comando: null, resultado: null, status: "failed", erro_codigo: "130497", erro_titulo: "Business account is restricted", comando_id: null });
  assert.ok(!("texto" in l));
  assert.equal(linhaDeEvento({ direcao: "qualquer" }), null);
  assert.equal(linhaDeEvento({ provedor: "x", direcao: "saida", numero: "…4041" }).numero, null, "número mascarado/inválido não é gravado");
  assert.equal(linhaDeEvento({ direcao: "saida", erro: "401 Invalid OAuth" }).erro_titulo, "401 Invalid OAuth");
});

function bancoFalso(erro = null) {
  const linhas = [];
  return { linhas, banco: () => ({ from: () => ({ insert: async (l) => { if (!erro) linhas.push(l); return { error: erro }; } }) }) };
}

test("auditoria: grava; recibo repetido é idempotente; sem tabela ou sem banco o canal segue", async () => {
  const b = bancoFalso();
  const reg = criarAuditoriaWa(b.banco);
  assert.equal(await reg({ provedor: "ycloud", direcao: "saida", wamid: "w1", numero: ADMIN, resultado: "aceito" }), true);
  assert.equal(b.linhas[0].provedor, "ycloud");
  assert.equal(await criarAuditoriaWa(bancoFalso({ code: "23505" }).banco)({ direcao: "status", wamid: "w1", status: "sent" }), true);
  const semTabela = criarAuditoriaWa(bancoFalso({ code: "PGRST205", message: "Could not find the table" }).banco);
  assert.equal(await semTabela({ direcao: "entrada", wamid: "w2" }), false);
  assert.equal(await semTabela({ direcao: "entrada", wamid: "w3" }), false, "depois de ver a tabela ausente, nem tenta");
  assert.equal(await criarAuditoriaWa(null)({ direcao: "entrada" }), false, "sem service role: só log");
  const quebrado = criarAuditoriaWa(() => { throw new Error("rede"); });
  assert.equal(await quebrado({ direcao: "saida" }), false, "falha de banco não lança");
});

test("saúde: diz o que falta por provedor, sem devolver nenhum segredo", () => {
  const env = {
    WHATSAPP_PROVEDOR: "ycloud", YCLOUD_API_KEY: "CHAVE-SUPER-SECRETA", WHATSAPP_NUMERO_HEFISTO: "5545988125320",
    WHATSAPP_NUMEROS_DONO: ADMIN, WHATSAPP_DONO_AUTH_USER_ID: "u", WHATSAPP_DONO_UNIDADE: "x", WHATSAPP_PONTE_SEGREDO: "p".repeat(40), SUPABASE_SERVICE_ROLE_KEY: "SR-SECRETA",
  };
  const c = configuracao(env);
  assert.equal(c.provedor, "ycloud");
  assert.deepEqual(c.faltando, ["ycloud.webhookSecret"]);
  assert.equal(c.pronto, false);
  assert.equal(c.numeroHefisto, "…5320");
  assert.deepEqual(c.admins, ["…4041"]);
  assert.ok(!JSON.stringify(c).includes("SECRETA"), "nenhum valor de segredo na resposta");
  assert.deepEqual(configuracao({ ...env, YCLOUD_WEBHOOK_SECRET: "whsec_x" }).faltando, []);
  assert.ok(configuracao({}).faltando.includes("meta.apiToken"), "padrão é meta");
});

test("saúde YCloud: só estados, número mascarado; sem chave nem consulta", async () => {
  assert.deepEqual(await numerosYCloud({ env: {} }), { consultado: false });
  const f = async (url, o) => {
    assert.equal(o.headers["X-API-Key"], "k");
    return { ok: true, json: async () => ({ items: [{ phoneNumber: "+5545988125320", status: "CONNECTED", qualityRating: "GREEN", verifiedName: "Héfisto" }] }) };
  };
  const r = await numerosYCloud({ env: { YCLOUD_API_KEY: "k", WHATSAPP_NUMERO_HEFISTO: "5545988125320" }, fetchImpl: f });
  assert.deepEqual(r.numeros, [{ numero: "…5320", status: "CONNECTED", qualidade: "GREEN", nome: "Héfisto", ehHefisto: true }]);
});
