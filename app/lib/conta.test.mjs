// Minha conta e cartão de perfil (14/11/2026). Rode: node --test app/lib/conta.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { iniciais, emailReal, linkIndicacao, situacaoAssinatura } from "./conta.mjs";

test("iniciais: primeira e última palavra", () => {
  assert.equal(iniciais("Lucas Cavalcante Guedes"), "LG");
  assert.equal(iniciais("ana"), "A");
  assert.equal(iniciais("  "), "?");
  assert.equal(iniciais(null), "?");
});

test("e-mail de login de app não conta como e-mail real", () => {
  assert.equal(emailReal("lucas@gmail.com"), true);
  assert.equal(emailReal("bar@hefisto.app"), false);
  assert.equal(emailReal("semarroba"), false);
});

test("indicação vai pelo WhatsApp com o texto codificado", () => {
  const link = linkIndicacao("Lucas");
  assert.ok(link.startsWith("https://wa.me/?text="));
  assert.ok(decodeURIComponent(link.split("text=")[1]).includes("Indicação de Lucas."));
});

test("sem plano no banco: não inventa assinatura", () => {
  const s = situacaoAssinatura({ nome: "Empresa" });
  assert.equal(s.registrado, false);
  assert.match(s.detalhe, /DADOS INSUFICIENTES/);
  assert.equal(situacaoAssinatura(null).registrado, false);
});

test("com plano: nome comercial e situação", () => {
  assert.deepEqual(situacaoAssinatura({ plano_id: "PRO", status: "ACTIVE" }), { registrado: true, rotulo: "Profissional", detalhe: "Assinatura ativa" });
  assert.equal(situacaoAssinatura({ plano_id: "XYZ" }).detalhe, "Situação não informada");
});
