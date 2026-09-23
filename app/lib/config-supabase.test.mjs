import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REF_PRODUCAO, projectRefDaUrl, ambienteHefisto, validarConfigSupabase, getSupabasePublicConfig,
} from "./config-supabase.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_PROD = `https://${REF_PRODUCAO}.supabase.co`;
const URL_STAGING = "https://projeto-de-staging.supabase.co";
const CHAVE = "chave-qualquer-de-teste";

test("project ref sai da URL", () => {
  assert.equal(projectRefDaUrl(URL_PROD), REF_PRODUCAO);
  assert.equal(projectRefDaUrl(URL_STAGING), "projeto-de-staging");
  assert.equal(projectRefDaUrl("http://127.0.0.1:54321"), "");
  assert.equal(projectRefDaUrl(""), "");
  assert.equal(projectRefDaUrl(null), "");
});

test("o ambiente é declarado, não adivinhado", () => {
  assert.equal(ambienteHefisto({ HEFISTO_ENV: "staging" }), "staging");
  assert.equal(ambienteHefisto({ HEFISTO_ENV: "production" }), "production");
  /* preview do Vercel conta como staging: é onde não se pode tocar produção */
  assert.equal(ambienteHefisto({ VERCEL_ENV: "preview" }), "staging");
  assert.equal(ambienteHefisto({ VERCEL_ENV: "production" }), "production");
  assert.equal(ambienteHefisto({}), "development");
  /* valor sem sentido não vira production por acidente */
  assert.equal(ambienteHefisto({ HEFISTO_ENV: "prod" }), "development");
});

test("STAGING + URL de produção = erro", () => {
  const r = validarConfigSupabase({ ambiente: "staging", url: URL_PROD, chave: CHAVE });
  assert.equal(r.ok, false);
  assert.match(r.erro, /PRODUÇÃO/);
});

test("STAGING + URL de staging = permitido", () => {
  assert.equal(validarConfigSupabase({ ambiente: "staging", url: URL_STAGING, chave: CHAVE }).ok, true);
});

test("PRODUCTION + URL de produção = permitido", () => {
  assert.equal(validarConfigSupabase({ ambiente: "production", url: URL_PROD, chave: CHAVE }).ok, true);
});

test("configuração ausente = erro, nunca reserva", () => {
  assert.equal(validarConfigSupabase({ ambiente: "production", url: "", chave: CHAVE }).ok, false);
  assert.equal(validarConfigSupabase({ ambiente: "production", url: URL_PROD, chave: "" }).ok, false);
  assert.equal(validarConfigSupabase({ ambiente: "staging", url: "não-é-url", chave: CHAVE }).ok, false);
  assert.equal(validarConfigSupabase({ ambiente: "qualquer", url: URL_PROD, chave: CHAVE }).ok, false);
  /* development apontando para produção também é barrado */
  assert.equal(validarConfigSupabase({ ambiente: "development", url: URL_PROD, chave: CHAVE }).ok, false);
  /* e o helper lança em vez de devolver algo utilizável */
  assert.throws(() => getSupabasePublicConfig({ HEFISTO_ENV: "staging" }), /não está configurada/);
  assert.throws(() => getSupabasePublicConfig({ HEFISTO_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: URL_PROD, NEXT_PUBLIC_SUPABASE_ANON_KEY: CHAVE }), /PRODUÇÃO/);
});

/* ── Varredura do repositório: nada de credencial escrita no código ───────── */

const IGNORAR_DIR = new Set(["node_modules", ".next", ".git", "db", "docs", "scratch", "backend_cloud_code"]);
const EXTENSOES = /\.(js|mjs|cjs|jsx|ts|tsx)$/;

function arquivosDeCodigo(dir = RAIZ, saida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) arquivosDeCodigo(p, saida);
    else if (EXTENSOES.test(e.name)) saida.push(p);
  }
  return saida;
}
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join("/");
/* Este arquivo guarda os próprios padrões que procura; fica fora da varredura.
   config-supabase.mjs guarda o ref de produção de propósito, para RECUSAR. */
const FORA_DA_VARREDURA = ["app/lib/config-supabase.test.mjs", "app/lib/config-supabase.mjs"];
/* Nunca imprimir o valor encontrado: só o arquivo e a linha. */
const ondeCasa = (regex) => arquivosDeCodigo()
  .filter((arq) => !FORA_DA_VARREDURA.includes(rel(arq)))
  .flatMap((arq) => {
    const linhas = fs.readFileSync(arq, "utf8").split(/\r?\n/);
    return linhas
      .map((linha, i) => (regex.test(linha) ? `${rel(arq)}:${i + 1}` : null))
      .filter(Boolean);
  });

test("nenhuma URL de projeto Supabase escrita no código", () => {
  const achados = ondeCasa(/[a-z0-9-]{15,}\.supabase\.(co|in)/i);
  assert.deepEqual(achados, [], `URL de projeto no código: ${achados.join(", ")}`);
});

test("nenhuma chave Supabase escrita no código", () => {
  const achados = ondeCasa(/(sb_publishable_|sb_secret_|service_role.{0,20}eyJ|eyJhbGciOi)/);
  assert.deepEqual(achados, [], `possível chave no código: ${achados.join(", ")}`);
});

test("nenhuma variável obrigatória com valor de reserva", () => {
  const achados = ondeCasa(/process\.env\.(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|CRON_SECRET|RH_LINK_SECRET)\s*(\|\||\?\?)\s*["'`][^"'`]+["'`]/);
  assert.deepEqual(achados, [], `variável obrigatória com reserva: ${achados.join(", ")}`);
});

test("service role não é lida fora do módulo de servidor", () => {
  const achados = ondeCasa(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/)
    .filter((lugar) => !lugar.startsWith("app/lib/config-supabase-server.js"));
  assert.deepEqual(achados, [], `service role lida fora do módulo de servidor: ${achados.join(", ")}`);
});

test("o módulo privilegiado se recusa a rodar no navegador", () => {
  const fonte = fs.readFileSync(path.join(RAIZ, "app", "lib", "config-supabase-server.js"), "utf8");
  assert.match(fonte, /typeof window !== "undefined"/);
  /* e nenhum componente de client o importa */
  const importadores = arquivosDeCodigo(path.join(RAIZ, "app"))
    /* import de verdade, não menção em comentário */
    .filter((arq) => /from\s+["'][^"']*config-supabase-server["']/.test(fs.readFileSync(arq, "utf8")))
    .map(rel)
    .filter((lugar) => !FORA_DA_VARREDURA.includes(lugar) && lugar !== "app/lib/config-supabase-server.js");
  for (const lugar of importadores) {
    const primeira = fs.readFileSync(path.join(RAIZ, lugar), "utf8").split(/\r?\n/)[0];
    assert.doesNotMatch(primeira, /use client/, `${lugar} é client e importa configuração privilegiada`);
    assert.match(lugar, /^app\/api\//, `${lugar} não é route handler: revise antes de importar configuração privilegiada`);
  }
});
