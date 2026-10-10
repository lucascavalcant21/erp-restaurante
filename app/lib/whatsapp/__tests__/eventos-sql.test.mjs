// HDEV-WA-COEX-001: migração da trilha (db/whatsapp/WA_002_EVENTOS.sql) no Postgres real (PGlite).
// Sem PGLITE os testes de banco PULAM:  PGLITE=… node --test app/lib/whatsapp/__tests__/eventos-sql.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classificarMigracao, rollbackIrmao } from "../../../../scripts/hefisto-agent/politica.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const dir = path.join(raiz, "db", "whatsapp");
const SQL = fs.readFileSync(path.join(dir, "WA_002_EVENTOS.sql"), "utf8");
const ROLLBACK = fs.readFileSync(path.join(dir, "WA_002_ROLLBACK.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;`);
  return pg;
}

test("política: a trilha é aditiva e tem rollback irmão", () => {
  assert.equal(rollbackIrmao("WA_002_EVENTOS.sql", fs.readdirSync(dir)), "WA_002_ROLLBACK.sql");
  assert.notEqual(classificarMigracao(SQL).classe, "CRITICAL");
  assert.equal(classificarMigracao(SQL).rlsInseguro, false);
});

test("aplica fechada para o navegador, idempotente por recibo, checks, não reaplica e rollback só da trilha", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec("create table public.outra (id int)");
  await pg.exec(SQL);
  const p = await pg.query(`select has_table_privilege('authenticated','public.whatsapp_eventos','select') a, has_table_privilege('anon','public.whatsapp_eventos','insert') b`);
  assert.deepEqual(p.rows[0], { a: false, b: false });
  const ins = (v) => pg.exec(`insert into public.whatsapp_eventos (provedor, direcao, wamid, status, resultado, numero) values ${v}`);
  await ins(`('meta','status','wamid.1','sent',null,'5545998574041')`);
  await ins(`('meta','status','wamid.1','delivered',null,'5545998574041')`);
  await assert.rejects(ins(`('meta','status','wamid.1','delivered',null,'5545998574041')`), /duplicate|unique/i, "mesmo recibo duas vezes");
  await ins(`('meta','entrada','wamid.2',null,'comando','5545998574041'), ('meta','entrada','wamid.2',null,'erro','5545998574041')`);
  await assert.rejects(ins(`('outro','saida',null,null,null,null)`), /check/i);
  await assert.rejects(ins(`('meta','saida',null,null,null,'+55 45')`), /check/i, "número só dígitos");
  await assert.rejects(pg.exec(SQL), /já aplicada/);
  await pg.exec("rollback"); // o preflight aborta dentro do begin; a conexão desfaz a transação
  await pg.exec(ROLLBACK);
  const r = await pg.query(`select to_regclass('public.whatsapp_eventos') a, to_regclass('public.outra')::text b`);
  assert.deepEqual(r.rows[0], { a: null, b: "outra" });
});
