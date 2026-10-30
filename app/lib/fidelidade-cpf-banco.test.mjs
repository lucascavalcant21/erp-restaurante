// FIDELIDADE-3 (CPF) por cima da FIDELIDADE-1 e 2, num Postgres em memória (PGlite).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/fidelidade-cpf-banco.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (n) => fs.readFileSync(path.join(raiz, "db", n), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";
const U = "seldeestrela";
const CPF = "529.982.247-25"; // CPF de teste válido (dígitos verificadores certos)

const BASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create function public.hefisto_user_can(p_permission text, p_unidade_id text) returns boolean language sql stable as $$ select false $$;
  create table public.config_sistema (id uuid primary key default gen_random_uuid(), unidade_id text, params jsonb, created_at timestamptz default now());
  create table public.unidades (id text primary key, nome text not null);
  insert into public.unidades values ('seldeestrela', 'Sel de Estrela');
  create table public.clientes (id uuid primary key default gen_random_uuid(), nome text not null, tel text, total_gasto numeric default 0,
    total_pedidos integer default 0, ultima_compra date, unidade_id text, created_at timestamptz default now());
  create table public.pedidos (id uuid primary key default gen_random_uuid(), unidade_id text, mesa_id uuid, status text, valor_total numeric,
    created_at timestamptz default now(), updated_at timestamptz default now(), tipo_pedido text, cliente_nome text, cliente_telefone text,
    endereco_entrega text, troco_para text, forma_pagamento text, garcom_id uuid, identificacao text);
  create table public.pedidos_itens (id uuid primary key default gen_random_uuid(), pedido_id uuid, produto_id uuid, quantidade integer,
    valor_unitario numeric, observacao text, status_kds text, created_at timestamptz default now(), updated_at timestamptz default now());
`;
async function banco() {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(BASE);
  await pg.query("insert into public.config_sistema (unidade_id, params) values ($1, $2)", [U, { fidelidade: { ativo: true, cadastro: { ativo: true, desconto_pct: 10, aplica: "sempre" } } }]);
  for (const n of ["FIDELIDADE_1_SELOS_E_CASHBACK.sql", "FIDELIDADE_2_PREMIOS_E_CANAIS.sql", "FIDELIDADE_3_CPF.sql"]) await pg.exec(ler(n));
  return pg;
}
const cadastrar = (pg, { cpf = CPF, tel = "(91) 98888-7777", nome = "Manuela Souza" } = {}) =>
  pg.query("select public.fidelidade_cadastrar_cpf($1, $2, $3, $4, '1990-05-10', 'pa', 'Belém', 'Umarizal', true) as r", [U, nome, cpf, tel]).then((x) => x.rows[0].r);
const doCpf = (pg, cpf = CPF) => pg.query("select public.fidelidade_cliente_do_cpf($1, $2) as r", [U, cpf]).then((x) => x.rows[0].r);

test("a migração só adiciona: sem drop, delete, truncate, update fora da função", () => {
  const sql = ler("FIDELIDADE_3_CPF.sql");
  const limpo = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
  const cmd = limpo.replace(/\$\$[\s\S]*?\$\$/g, "$$$$");
  assert.doesNotMatch(cmd, /\bdrop\s+(table|column|function|index|policy|trigger)\b|\bdelete\s+from\b|\btruncate\b|\bupdate\s+(public\.)?\w+\s+set\b/);
  for (const m of cmd.matchAll(/\balter\s+table\s+([\w.]+)\s+(\w+\s+\w+)/g)) assert.equal(m[2], "add column", m[0]);
});

test("cadastro e entrada pelo CPF; CPF inválido recusado; nada para anon", { skip: pular }, async () => {
  const pg = await banco();
  assert.deepEqual(await doCpf(pg), { ok: false, motivo: "nao_cadastrado" });
  assert.deepEqual(await cadastrar(pg), { ok: true, novo: true });
  const r = await doCpf(pg, "52998224725");
  assert.deepEqual([r.ok, r.nome, r.tel], [true, "Manuela Souza", "91988887777"]);
  const linha = (await pg.query("select cpf, uf, cidade, bairro, origem, aceite_lgpd_em is not null as lgpd from public.clientes")).rows[0];
  assert.deepEqual(linha, { cpf: "52998224725", uf: "PA", cidade: "Belém", bairro: "Umarizal", origem: "tablet", lgpd: true });
  assert.deepEqual(await cadastrar(pg, { nome: "Outra Pessoa", tel: "(91) 90000-0000" }), { ok: true, novo: false }, "CPF já cadastrado não troca nada");
  assert.equal((await doCpf(pg)).nome, "Manuela Souza");
  await assert.rejects(() => cadastrar(pg, { cpf: "111.111.111-11" }), /CPF inválido/);
  await assert.rejects(() => cadastrar(pg, { cpf: "529.982.247-24" }), /CPF inválido/);
  // O desconto do cadastro passa a valer para o telefone da ficha.
  assert.equal(Number((await pg.query("select public.fidelidade_desconto_cadastro($1, '91988887777') as d", [U])).rows[0].d), 10);
  await pg.exec("set role anon");
  await assert.rejects(() => doCpf(pg), /permission denied/);
});

test("ficha antiga do mesmo WhatsApp ganha o CPF em vez de duplicar", { skip: pular }, async () => {
  const pg = await banco();
  await pg.query("insert into public.clientes (nome, tel, unidade_id) values ('Manu', '91988887777', $1)", [U]);
  assert.deepEqual(await cadastrar(pg), { ok: true, novo: false });
  const fichas = (await pg.query("select nome, cpf from public.clientes")).rows;
  assert.deepEqual(fichas, [{ nome: "Manu", cpf: "52998224725" }]);
});
