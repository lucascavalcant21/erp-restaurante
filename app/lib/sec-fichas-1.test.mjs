// SEC-FICHAS-1 com o SQL real no PGlite: consultar não pode virar alterar.
//   PGLITE=… node --test app/lib/sec-fichas-1.test.mjs
// Sem PGLITE os testes de banco PULAM.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f) => fs.readFileSync(path.join(raiz, "db", "security", f), "utf8");
const MIGRACAO = ler("SEC_FICHAS_1_EDICAO_POR_PERMISSAO.sql");
const ROLLBACK = ler("SEC_FICHAS_1_ROLLBACK.sql");
const IMPRESSAO = "b300bf3a8f1a004da40d3eaf2f104a2a";
const pular = !process.env.PGLITE && "PGLITE não informado";

const TABELAS = ["montagem", "fichas_alergenicos", "fichas_armazenamento", "fichas_equipamentos", "fichas_etapas", "fichas_montagem_passos", "fichas_versoes"];
const U = {
  consulta: "00000000-0000-0000-0000-00000000000a",
  chefeBar: "00000000-0000-0000-0000-00000000000b",
  cozinheiro: "00000000-0000-0000-0000-00000000000c",
  outraUnidade: "00000000-0000-0000-0000-00000000000d",
};
const FICHA = "f0000000-0000-0000-0000-000000000001";

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  const base = "((select hefisto_ve_todas_unidades()) or unidade_id in (select unnest(hefisto_unidades_do_usuario())))";
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    create table acessos (usuario uuid, unidade text, chave text);
    create function public.hefisto_ve_todas_unidades() returns boolean language sql stable as $$ select false $$;
    create function public.hefisto_unidades_do_usuario() returns text[] language sql stable security definer as $$ select array_agg(distinct unidade) from acessos where usuario = auth.uid() $$;
    create function public.hefisto_user_can(p text, u text) returns boolean language sql stable security definer as $$
      select exists (select 1 from acessos a where a.usuario = auth.uid() and (u is null or a.unidade = u)
        and (a.chave = p or (a.chave like '%.*' and p like replace(a.chave, '*', '%')))) $$;
    create table fichas_tecnicas (id uuid primary key, unidade_id text, nome_receita text);
    create table fichas_ingredientes (id serial primary key, ficha_id uuid, quantidade numeric);
    ${TABELAS.map((t) => `create table ${t} (id serial primary key, unidade_id text, nome text);`).join("\n")}
    ${["fichas_tecnicas", ...TABELAS].map((t) => `alter table ${t} enable row level security; create policy sec_unidade on ${t} for all to authenticated using ${base} with check ${base};`).join("\n")}
    alter table fichas_ingredientes enable row level security;
    create policy sec_pai on fichas_ingredientes for all to authenticated
      using ((select hefisto_ve_todas_unidades()) or exists (select 1 from fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id))
      with check ((select hefisto_ve_todas_unidades()) or exists (select 1 from fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id));
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage on all sequences in schema public to authenticated;
    insert into fichas_tecnicas values ('${FICHA}', 'casa', 'Negroni');
    insert into fichas_ingredientes (ficha_id, quantidade) values ('${FICHA}', 30);
    insert into montagem (unidade_id, nome) values ('casa', 'Negroni');
    insert into acessos values
      ('${U.consulta}', 'casa', 'estoque.overview.view'),
      ('${U.chefeBar}', 'casa', 'bar.recipes.view'),
      ('${U.chefeBar}', 'casa', 'estoque.movements.create'),
      ('${U.cozinheiro}', 'casa', 'cozinha.recipes.*'),
      ('${U.outraUnidade}', 'outra', 'cozinha.recipes.*');
  `);
  return pg;
}

async function como(pg, usuario, sql) {
  await pg.exec(`begin; select set_config('app.uid', '${usuario}', true); set local role authenticated;`);
  try {
    const r = await pg.query(sql);
    await pg.exec("rollback");
    return r;
  } catch (e) {
    await pg.exec("rollback");
    throw e;
  }
}

test("arquivos são aditivos: sem policy aberta e sem apagar dados", () => {
  assert.ok(!/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(MIGRACAO + ROLLBACK));
  assert.ok(!/\b(delete from|truncate|drop table)\b/i.test(MIGRACAO));
  assert.ok(/raise exception/.test(MIGRACAO), "tem preflight");
});

test("quem só consulta lê, mas não altera nem apaga nem cria", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(MIGRACAO);
  for (const u of [U.consulta, U.chefeBar]) {
    assert.equal((await como(pg, u, "select * from fichas_tecnicas")).rows.length, 1);
    assert.equal((await como(pg, u, "select * from fichas_ingredientes")).rows.length, 1);
    assert.equal((await como(pg, u, "update fichas_tecnicas set nome_receita = 'x'")).affectedRows, 0);
    assert.equal((await como(pg, u, "update fichas_ingredientes set quantidade = 99")).affectedRows, 0);
    assert.equal((await como(pg, u, "delete from fichas_tecnicas")).affectedRows, 0);
    assert.equal((await como(pg, u, "delete from montagem")).affectedRows, 0);
    await assert.rejects(como(pg, u, "insert into fichas_tecnicas (id, unidade_id, nome_receita) values (gen_random_uuid(), 'casa', 'x')"), /row-level security/);
    await assert.rejects(como(pg, u, `insert into fichas_ingredientes (ficha_id, quantidade) values ('${FICHA}', 1)`), /row-level security/);
  }
});

test("quem tem permissão de ficha continua alterando", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(MIGRACAO);
  assert.equal((await como(pg, U.cozinheiro, "update fichas_tecnicas set nome_receita = 'x'")).affectedRows, 1);
  assert.equal((await como(pg, U.cozinheiro, "update fichas_ingredientes set quantidade = 99")).affectedRows, 1);
  assert.equal((await como(pg, U.cozinheiro, "delete from montagem")).affectedRows, 1);
});

test("permissão em outra unidade não vale aqui", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(MIGRACAO);
  assert.equal((await como(pg, U.outraUnidade, "select * from fichas_tecnicas")).rows.length, 0);
  assert.equal((await como(pg, U.outraUnidade, "update fichas_tecnicas set nome_receita = 'x'")).affectedRows, 0);
});

test("aplicar duas vezes aborta sem mudar nada", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(MIGRACAO);
  await assert.rejects(pg.exec(MIGRACAO), /já aplicada/);
  await pg.exec("rollback");
});

test("impressão digital bate com a documentada", { skip: pular }, async () => {
  const pg = await banco();
  const r = await pg.exec(MIGRACAO);
  assert.equal(r.at(-1).rows[0].impressao_digital, IMPRESSAO);
});

test("rollback devolve o estado anterior", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(MIGRACAO);
  await pg.exec(ROLLBACK);
  assert.equal((await como(pg, U.consulta, "update fichas_tecnicas set nome_receita = 'x'")).affectedRows, 1);
  assert.equal((await pg.query("select count(*)::int n from pg_policies where policyname in ('sec_ler','sec_inserir','sec_alterar','sec_apagar')")).rows[0].n, 0);
  assert.equal((await pg.query("select to_regclass('public.sec_backup_policies_sec_fichas_1') t")).rows[0].t, null);
});
