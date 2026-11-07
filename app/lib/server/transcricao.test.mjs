import test from "node:test";
import assert from "node:assert/strict";
import { transcrever, validarAudio, tipoDoAudio, limparTranscricao, MODELO_PADRAO, MODELO_RESERVA, MAX_BYTES_AUDIO } from "./transcricao.mjs";

const audio = (bytes = 4000, type = "audio/mp4") => new Blob([new Uint8Array(bytes)], { type });
const resposta = (status, corpo) => ({ ok: status < 300, status, json: async () => corpo });

test("formato e tamanho do áudio", () => {
  assert.deepEqual(tipoDoAudio("audio/webm;codecs=opus"), { mime: "audio/webm", ext: "webm" });
  assert.deepEqual(tipoDoAudio("audio/mp4"), { mime: "audio/mp4", ext: "m4a" });
  assert.equal(tipoDoAudio("image/png"), null);
  assert.equal(validarAudio(null).status, 400);
  assert.equal(validarAudio({ size: 100, type: "audio/mp4" }).status, 400);
  assert.equal(validarAudio({ size: MAX_BYTES_AUDIO + 1, type: "audio/mp4" }).status, 413);
  assert.equal(validarAudio({ size: 5000, type: "text/plain" }).status, 415);
  assert.equal(limparTranscricao('  "Adicione 3 kg   de picanha."  '), "Adicione 3 kg de picanha.");
});

test("transcreve em português, com vocabulário da casa, sem chave não chama nada", async () => {
  const chamadas = [];
  const fetchImpl = async (url, init) => { chamadas.push({ url, corpo: init.body, auth: init.headers.Authorization }); return resposta(200, { text: " Quanto tenho de sal fino? " }); };
  const r = await transcrever({ arquivo: audio(), chave: "k", fetchImpl });
  assert.deepEqual(r, { ok: true, texto: "Quanto tenho de sal fino?", modelo: MODELO_PADRAO });
  assert.equal(chamadas[0].url, "https://api.openai.com/v1/audio/transcriptions");
  assert.equal(chamadas[0].corpo.get("language"), "pt");
  assert.equal(chamadas[0].corpo.get("model"), MODELO_PADRAO);
  assert.match(chamadas[0].corpo.get("prompt"), /picanha/);
  assert.equal(chamadas[0].corpo.get("file").name, "voz.m4a");
  const sem = await transcrever({ arquivo: audio(), chave: "", fetchImpl: () => { throw new Error("não devia chamar"); } });
  assert.equal(sem.status, 503);
});

test("modelo indisponível cai no reserva; limite e falha viram mensagem clara", async () => {
  const modelos = [];
  const r = await transcrever({ arquivo: audio(), chave: "k", fetchImpl: async (u, i) => { modelos.push(i.body.get("model")); return modelos.length === 1 ? resposta(404, { error: { message: "model not found" } }) : resposta(200, { text: "ok" }); } });
  assert.deepEqual(modelos, [MODELO_PADRAO, MODELO_RESERVA]);
  assert.equal(r.modelo, MODELO_RESERVA);
  assert.equal((await transcrever({ arquivo: audio(), chave: "k", fetchImpl: async () => resposta(429, {}) })).status, 429);
  assert.equal((await transcrever({ arquivo: audio(), chave: "k", fetchImpl: async () => resposta(500, {}) })).status, 502);
  assert.equal((await transcrever({ arquivo: audio(), chave: "k", fetchImpl: async () => resposta(200, { text: "  " }) })).status, 422);
});
