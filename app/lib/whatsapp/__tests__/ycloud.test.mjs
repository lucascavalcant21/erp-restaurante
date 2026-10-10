// HDEV-WA-COEX-001: provedor YCloud sem rede (TESTADO LOCAL).
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { assinaturaYCloudValida, lerEventoYCloud, enviarTextoYCloud, TOLERANCIA_S } from "../ycloud.mjs";
import { enviar, provedor } from "../envio.mjs";

const SEGREDO = "whsec_teste";
const assinar = (corpo, t, segredo = SEGREDO) => `t=${t},s=${createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex")}`;
const AGORA = 1_760_000_000;
const ADMIN = "5545998574041";
const HEFISTO = "5545988125320";

test("assinatura YCloud: obrigatória, HMAC de t.corpo, recusa velha (replay) e segredo errado", () => {
  const corpo = '{"id":"evt_1"}';
  assert.ok(assinaturaYCloudValida(corpo, assinar(corpo, AGORA), SEGREDO, AGORA));
  assert.ok(!assinaturaYCloudValida(corpo, assinar(corpo, AGORA), "", AGORA), "sem segredo configurado");
  assert.ok(!assinaturaYCloudValida(corpo, null, SEGREDO, AGORA), "sem cabeçalho");
  assert.ok(!assinaturaYCloudValida(`${corpo} `, assinar(corpo, AGORA), SEGREDO, AGORA), "corpo alterado");
  assert.ok(!assinaturaYCloudValida(corpo, assinar(corpo, AGORA, "outro"), SEGREDO, AGORA), "segredo errado");
  assert.ok(!assinaturaYCloudValida(corpo, assinar(corpo, AGORA - TOLERANCIA_S - 1), SEGREDO, AGORA), "assinatura velha");
  assert.ok(!assinaturaYCloudValida(corpo, "t=abc,s=xyz", SEGREDO, AGORA), "formato inválido não lança");
});

test("evento: mensagem de cliente vira mensagem do gateway; eco e histórico NUNCA viram comando", () => {
  const msg = lerEventoYCloud({ id: "evt_1", type: "whatsapp.inbound_message.received", whatsappInboundMessage: {
    id: "yc_1", wamid: "wamid.A", from: `+${ADMIN}`, to: `+${HEFISTO}`, type: "text", text: { body: "status" }, sendTime: "2026-10-10T12:00:00.000Z" } });
  assert.equal(msg.tipo, "mensagem");
  assert.deepEqual(msg.mensagem, { id: "wamid.A", de: ADMIN, para: HEFISTO, tipo: "text", texto: "status", ts: Math.floor(Date.parse("2026-10-10T12:00:00.000Z") / 1000) });

  for (const type of ["whatsapp.smb.message.echoes", "whatsapp.smb.message.created"]) {
    const e = lerEventoYCloud({ id: "evt_2", type, whatsappMessage: { from: `+${HEFISTO}`, to: `+${ADMIN}`, type: "text", text: { body: "aprovar APR-001" } } });
    assert.equal(e.tipo, "eco", "o que o dono manda pelo celular não é comando");
    assert.equal(e.mensagem, undefined);
  }
  assert.equal(lerEventoYCloud({ type: "whatsapp.smb.history", whatsappInboundMessage: { from: `+${ADMIN}`, text: { body: "pare" } } }).tipo, "historico");

  const st = lerEventoYCloud({ id: "evt_3", type: "whatsapp.message.updated", whatsappMessage: { wamid: "wamid.B", status: "failed", to: `+${ADMIN}`, errorCode: "131047", errorMessage: "Re-engagement message" } });
  assert.deepEqual(st.status, { id: "wamid.B", status: "failed", para: ADMIN, erros: [{ codigo: "131047", titulo: "Re-engagement message" }] });
  assert.equal(lerEventoYCloud(null).tipo, "outro");
});

test("envio YCloud: sendDirectly com X-API-Key, remetente da configuração, devolve o wamid; chave nunca na resposta", async () => {
  const chamadas = [];
  const env = { YCLOUD_API_KEY: "CHAVE-SECRETA", WHATSAPP_NUMERO_HEFISTO: `+${HEFISTO}` };
  const ok = async (url, o) => { chamadas.push({ url, o }); return { ok: true, json: async () => ({ id: "yc_9", wamid: "wamid.SAIDA", status: "accepted" }) }; };
  assert.deepEqual(await enviarTextoYCloud({ para: ADMIN, texto: "oi", env, fetchImpl: ok }), { ok: true, ids: ["wamid.SAIDA"] });
  assert.equal(chamadas[0].url, "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly");
  assert.equal(chamadas[0].o.headers["X-API-Key"], "CHAVE-SECRETA");
  assert.deepEqual(JSON.parse(chamadas[0].o.body), { from: `+${HEFISTO}`, to: `+${ADMIN}`, type: "text", text: { body: "oi", preview_url: false } });

  const erro = async () => ({ ok: false, status: 401, json: async () => ({ error: { code: "UNAUTHORIZED", message: "invalid api key" } }) });
  const r = await enviarTextoYCloud({ para: ADMIN, texto: "oi", env, fetchImpl: erro });
  assert.equal(r.ok, false);
  assert.ok(!JSON.stringify(r).includes("CHAVE-SECRETA"));
  const falhou = async () => ({ ok: true, json: async () => ({ status: "failed", errorCode: "131026", errorMessage: "undeliverable" }) });
  assert.equal((await enviarTextoYCloud({ para: ADMIN, texto: "oi", env, fetchImpl: falhou })).ok, false);
  assert.equal((await enviarTextoYCloud({ para: ADMIN, texto: "oi", env: {} })).ok, false);
});

test("provedor: meta por padrão; ycloud só quando configurado", async () => {
  assert.equal(provedor({}), "meta");
  assert.equal(provedor({ WHATSAPP_PROVEDOR: "YCloud" }), "ycloud");
  const urls = [];
  const f = async (url) => { urls.push(url); return { ok: true, json: async () => ({ messages: [{ id: "x" }], wamid: "y" }) }; };
  await enviar({ para: ADMIN, texto: "a", env: { WHATSAPP_API_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" }, fetchImpl: f });
  await enviar({ para: ADMIN, texto: "b", env: { WHATSAPP_PROVEDOR: "ycloud", YCLOUD_API_KEY: "k", WHATSAPP_NUMERO_HEFISTO: HEFISTO }, fetchImpl: f });
  assert.match(urls[0], /graph\.facebook\.com/);
  assert.match(urls[1], /api\.ycloud\.com/);
});
