// CHAMADOS-1 aplicada num Postgres real em memória (PGlite), sobre unidades e
// mesas com as colunas do banco de produção (19/10/2026).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/chamados-banco.test.mjs
// Sem PGLITE os testes de banco são pulados (aparecem como "skipped", não como aprovados).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SQL = fs.readFileSync(path.join(raiz, "db", "CHAMADOS_1_MESA.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";
const IMPRESSAO = "479c60f3e90fae069d1b785189a8ce22";

// Funções de acesso por unidade (SEC-RLS-1), simuladas por configuração da sessão.
const BASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create function public.hefisto_ve_todas_unidades() returns boolean language sql stable as $$
    select coalesce(current_setting('teste.todas', true), '') = 'sim' $$;
  create function public.hefisto_unidades_do_usuario() returns text[] language sql stable as $$
    select string_to_array(nullif(current_setting('teste.unidades', true), ''), ',') $$;
  create table public.unidades (id text primary key, nome text not null);
  insert into public.unidades values ('seldeestrela', 'Sel de Estrela'), ('outra', 'Outra');
  create table public.mesas (id uuid primary key default gen_random_uuid(), unidade_id text, numero text, created_at timestamptz default now(),
    numero_mesa text, status text default 'livre');
  insert into public.mesas (unidade_id, numero, numero_mesa) values ('seldeestrela', 'Mesa 5', 'Mesa Antiga'), ('outra', 'Mesa 1', 'Mesa Antiga');
`;

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(BASE);
  await pg.exec(SQL);
  return pg;
}

const chamar = (pg, unidade, mesa, tipo = "garcom") =>
  pg.query("insert into public.experience_chamados (unidade_id, mesa_numero, tipo) values ($1, $2, $3) returning id", [unidade, mesa, tipo]);

async function como(pg, papel, { unidades = "", todas = "" } = {}, sql, args = []) {
  await pg.exec("begin");
  try {
    await pg.query("select set_config('teste.unidades', $1, true), set_config('teste.todas', $2, true)", [unidades, todas]);
    await pg.exec(`set local role ${papel}`);
    const r = await pg.query(sql, args);
    await pg.exec("commit");
    return r;
  } catch (e) {
    await pg.exec("rollback");
    throw e;
  }
}

test("a migração só adiciona: sem drop, delete, update, truncate; policy e grants só na tabela nova", () => {
  const limpo = SQL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
  const cmd = limpo.replace(/\$\$[\s\S]*?\$\$/g, "$$$$");
  assert.doesNotMatch(cmd, /\bdrop\s+(table|column|schema|view|function|index|policy|trigger)\b/);
  assert.doesNotMatch(cmd, /\bdelete\s+from\b/);
  assert.doesNotMatch(cmd, /\bupdate\s+(public\.)?\w+\s+set\b/);
  assert.doesNotMatch(cmd, /\btruncate\b/);
  for (const m of cmd.matchAll(/\balter\s+table\s+([\w.]+)/g)) assert.equal(m[1], "public.experience_chamados", m[0]);
  for (const m of cmd.matchAll(/\bcreate\s+policy\s+\w+\s+on\s+([\w.]+)/g)) assert.equal(m[1], "public.experience_chamados");
  for (const m of cmd.matchAll(/\b(?:grant|revoke)\b[^;]*?\bon\s+([\w.]+)/g)) assert.equal(m[1], "public.experience_chamados", m[0]);
  assert.doesNotMatch(cmd, /using\s*\(\s*true\s*\)|auth\.role\(\)\s*=/, "nada de policy aberta");
  assert.doesNotMatch(cmd, /grant[^;]*\bto\s+anon\b/, "anônimo não recebe nada");
});

test("aplica: RLS ligado, impressão digital e preflight que aborta na segunda vez", { skip: pular }, async () => {
  const pg = await banco();
  assert.equal((await pg.query("select relrowsecurity from pg_class where relname = 'experience_chamados'")).rows[0].relrowsecurity, true);
  const resto = SQL.split("-- Verificação (só leitura)")[1];
  const h = (await pg.query(resto.slice(resto.indexOf("\n") + 1))).rows[0].impressao_digital;
  if (IMPRESSAO !== "PREENCHER") assert.equal(h, IMPRESSAO);
  else console.log("IMPRESSAO =", h);
  await assert.rejects(() => pg.exec(SQL), /já existe/);
});

test("um chamado aberto por mesa e tipo; depois de concluído pode chamar de novo", { skip: pular }, async () => {
  const pg = await banco();
  await chamar(pg, "seldeestrela", "5", "garcom");
  await assert.rejects(() => chamar(pg, "seldeestrela", "5", "garcom"), (e) => e.code === "23505");
  await chamar(pg, "seldeestrela", "5", "conta"); // outro tipo, mesma mesa: vale
  await chamar(pg, "seldeestrela", "6", "garcom"); // outra mesa: vale
  await pg.query("update public.experience_chamados set status = 'em_atendimento' where mesa_numero = '5' and tipo = 'garcom'");
  await assert.rejects(() => chamar(pg, "seldeestrela", "5", "garcom"), (e) => e.code === "23505", "em atendimento ainda conta como aberto");
  await pg.query("update public.experience_chamados set status = 'concluido' where mesa_numero = '5' and tipo = 'garcom'");
  await chamar(pg, "seldeestrela", "5", "garcom");
  const n = (await pg.query("select count(*)::int as n from public.experience_chamados")).rows[0].n;
  assert.equal(n, 4);
});

test("limites: tipo, status, mesa e textos fora do formato são recusados; unidade precisa existir", { skip: pular }, async () => {
  const pg = await banco();
  await assert.rejects(() => chamar(pg, "seldeestrela", "5", "pizza"), (e) => e.code === "23514");
  await assert.rejects(() => chamar(pg, "seldeestrela", "12345678901"), (e) => e.code === "23514");
  await assert.rejects(() => chamar(pg, "seldeestrela", ""), (e) => e.code === "23514");
  await assert.rejects(() => chamar(pg, "nao-existe", "5"), (e) => e.code === "23503");
  await assert.rejects(() => pg.query("insert into public.experience_chamados (unidade_id, mesa_numero, solicitante_nome) values ('seldeestrela', '5', $1)", ["x".repeat(61)]), (e) => e.code === "23514");
  const { rows } = await chamar(pg, "seldeestrela", "7");
  await assert.rejects(() => pg.query("update public.experience_chamados set status = 'sumiu' where id = $1", [rows[0].id]), (e) => e.code === "23514");
});

test("RLS: equipe vê e atende só a própria unidade; anônimo e equipe não inserem direto", { skip: pular }, async () => {
  const pg = await banco();
  await chamar(pg, "seldeestrela", "5");
  await chamar(pg, "outra", "1");
  const minhas = await como(pg, "authenticated", { unidades: "seldeestrela" }, "select unidade_id from public.experience_chamados");
  assert.deepEqual(minhas.rows.map((r) => r.unidade_id), ["seldeestrela"]);
  const todas = await como(pg, "authenticated", { todas: "sim" }, "select count(*)::int as n from public.experience_chamados");
  assert.equal(todas.rows[0].n, 2);
  // Atender um chamado de outra unidade não muda nada.
  const r = await como(pg, "authenticated", { unidades: "seldeestrela" }, "update public.experience_chamados set status = 'concluido' where unidade_id = 'outra' returning id");
  assert.equal(r.rows.length, 0);
  const ok = await como(pg, "authenticated", { unidades: "seldeestrela" }, "update public.experience_chamados set status = 'em_atendimento' where unidade_id = 'seldeestrela' returning id");
  assert.equal(ok.rows.length, 1);
  await assert.rejects(() => como(pg, "authenticated", { unidades: "seldeestrela" }, "insert into public.experience_chamados (unidade_id, mesa_numero) values ('seldeestrela', '9')"), /permission denied/);
  await assert.rejects(() => como(pg, "anon", {}, "select * from public.experience_chamados"), /permission denied/);
  await assert.rejects(() => como(pg, "anon", {}, "insert into public.experience_chamados (unidade_id, mesa_numero) values ('seldeestrela', '9')"), /permission denied/);
});
