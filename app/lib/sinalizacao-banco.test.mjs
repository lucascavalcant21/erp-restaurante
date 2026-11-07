// SINAL-1 aplicada num Postgres real em memória (PGlite), sobre `unidades` e um
// storage.buckets com as colunas do Supabase.
// Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/sinalizacao-banco.test.mjs
// Sem PGLITE os testes de banco são pulados (aparecem como "skipped", não como aprovados).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SQL = fs.readFileSync(path.join(raiz, "db", "SINAL_1_SINALIZACAO_DIGITAL.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";
const IMPRESSAO = "e1aa3b7cb7f2e3817dcab705b34c1787";
const TABELAS = ["sinal_telas", "sinal_midias", "sinal_playlists", "sinal_programacoes", "sinal_pareamentos"];

const BASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create table public.unidades (id text primary key, nome text not null);
  insert into public.unidades values ('seldeestrela', 'Sel de Estrela');
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, owner uuid, public boolean default false,
    avif_autodetection boolean default false, file_size_limit bigint, allowed_mime_types text[],
    created_at timestamptz default now(), updated_at timestamptz default now());
`;

async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(BASE);
  await pg.exec(SQL);
  return pg;
}

test("a migração só adiciona: sem drop, delete, update, truncate; policy e grants só nas tabelas novas", () => {
  const limpo = SQL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
  const cmd = limpo.replace(/\$\$[\s\S]*?\$\$/g, "$$$$");
  assert.doesNotMatch(cmd, /\bdrop\s+(table|column|schema|view|function|index|policy|trigger)\b/);
  assert.doesNotMatch(cmd, /\bdelete\s+from\b/);
  assert.doesNotMatch(cmd, /\bupdate\s+[\w.]+\s+set\b/);
  assert.doesNotMatch(cmd, /\btruncate\b/);
  const novas = TABELAS.map((t) => `public.${t}`);
  for (const m of cmd.matchAll(/\balter\s+table\s+([\w.]+)/g)) assert.ok(novas.includes(m[1]), m[0]);
  for (const m of cmd.matchAll(/\b(?:grant|revoke)\b[^;]*?\bon\s+([\w.]+)/g)) assert.ok(novas.includes(m[1]), m[0]);
  assert.doesNotMatch(cmd, /create\s+policy/, "nenhuma policy: só o servidor acessa");
  assert.doesNotMatch(cmd, /grant[^;]*\bto\s+(anon|authenticated)\b/, "anônimo e logado não recebem nada");
  for (const m of cmd.matchAll(/\binsert\s+into\s+([\w.]+)/g)) assert.equal(m[1], "storage.buckets", m[0]);
});

test("aplica: RLS ligado nas 5 tabelas, bucket privado, impressão digital e preflight que aborta na segunda vez", { skip: pular }, async () => {
  const pg = await banco();
  const rls = (await pg.query("select relname, relrowsecurity from pg_class where relname like 'sinal\\_%' and relkind = 'r' order by relname")).rows;
  assert.equal(rls.length, 5);
  for (const r of rls) assert.equal(r.relrowsecurity, true, r.relname);
  const b = (await pg.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'sinalizacao'")).rows[0];
  assert.equal(b.public, false);
  assert.equal(Number(b.file_size_limit), 52428800);
  assert.deepEqual(b.allowed_mime_types, ["image/jpeg", "image/png", "image/webp", "video/mp4"]);
  const resto = SQL.split("-- Verificação (só leitura)")[1];
  const h = (await pg.query(resto.slice(resto.indexOf("\n") + 1))).rows[0].impressao_digital;
  if (IMPRESSAO !== "PREENCHER") assert.equal(h, IMPRESSAO);
  else console.log("IMPRESSAO =", h);
  await assert.rejects(() => pg.exec(SQL), /já existem/);
});

test("anônimo e usuário logado não leem nem gravam nada; só o servidor", { skip: pular }, async () => {
  const pg = await banco();
  for (const papel of ["anon", "authenticated"]) {
    for (const t of TABELAS) {
      await pg.exec("begin");
      await pg.exec(`set local role ${papel}`);
      await assert.rejects(() => pg.query(`select * from public.${t}`), /permission denied/, `${papel} ${t}`);
      await pg.exec("rollback");
    }
  }
  await pg.exec("begin; set local role service_role;");
  await pg.query("insert into public.sinal_telas (unidade_id, nome) values ('seldeestrela', 'Parede 01')");
  assert.equal((await pg.query("select count(*)::int n from public.sinal_telas")).rows[0].n, 1);
  await pg.exec("rollback");
});

test("restrições: token em hash, código no alfabeto, horário em par, datas em ordem, mídia até 50 MB", { skip: pular }, async () => {
  const pg = await banco();
  const falha = (sql, args) => assert.rejects(() => pg.query(sql, args), /violates|check/i, sql);
  await falha("insert into public.sinal_telas (unidade_id, nome, token_hash) values ('seldeestrela', 'TV', 'segredo-em-claro')");
  await falha("insert into public.sinal_telas (unidade_id, nome, orientacao) values ('seldeestrela', 'TV', 'diagonal')");
  const h = "a".repeat(64);
  await falha("insert into public.sinal_pareamentos (codigo, segredo_hash, expira_em) values ('ABC0EF', $1, now())", [h]);
  await pg.query("insert into public.sinal_pareamentos (codigo, segredo_hash, expira_em) values ('ABC2EF', $1, now())", [h]);
  await assert.rejects(() => pg.query("insert into public.sinal_pareamentos (codigo, segredo_hash, expira_em) values ('ABC2EF', $1, now())", ["b".repeat(64)]), /duplicate/);
  await falha("insert into public.sinal_midias (unidade_id, nome, tipo, mime, caminho, tamanho_bytes) values ('seldeestrela', 'v', 'video', 'video/mp4', 'x/1.mp4', 60000000)");
  await falha("insert into public.sinal_midias (unidade_id, nome, tipo, mime, caminho, tamanho_bytes) values ('seldeestrela', 'v', 'video', 'video/webm', 'x/1.webm', 10)");
  const pl = (await pg.query("insert into public.sinal_playlists (unidade_id, nome) values ('seldeestrela', 'Almoço') returning id")).rows[0].id;
  await falha("insert into public.sinal_programacoes (unidade_id, nome, playlist_id, hora_inicio) values ('seldeestrela', 'r', $1, '11:00')", [pl]);
  await falha("insert into public.sinal_programacoes (unidade_id, nome, playlist_id, data_inicio, data_fim) values ('seldeestrela', 'r', $1, '2026-12-25', '2026-12-01')", [pl]);
  await falha("insert into public.sinal_programacoes (unidade_id, nome, playlist_id, dias_semana) values ('seldeestrela', 'r', $1, '{7}')", [pl]);
  await pg.query("insert into public.sinal_programacoes (unidade_id, nome, playlist_id, dias_semana, hora_inicio, hora_fim) values ('seldeestrela', 'Rodízio', $1, '{5}', '18:00', '02:00')", [pl]);
  // Apagar a playlist leva as regras dela junto (nunca regra apontando para o nada).
  await pg.query("delete from public.sinal_playlists where id = $1", [pl]);
  assert.equal((await pg.query("select count(*)::int n from public.sinal_programacoes")).rows[0].n, 0);
});
