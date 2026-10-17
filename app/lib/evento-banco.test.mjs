// EVENTOS-ORC-1 aplicada num Postgres real em memória (PGlite), sobre a tabela
// eventos com as colunas que o banco de produção tinha em 17/10/2026.
// Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/evento-banco.test.mjs
// Sem PGLITE os testes são pulados (aparecem como "skipped", não como aprovados).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { camposDoEventoParaGravar, orcamentoDoEvento, resumoDoOrcamento } from "./evento-orcamento.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SQL = fs.readFileSync(path.join(raiz, "db", "EVENTOS_ORC_1_COLUNAS_DO_ORCAMENTO.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";
const IMPRESSAO = "3ae8f62e5382a8a442f21fa488369feb";

// Colunas de public.eventos no banco real (information_schema, 17/10/2026).
const EVENTOS_PRODUCAO = `
  create table public.eventos (
    id uuid primary key default gen_random_uuid(), nome text not null, subtitulo text, tag text, data_evento date not null,
    banner_url text, charge_mode text not null default 'couple', capacidade integer not null default 12,
    preco_unit numeric not null default 0, entradas_inc integer not null default 1, principais_inc integer not null default 2,
    sobremesas_inc integer not null default 1, drinks_inc integer not null default 2, impostos_rate numeric not null default 0.08,
    credito_rate numeric not null default 0.0299, debito_rate numeric not null default 0.0149, credito_mix numeric not null default 0.7,
    meta_lucro numeric not null default 0, margem_seg numeric not null default 10, status text not null default 'ativo',
    unidade_id text, created_at timestamptz default now(), updated_at timestamptz default now(),
    tipo_evento text default 'especial', funil_status text default 'NOVO CONTATO', cliente_nome text, cliente_telefone text,
    valor_contratado numeric default 0, valor_pago numeric default 0, local_evento text, responsavel_id uuid,
    taxa_imposto_pct numeric default 0, taxa_maquininha_pct numeric default 0, custo_aluguel_espaco numeric default 0,
    margem_lucro_desejada numeric default 20, desconto_concedido numeric default 0, total_custo_insumos numeric default 0,
    total_custo_equipe numeric default 0
  );
  insert into public.eventos (id, nome, data_evento, unidade_id, tipo_evento, cliente_nome, valor_contratado)
    values ('00000000-0000-4000-8000-000000000001', 'Aniversário', '2026-11-07', 'seldeestrela', 'buffet', 'Cliente', 0);
`;

async function banco(extra = "") {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(`create role anon nologin; create role authenticated nologin; ${EVENTOS_PRODUCAO} ${extra}`);
  return pg;
}

const colunas = async (pg, tabela = "eventos") =>
  (await pg.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by 1`, [tabela])).rows.map((r) => r.column_name);

test("a migração só adiciona: sem drop, delete, update nem mudança de policy/grant na tabela eventos", () => {
  const cmd = SQL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
  assert.doesNotMatch(cmd, /\bdrop\s+(table|column|schema|view|function|index|policy|trigger)\b/);
  assert.doesNotMatch(cmd, /\bdelete\s+from\b/);
  assert.doesNotMatch(cmd, /\bupdate\s+(public\.)?\w+\s+set\b/);
  assert.doesNotMatch(cmd, /\btruncate\b/);
  assert.doesNotMatch(cmd, /\b(create|alter)\s+policy\b/);
  for (const m of cmd.matchAll(/\b(?:grant|revoke)\b[^;]*?\bon\s+([\w.]+)/g)) assert.equal(m[1], "public.backup_eventos_eventos_orc_1_20261017", m[0]);
});

test("aplica numa transação, cria as cinco colunas e não mexe na linha existente", { skip: pular }, async () => {
  const pg = await banco();
  const antes = (await pg.query("select * from public.eventos")).rows[0];
  await pg.exec(SQL);
  const depois = (await pg.query("select * from public.eventos")).rows[0];
  for (const c of Object.keys(antes)) assert.deepEqual(depois[c], antes[c], c);
  assert.deepEqual(depois.operacao_detalhes, {});
  assert.deepEqual(depois.historico_pagamentos, []);
  assert.equal(depois.hora_inicio, null);
  const cols = await colunas(pg);
  for (const c of ["operacao_detalhes", "historico_pagamentos", "hora_inicio", "hora_fim", "observacoes"]) assert.ok(cols.includes(c), c);
  // backup com a linha de antes, fora da API
  assert.equal((await pg.query("select count(*)::int n from public.backup_eventos_eventos_orc_1_20261017")).rows[0].n, 1);
  assert.equal((await pg.query("select relrowsecurity from pg_class where relname = 'backup_eventos_eventos_orc_1_20261017'")).rows[0].relrowsecurity, true);
});

test("impressão digital das colunas novas", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(SQL);
  const r = await pg.query(`select md5(string_agg(column_name || ':' || data_type || ':' || coalesce(column_default, ''), '|' order by column_name)) as h
    from information_schema.columns where table_schema = 'public' and table_name = 'eventos'
    and column_name in ('operacao_detalhes', 'historico_pagamentos', 'hora_inicio', 'hora_fim', 'observacoes')`);
  assert.equal(r.rows[0].h, IMPRESSAO);
});

test("é reexecutável (rodar duas vezes não falha nem duplica o backup)", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(SQL);
  await pg.exec(SQL);
  assert.equal((await pg.query("select count(*)::int n from public.backup_eventos_eventos_orc_1_20261017")).rows[0].n, 1);
});

test("preflight aborta sem mudar nada se uma coluna já existe com outro tipo", { skip: pular }, async () => {
  const pg = await banco("alter table public.eventos add column hora_inicio time;");
  await assert.rejects(() => pg.exec(SQL), /eventos\.hora_inicio já existe como time/);
  await pg.exec("rollback").catch(() => {});
  const cols = await colunas(pg);
  assert.ok(!cols.includes("operacao_detalhes"));
  assert.ok(!(await colunas(pg, "backup_eventos_eventos_orc_1_20261017")).length);
});

test("depois da migração, a gravação do orçamento (todas as colunas que o app manda) passa", { skip: pular }, async () => {
  const pg = await banco();
  await pg.exec(SQL);
  const evento = (await pg.query("select * from public.eventos")).rows[0];
  const orc = orcamentoDoEvento({ ...evento, data_evento: "2026-11-07" }, {}, []);
  orc.cliente.hora_inicio = "19:30";
  orc.cliente.convidados = 80;
  const campos = camposDoEventoParaGravar(orc, resumoDoOrcamento(orc, []), evento.operacao_detalhes);
  const nomes = Object.keys(campos);
  const sets = nomes.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const valores = nomes.map((c) => (campos[c] !== null && typeof campos[c] === "object" ? JSON.stringify(campos[c]) : campos[c]));
  await pg.query(`update public.eventos set ${sets} where id = '${evento.id}'`, valores);
  const salvo = (await pg.query("select operacao_detalhes, hora_inicio, capacidade from public.eventos")).rows[0];
  assert.equal(salvo.hora_inicio, "19:30");
  assert.equal(salvo.capacidade, 80);
  assert.ok(salvo.operacao_detalhes.orcamento, "orçamento gravado");
  // pagamentos
  await pg.query(`update public.eventos set historico_pagamentos = $1`, [JSON.stringify([{ data: "2026-10-17", valor: 500 }])]);
  assert.equal((await pg.query("select historico_pagamentos from public.eventos")).rows[0].historico_pagamentos[0].valor, 500);
});
