// Testes do registro de integrações. Rode com:
// node --test app/lib/server/integracoes.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { INTEGRACOES, autenticarIntegracao, verificarHmac, verificarBearer, assinaturaHmac, igualEmTempoConstante } from "./integracoes.mjs";
import { CODIGOS } from "./codigos.mjs";

const cab = (obj) => ({ get: (n) => obj[n.toLowerCase()] ?? null });

test("toda integração tem identidade, canal, segredo próprio e permissões explícitas", () => {
  const variaveis = new Set();
  for (const [id, cfg] of Object.entries(INTEGRACOES)) {
    assert.ok(["sistema", "integracao"].includes(cfg.canal), `${id}: canal`);
    assert.ok(Array.isArray(cfg.permissoes), `${id}: permissões explícitas`);
    const v = cfg.autenticacao.variavel;
    assert.match(v, /^[A-Z][A-Z0-9_]+$/, `${id}: variável de segredo`);
    assert.notEqual(v, "SUPABASE_SERVICE_ROLE_KEY", `${id}: não reaproveita a service role`);
    assert.equal(variaveis.has(v), false, `${id}: segredo compartilhado com outra integração`);
    variaveis.add(v);
  }
});

test("sem segredo configurado a integração fica FECHADA (503), não aberta", () => {
  const r = autenticarIntegracao({ id: "cron", cabecalhos: cab({ authorization: "Bearer qualquer-coisa-longa-1234" }), env: {}, requestId: "r" });
  assert.equal(r.status, 503);
  assert.equal(r.codigo, CODIGOS.NAO_CONFIGURADO);
});

test("cron: bearer certo passa; errado, curto ou ausente não", () => {
  const env = { CRON_SECRET: "segredo-do-cron-com-tamanho-bom" };
  assert.equal(autenticarIntegracao({ id: "cron", cabecalhos: cab({ authorization: "Bearer segredo-do-cron-com-tamanho-bom" }), env, requestId: "r" }).ok, true);
  assert.equal(autenticarIntegracao({ id: "cron", cabecalhos: cab({ authorization: "Bearer segredo-do-cron-com-tamanho-ERRADO" }), env, requestId: "r" }).status, 401);
  assert.equal(autenticarIntegracao({ id: "cron", cabecalhos: cab({}), env, requestId: "r" }).status, 401);
  assert.equal(verificarBearer("Bearer curto", "curto"), false);
});

test("webhook: assinatura HMAC do CORPO; corpo alterado ou assinatura de outro segredo não passa", () => {
  const env = { WHATSAPP_APP_SECRET: "segredo-meta-teste" };
  const corpo = JSON.stringify({ entry: [{ id: "1" }] });
  const boa = `sha256=${assinaturaHmac("segredo-meta-teste", corpo)}`;
  const ok = autenticarIntegracao({ id: "whatsapp", cabecalhos: cab({ "x-hub-signature-256": boa }), corpoBruto: corpo, env, requestId: "r" });
  assert.equal(ok.ok, true);
  assert.equal(ok.contexto.actor.id, "whatsapp");
  assert.equal(ok.contexto.userId, null);
  assert.deepEqual([...ok.contexto.permissions], []);
  assert.equal(autenticarIntegracao({ id: "whatsapp", cabecalhos: cab({ "x-hub-signature-256": boa }), corpoBruto: corpo + " ", env, requestId: "r" }).status, 401);
  const outra = `sha256=${assinaturaHmac("outro-segredo", corpo)}`;
  assert.equal(autenticarIntegracao({ id: "whatsapp", cabecalhos: cab({ "x-hub-signature-256": outra }), corpoBruto: corpo, env, requestId: "r" }).status, 401);
  assert.equal(verificarHmac({ segredo: "s", corpoBruto: corpo, assinatura: assinaturaHmac("s", corpo), prefixo: "sha256=" }), false, "sem prefixo exigido");
});

test("integração desconhecida não autentica", () => {
  assert.equal(autenticarIntegracao({ id: "qualquer", cabecalhos: cab({}), env: {}, requestId: "r" }).codigo, CODIGOS.INTEGRACAO_DESCONHECIDA);
});

test("comparação em tempo constante não confunde prefixo nem tamanho", () => {
  assert.equal(igualEmTempoConstante("abc", "abc"), true);
  assert.equal(igualEmTempoConstante("abc", "abcd"), false);
  assert.equal(igualEmTempoConstante("", ""), true);
  assert.equal(igualEmTempoConstante(null, "a"), false);
});
