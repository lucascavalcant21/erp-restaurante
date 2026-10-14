// SQL real da IFOOD-1 no PGlite: aplica (duas vezes) e confere que só o
// servidor acessa as tabelas de integração.
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/server/ifood-conexao-banco.test.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
if (!process.env.PGLITE) { console.log("PGLITE não informado: teste NÃO executado."); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
let falhas = 0;
const conferir = (nome, ok) => { if (!ok) falhas++; console.log(`${ok ? "ok  " : "FALHA"} ${nome}`); };

await pg.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  create table public.unidades (id text primary key); insert into public.unidades values ('u1');
  alter default privileges in schema public grant all on tables to anon, authenticated;`);
const sql = fs.readFileSync(path.join(raiz, "db", "integracoes", "IFOOD_1_CONEXAO.sql"), "utf8");
await pg.exec(sql); await pg.exec(sql);
conferir("aplica duas vezes sem erro", true);

for (const papel of ["authenticated", "anon"]) {
  for (const t of ["integration_connections", "integration_secrets", "integration_events"]) {
    let negado = false;
    try { await pg.exec(`set role ${papel}; select * from public.${t};`); } catch (e) { negado = /permission denied/.test(e.message); }
    await pg.exec("reset role");
    conferir(`${papel} não lê ${t}`, negado);
  }
}
await pg.exec(`set role service_role; insert into public.integration_secrets (unidade_id, provider, credentials_payload) values ('u1','IFOOD','{"isEncrypted":true}'); reset role;`);
const n = (await pg.query("select count(*)::int n from public.integration_secrets")).rows[0].n;
conferir("servidor (service_role) grava", n === 1);
let dup = false;
try { await pg.exec(`insert into public.integration_secrets (unidade_id, provider) values ('u1','IFOOD')`); } catch (e) { dup = /duplicate key/.test(e.message); }
conferir("uma credencial por unidade e provedor", dup);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
