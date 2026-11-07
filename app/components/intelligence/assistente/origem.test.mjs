import test from "node:test";
import assert from "node:assert/strict";
import { linkDoAssistente, origemDaUrl, ROTA_ASSISTENTE } from "./origem.mjs";

test("ida e volta: pergunta, rota e produto aberto", () => {
  const url = linkDoAssistente({ texto: "Quanto tenho disso?", tela: { rota: "/dashboard/operacao/estoque?aba=bar", entidade: { tipo: "produto", id: "abc-123", nome: "Picanha" } } });
  assert.ok(url.startsWith(`${ROTA_ASSISTENTE}?`));
  const o = origemDaUrl(new URL(url, "https://x").searchParams);
  assert.equal(o.pergunta, "Quanto tenho disso?");
  assert.deepEqual(o.tela, { rota: "/dashboard/operacao/estoque?aba=bar", entidade: { tipo: "produto", id: "abc-123", nome: "Picanha" } });
  assert.equal(o.rotulo, "Produto: Picanha · operacao/estoque");
});

test("sem contexto, rota de fora ou tipo desconhecido: nada passa", () => {
  assert.equal(linkDoAssistente(), ROTA_ASSISTENTE);
  assert.equal(linkDoAssistente({ tela: { rota: "/dashboard/inteligencia" } }), ROTA_ASSISTENTE);
  const o = origemDaUrl(new URLSearchParams("de=https://mal.com&tipo=senha&id=1"));
  assert.deepEqual(o, { pergunta: null, tela: null, rotulo: null });
  const o2 = origemDaUrl(new URLSearchParams("de=/dashboard/rh&tipo=colaborador&id=../x"));
  assert.deepEqual(o2.tela, { rota: "/dashboard/rh", entidade: null });
});
