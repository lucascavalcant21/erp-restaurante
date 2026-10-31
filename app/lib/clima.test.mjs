import test from "node:test";
import assert from "node:assert/strict";
import { ehPerguntaDoTempo, diaDaPergunta, textoDaPrevisao, descricaoDoTempo } from "./clima.mjs";

test("entende pergunta do tempo e o dia", () => {
  assert.equal(ehPerguntaDoTempo("Qual a previsão do tempo amanhã?"), true);
  assert.equal(ehPerguntaDoTempo("vai chover hoje?"), true);
  assert.equal(ehPerguntaDoTempo("quanto tenho de picanha"), false);
  assert.equal(diaDaPergunta("vai chover amanhã?"), 1);
  assert.equal(diaDaPergunta("e depois de amanhã?"), 2);
  assert.equal(diaDaPergunta("como está o tempo"), 0);
});

test("texto da previsão com chuva e sem dado", () => {
  const previsao = { current: { temperature_2m: 29.4 }, daily: { time: ["2026-10-29", "2026-10-30"], weathercode: [61, 1], temperature_2m_max: [31.2, 33], temperature_2m_min: [24.6, 25], precipitation_probability_max: [80, 10] } };
  const hoje = textoDaPrevisao({ cidade: "Belém", previsao, dia: 0 });
  assert.match(hoje, /Hoje em Belém: chuva, entre 25°C e 31°C, 80% de chance de chuva\. Agora faz 29°C\./);
  assert.match(hoje, /delivery/);
  assert.match(textoDaPrevisao({ cidade: "Belém", previsao, dia: 1 }), /Amanhã em Belém: poucas nuvens/);
  assert.match(textoDaPrevisao({ cidade: "Belém", previsao: null }), /DADOS INSUFICIENTES/);
  assert.equal(descricaoDoTempo(95), "tempestade");
});

test("temperatura de equipamento não é previsão do tempo", () => {
  assert.equal(ehPerguntaDoTempo("qual a temperatura da câmara fria?"), false);
  assert.equal(ehPerguntaDoTempo("qual a temperatura hoje?"), true);
});
