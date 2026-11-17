// SQL REAL da migração RASCUNHO-1 num Postgres em memória (PGlite).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node app/lib/rascunho-banco.test.mjs
// Sem PGLITE os testes NÃO rodam (o processo sai com código 2).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};
if (!process.env.PGLITE) { console.log("PGLITE não informado: testes do RASCUNHO-1 NÃO executados."); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
`);
const sql = fs.readFileSync(path.join(raiz, "db", "RASCUNHO_1_RASCUNHOS_USUARIO.sql"), "utf8");
const res = await pg.exec(sql);
console.log(`     impressão digital: ${res.find((r) => r.rows?.[0]?.impressao_digital)?.rows?.[0]?.impressao_digital}`);

async function como(uid, papel, consulta) {
  await pg.exec("begin");
  try {
    await pg.exec(`set local role ${papel}; select set_config('request.jwt.claim.sub', '${uid || ""}', true);`);
    const r = await consulta();
    await pg.exec("commit");
    return r;
  } catch (e) { await pg.exec("rollback"); return { erro: e.message }; }
}

await como(A, "authenticated", () => pg.query(`insert into rascunhos_usuario (chave, unidade_id, dados) values ('ficha-marmita:marmitaria', 'marmitaria', '{"form":{"nome":"Parmegiana"}}')`));
await como(A, "authenticated", () => pg.query(`insert into rascunhos_usuario (chave, dados) values ('ficha-marmita:marmitaria', '{"form":{"nome":"Parmegiana 2"}}') on conflict (auth_user_id, chave) do update set dados = excluded.dados, atualizado_em = now()`));
conferir("dono lê o próprio rascunho (upsert troca)", (await como(A, "authenticated", () => pg.query("select dados->'form'->>'nome' n from rascunhos_usuario"))).rows.map((r) => r.n), ["Parmegiana 2"]);
conferir("outro usuário não vê", (await como(B, "authenticated", () => pg.query("select count(*)::int n from rascunhos_usuario"))).rows[0].n, 0);
conferir("outro usuário não grava em nome do dono", !!(await como(B, "authenticated", () => pg.query(`insert into rascunhos_usuario (auth_user_id, chave, dados) values ('${A}', 'x', '{}')`))).erro, true);
conferir("outro usuário não apaga o do dono", (await como(B, "authenticated", () => pg.query("delete from rascunhos_usuario"))).affectedRows ?? 0, 0);
conferir("anon não acessa", !!(await como(null, "anon", () => pg.query("select * from rascunhos_usuario"))).erro, true);
await como(A, "authenticated", () => pg.query("delete from rascunhos_usuario where chave = 'ficha-marmita:marmitaria'"));
conferir("dono apaga o próprio ao salvar", (await pg.query("select count(*)::int n from rascunhos_usuario")).rows[0].n, 0);
let abortou = false; try { await pg.exec(sql); } catch (e) { abortou = /já existe/.test(e.message); }
conferir("preflight aborta se reaplicada", abortou, true);
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nRASCUNHO-1: tudo certo");
process.exit(falhas ? 1 : 0);
