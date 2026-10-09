// HDEV-WA-001: a migração da fila (db/whatsapp/WA_001_FILA.sql) no Postgres de verdade (PGlite).
// Sem PGLITE os testes de banco PULAM:  PGLITE=… node --test app/lib/whatsapp/__tests__/fila-sql.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classificarMigracao, rollbackIrmao } from "../../../../scripts/hefisto-agent/politica.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const dir = path.join(raiz, "db", "whatsapp");
const FILA = fs.readFileSync(path.join(dir, "WA_001_FILA.sql"), "utf8");
const ROLLBACK = fs.readFileSync(path.join(dir, "WA_001_ROLLBACK.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
  `);
  return pg;
}

test("política: a fila é aditiva (não insegura) e tem rollback irmão", () => {
  assert.equal(rollbackIrmao("WA_001_FILA.sql", fs.readdirSync(dir)), "WA_001_ROLLBACK.sql");
  const m = classificarMigracao(FILA);
  assert.notEqual(m.classe, "CRITICAL");
  assert.equal(m.rlsInseguro, false);
});

test("aplica, fecha para o navegador e não reaplica", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(FILA);
  const r = await pg.query(`select has_table_privilege('authenticated', 'public.whatsapp_comandos', 'select') a,
    has_table_privilege('anon', 'public.whatsapp_ponte', 'select') b,
    has_function_privilege('authenticated', 'public.whatsapp_pegar_comandos(int)', 'execute') c,
    has_function_privilege('service_role', 'public.whatsapp_pegar_comandos(int)', 'execute') d`);
  assert.deepEqual(r.rows[0], { a: false, b: false, c: false, d: true });
  await assert.rejects(pg.exec(FILA), /já aplicada/);
});

test("fila: pega em ordem, não entrega duas vezes, reentrega o que travou e respeita os checks", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(FILA);
  await pg.exec(`insert into public.whatsapp_comandos (mensagem_id, numero, comando, criado_em) values
    ('m1', '5511987650000', 'status', now() - interval '3 minutes'),
    ('m2', '5511987650000', 'parar', now() - interval '2 minutes'),
    ('m3', '5511987650000', 'missoes', now() - interval '1 minute')`);
  const a = await pg.query("select mensagem_id from public.whatsapp_pegar_comandos(2)");
  assert.deepEqual(a.rows.map((x) => x.mensagem_id), ["m1", "m2"]);
  const b = await pg.query("select mensagem_id from public.whatsapp_pegar_comandos(5)");
  assert.deepEqual(b.rows.map((x) => x.mensagem_id), ["m3"], "o que já foi pego não volta");
  await pg.exec("update public.whatsapp_comandos set pego_em = now() - interval '11 minutes' where mensagem_id = 'm1'");
  const c = await pg.query("select mensagem_id from public.whatsapp_pegar_comandos(5)");
  assert.deepEqual(c.rows.map((x) => x.mensagem_id), ["m1"], "preso há mais de 10 min é reentregue");
  await assert.rejects(pg.exec("insert into public.whatsapp_comandos (mensagem_id, numero, comando) values ('m1', '5511987650000', 'status')"), /duplicate|unique/i);
  await assert.rejects(pg.exec("insert into public.whatsapp_comandos (mensagem_id, numero, comando) values ('m9', '5511987650000', 'drop_database')"), /check/i);
  await assert.rejects(pg.exec("insert into public.whatsapp_comandos (mensagem_id, numero, comando) values ('m8', '+55 11', 'status')"), /check/i);
  await assert.rejects(pg.exec("insert into public.whatsapp_ponte (id) values (2)"), /check/i);
});

test("rollback remove só a fila", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec("create table public.outra (id int)");
  await pg.exec(FILA);
  await pg.exec(ROLLBACK);
  const r = await pg.query(`select to_regclass('public.whatsapp_comandos') a, to_regclass('public.whatsapp_ponte') b, to_regclass('public.outra')::text c`);
  assert.deepEqual(r.rows[0], { a: null, b: null, c: "outra" });
});
