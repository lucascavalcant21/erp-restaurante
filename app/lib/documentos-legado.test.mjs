// DOC-LEGADO-1 (arquivar os 28 boletos antigos sem unidade) num Postgres em
// memória (PGlite). Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/documentos-legado.test.mjs
// Sem PGLITE os testes são pulados (aparecem como "skipped", não como aprovados).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SQL = fs.readFileSync(path.join(raiz, "db", "DOC_LEGADO_1_ARQUIVAR_DOCUMENTOS.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";

// 28 linhas sem unidade somando 7964.69 (27 × 284.45 + 284.54) e 2 com unidade.
async function banco({ semUnidade = 28 } = {}) {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  const linhas = Array.from({ length: semUnidade }, (_, i) =>
    `(gen_random_uuid(), 'despesa', 'Boleto ${i}', 'pendente', ${i === semUnidade - 1 ? 284.54 : 284.45}, '2020-10-19'::date + ${i * 60}, 'pendente', null)`).join(",");
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create table public.unidades (id text primary key);
    insert into public.unidades values ('seldeestrela');
    create table public.documentos (id uuid primary key default gen_random_uuid(), tipo text, descricao text, categoria text,
      valor numeric, emissao date, vencimento date, status text, unidade_id text references public.unidades(id) on delete cascade,
      created_at timestamptz default now());
    insert into public.documentos (id, tipo, descricao, categoria, valor, vencimento, status, unidade_id) values ${linhas};
    insert into public.documentos (tipo, descricao, valor, vencimento, status, unidade_id) values
      ('despesa', 'Da unidade', 50, '2026-10-01', 'pendente', 'seldeestrela'), ('despesa', 'Paga', 10, '2026-09-01', 'pago', null);
  `);
  return pg;
}

test("o script não apaga nada nem mexe em policy", () => {
  const cmd = SQL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
  assert.doesNotMatch(cmd, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+(table|column|policy)\b|\b(create|alter)\s+policy\b/);
  for (const m of cmd.matchAll(/\bupdate\s+(public\.)?(\w+)\s+set\b/g)) assert.equal(m[2], "documentos");
});

test("arquiva só as 28 pendentes sem unidade, com backup fora da API", { skip: pular }, async () => {
  const pg = await banco();
  const antes = (await pg.query("select id, valor, vencimento, descricao from public.documentos order by id")).rows;
  await pg.exec(SQL);
  const r = (await pg.query(`select
    count(*) filter (where unidade_id is null and status = 'arquivado')::int as arquivadas,
    count(*) filter (where unidade_id is null and status = 'pendente')::int as pendentes,
    count(*) filter (where unidade_id = 'seldeestrela' and status = 'pendente')::int as da_unidade,
    count(*) filter (where status = 'pago')::int as pagas from public.documentos`)).rows[0];
  assert.deepEqual(r, { arquivadas: 28, pendentes: 0, da_unidade: 1, pagas: 1 });
  const depois = (await pg.query("select id, valor, vencimento, descricao from public.documentos order by id")).rows;
  assert.deepEqual(depois, antes, "nenhum valor, data ou descrição mudou");
  assert.equal((await pg.query("select count(*)::int n from public.backup_documentos_doc_legado_1_20261017 where status = 'pendente'")).rows[0].n, 29);
  assert.equal((await pg.query("select relrowsecurity from pg_class where relname = 'backup_documentos_doc_legado_1_20261017'")).rows[0].relrowsecurity, true);
});

test("preflight aborta sem mudar nada se o número de linhas não bate", { skip: pular }, async () => {
  const pg = await banco({ semUnidade: 27 });
  await assert.rejects(() => pg.exec(SQL), /esperava 28 linhas/);
  await pg.exec("rollback").catch(() => {});
  assert.equal((await pg.query("select count(*)::int n from public.documentos where status = 'arquivado'")).rows[0].n, 0);
  assert.equal((await pg.query("select to_regclass('public.backup_documentos_doc_legado_1_20261017') is null as sem")).rows[0].sem, true);
});

test("rodar de novo não faz nada (preflight barra: já não há pendentes)", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(SQL);
  await assert.rejects(() => pg.exec(SQL), /achei 0/);
});

test("o rollback documentado devolve o status", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(SQL);
  const rollback = /ROLLBACK[^\n]*\n([\s\S]*?);\n/.exec(SQL)[1];
  await pg.exec(rollback);
  assert.equal((await pg.query("select count(*)::int n from public.documentos where unidade_id is null and status = 'pendente'")).rows[0].n, 28);
});
