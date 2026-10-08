// Webhook do WhatsApp — verificação OBRIGATÓRIA e FECHADA, nos HANDLERS REAIS.
//
// O adapter é trocado por um falso que só anota o payload: nenhum evento pode
// chegar nele sem WHATSAPP_APP_SECRET configurado e X-Hub-Signature-256 válida.
// O GET de verificação não tem token padrão: sem WHATSAPP_VERIFY_TOKEN, 403.
//
//   node scripts/test_webhook_whatsapp_assinatura.mjs
import { register } from "node:module";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test, beforeEach } from "node:test";

register("./stub-next-server.mjs", import.meta.url);
register("./stub-whatsapp-adapter.mjs", import.meta.url);

const SEGREDO = "segredo-do-app-meta-para-teste";
const ROTA = "https://exemplo.test/api/channels/whatsapp/webhook";
const CORPO = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { messages: [{ from: "5511987654321", id: "wamid.1", type: "text", text: { body: "Quanto tenho de picanha?" } }] } }] }],
});
const assinar = (corpo, segredo = SEGREDO) => `sha256=${crypto.createHmac("sha256", segredo).update(corpo).digest("hex")}`;
const post = (assinatura, corpo = CORPO) => new Request(ROTA, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(assinatura != null ? { "X-Hub-Signature-256": assinatura } : {}) },
  body: corpo,
});
const desafio = (token) => new Request(`${ROTA}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=desafio-123`);

const { GET, POST } = await import("../app/api/channels/whatsapp/webhook/route.js");

/** Dá a vez ao processamento assíncrono que a rota dispara sem esperar. */
const eventos = async () => { await new Promise((r) => setImmediate(r)); return globalThis.__eventosWhatsApp; };

beforeEach(() => {
  globalThis.__eventosWhatsApp = [];
  process.env.WHATSAPP_APP_SECRET = SEGREDO;
  process.env.WHATSAPP_VERIFY_TOKEN = "token-de-verificacao-teste";
});

test("sem WHATSAPP_APP_SECRET → 503 e nada é processado, nem com assinatura", async () => {
  for (const vazio of [undefined, ""]) {
    if (vazio === undefined) delete process.env.WHATSAPP_APP_SECRET; else process.env.WHATSAPP_APP_SECRET = vazio;
    for (const assinatura of [null, assinar(CORPO), assinar(CORPO, "")]) {
      const r = await POST(post(assinatura));
      assert.equal(r.status, 503, `segredo=${JSON.stringify(vazio)} assinatura=${assinatura}`);
    }
  }
  assert.deepEqual(await eventos(), []);
});

test("sem cabeçalho X-Hub-Signature-256 → 401 e nada é processado", async () => {
  for (const assinatura of [null, ""]) {
    const r = await POST(post(assinatura));
    assert.equal(r.status, 401, JSON.stringify(assinatura));
    assert.equal((await r.json()).success, undefined);
  }
  assert.deepEqual(await eventos(), []);
});

test("assinatura errada → 401 e nada é processado", async () => {
  const outroCorpo = CORPO.replace("picanha", "alcatra");
  for (const assinatura of [
    assinar(CORPO, "outro-segredo"),                    // segredo de outro app
    assinar(outroCorpo),                                // assinatura de outro corpo (corpo adulterado)
    assinar(CORPO).replace(/.$/, (c) => (c === "0" ? "1" : "0")), // um dígito trocado
    assinar(CORPO).slice("sha256=".length),             // hex certo, mas sem o prefixo sha256=
    assinar(CORPO).replace("sha256=", "sha1="),         // prefixo de outro algoritmo
  ]) {
    const r = await POST(post(assinatura));
    assert.equal(r.status, 401, assinatura);
  }
  assert.deepEqual(await eventos(), []);
});

test("assinatura de tamanho diferente → 401 (sem exceção do timingSafeEqual) e nada é processado", async () => {
  const certa = assinar(CORPO);
  for (const assinatura of ["sha256=", "sha256=abc", certa.slice(0, -1), `${certa}0`, `${certa}${certa.slice(7)}`, "sha256=é".padEnd(71, "0")]) {
    const r = await POST(post(assinatura));
    assert.equal(r.status, 401, `tamanho ${assinatura.length}`);
  }
  assert.deepEqual(await eventos(), []);
});

test("assinatura certa → 200 e o evento é processado uma vez", async () => {
  const r = await POST(post(assinar(CORPO)));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true, status: "EVENT_RECEIVED" });
  assert.deepEqual(await eventos(), [JSON.parse(CORPO)]);
});

test("GET sem WHATSAPP_VERIFY_TOKEN → 403, inclusive com o antigo token padrão", async () => {
  for (const vazio of [undefined, "", "  ", '""']) {
    if (vazio === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN; else process.env.WHATSAPP_VERIFY_TOKEN = vazio;
    for (const token of ["hefisto_verify_token", "", '""']) {
      const r = await GET(desafio(token));
      assert.equal(r.status, 403, `env=${JSON.stringify(vazio)} token=${JSON.stringify(token)}`);
      assert.doesNotMatch(await r.text(), /desafio-123/);
    }
  }
});

test("GET com WHATSAPP_VERIFY_TOKEN: token certo devolve o desafio, errado → 403", async () => {
  const ok = await GET(desafio("token-de-verificacao-teste"));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "desafio-123");
  for (const token of ["hefisto_verify_token", "token-de-verificacao-test", "token-de-verificacao-teste-mais"]) {
    assert.equal((await GET(desafio(token))).status, 403, token);
  }
});
