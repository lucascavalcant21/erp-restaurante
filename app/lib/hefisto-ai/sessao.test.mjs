import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { refDaUrl, refDoToken, configuracaoDoAmbiente, diagnosticoDeSessao } from "./sessao.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/* Monta um JWT de mentira (só o payload importa: nada é validado aqui). */
const tokenFalso = (payload) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.assinatura-de-mentira`;
};

test("project ref sai da URL e do token", () => {
  assert.equal(refDaUrl("https://abcdefghij.supabase.co"), "abcdefghij");
  assert.equal(refDaUrl("http://127.0.0.1:54330"), "");
  assert.equal(refDoToken(tokenFalso({ iss: "https://abcdefghij.supabase.co/auth/v1" })), "abcdefghij");
  assert.equal(refDoToken(tokenFalso({ ref: "OutroProjeto" })), "outroprojeto");
  /* token que não é JWT não quebra nada */
  assert.equal(refDoToken("token-local-de-teste"), "");
  assert.equal(refDoToken(""), "");
  assert.equal(refDoToken(null), "");
});

test("faltar variável é problema de ambiente (503), não de login", () => {
  const config = configuracaoDoAmbiente({});
  assert.deepEqual(config.faltando, ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  const r = diagnosticoDeSessao({ config, token: tokenFalso({ iss: "https://x.supabase.co" }) });
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
  assert.equal(r.corpo.diagnostico, "config_ausente");
  assert.deepEqual(r.corpo.faltando, ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
});

test("sem token é sessão ausente", () => {
  const config = configuracaoDoAmbiente({ NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" });
  const r = diagnosticoDeSessao({ config, token: "" });
  assert.equal(r.status, 401);
  assert.equal(r.corpo.diagnostico, "sessao_ausente");
});

test("token de outro projeto é apontado com nome, não com 'sessão inválida'", () => {
  const config = configuracaoDoAmbiente({ NEXT_PUBLIC_SUPABASE_URL: "https://staging-ref.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" });
  const r = diagnosticoDeSessao({ config, token: tokenFalso({ iss: "https://producao-ref.supabase.co/auth/v1" }) });
  assert.equal(r.status, 401);
  assert.equal(r.corpo.diagnostico, "projeto_incompativel");
  assert.equal(r.corpo.projeto_do_servidor, "staging-ref");
  assert.equal(r.corpo.projeto_do_token, "producao-ref");
});

test("mesmo projeto passa da triagem", () => {
  const config = configuracaoDoAmbiente({ NEXT_PUBLIC_SUPABASE_URL: "https://mesmo-ref.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" });
  const r = diagnosticoDeSessao({ config, token: tokenFalso({ iss: "https://mesmo-ref.supabase.co/auth/v1" }) });
  assert.equal(r.ok, true);
  /* Supabase local (sem ref) também passa: não há o que comparar. */
  const local = configuracaoDoAmbiente({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54330", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" });
  assert.equal(diagnosticoDeSessao({ config: local, token: "token-local-de-teste" }).ok, true);
});

test("o diagnóstico nunca devolve o token", () => {
  const config = configuracaoDoAmbiente({ NEXT_PUBLIC_SUPABASE_URL: "https://a.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" });
  const token = tokenFalso({ iss: "https://b.supabase.co/auth/v1", sub: "usuario-1" });
  const r = diagnosticoDeSessao({ config, token });
  const serializado = JSON.stringify(r);
  assert.doesNotMatch(serializado, /assinatura-de-mentira/);
  assert.equal(serializado.includes(token), false);
});

test("o cliente do navegador não tem mais valor de reserva", () => {
  const fonte = fs.readFileSync(path.join(RAIZ, "app", "lib", "supabase.js"), "utf8");
  /* Nenhuma URL de projeto de verdade. A documentação pode citar o formato
     genérico (https://<ref>.supabase.co) — isso não é endereço nenhum. */
  assert.doesNotMatch(fonte, /https?:\/\/[a-z0-9-]{8,}\.supabase\.co/i, "URL de projeto escrita no código do cliente");
  assert.doesNotMatch(fonte, /sb_publishable_|sb_secret_|eyJhbGciOi/, "chave escrita no código do cliente");
  assert.match(fonte, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(fonte, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});
