// FIDELIDADE-2 (código de prêmio e canais) aplicada por cima da FIDELIDADE-1 num Postgres em memória (PGlite).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/fidelidade-premios-banco.test.mjs
// Sem PGLITE os testes de banco são pulados (aparecem como "skipped").
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SQL1 = fs.readFileSync(path.join(raiz, "db", "FIDELIDADE_1_SELOS_E_CASHBACK.sql"), "utf8");
const SQL2 = fs.readFileSync(path.join(raiz, "db", "FIDELIDADE_2_PREMIOS_E_CANAIS.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";

const U = "seldeestrela";
const TACACA = "11111111-1111-4111-8111-111111111111";
const TEL = "91988887777";
const CFG = {
  ativo: true,
  cartoes: [{ id: "tacaca", nome: "Cartão Tacacá", produto_ids: [TACACA], selos: 3, recompensa: "1 Tacacá", por: "unidade", ativo: true }],
  cashback: { ativo: true, percentual: 2, minimo_pedido: 0, validade_dias: 0, uso_maximo_pct: 50 },
};
const BASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  create function public.hefisto_user_can(p_permission text, p_unidade_id text) returns boolean language sql stable as $$
    select coalesce(current_setting('teste.pode', true), '') = '*'
        or position((p_permission || '@' || p_unidade_id) in coalesce(current_setting('teste.pode', true), '')) > 0 $$;
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

async function banco(cfg = CFG) {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(BASE);
  await pg.query("insert into public.config_sistema (unidade_id, params) values ($1, $2)", [U, { fidelidade: cfg }]);
  await pg.query("insert into public.clientes (nome, tel, unidade_id) values ('Manuela', '(91) 98888-7777', $1)", [U]);
  await pg.exec(SQL1);
  await pg.exec(SQL2);
  return pg;
}
async function pedidoPago(pg, { tipo = "delivery", qtd = 3 } = {}) {
  const { rows } = await pg.query("insert into public.pedidos (unidade_id, status, tipo_pedido, cliente_telefone, valor_total) values ($1, 'novo', $2, $3, 0) returning id", [U, tipo, TEL]);
  await pg.query("insert into public.pedidos_itens (pedido_id, produto_id, quantidade, valor_unitario) values ($1, $2, $3, 30)", [rows[0].id, TACACA, qtd]);
  await pg.query("update public.pedidos set status = 'pago' where id = $1", [rows[0].id]);
  return rows[0].id;
}
const selos = async (pg) => (await pg.query("select public._fidelidade_saldo_cartao($1, $2, 'tacaca', 0) as s", [U, TEL])).rows[0].s;
const comoEquipe = async (pg, pode, sql, args = []) => {
  await pg.exec("begin");
  try {
    await pg.query("select set_config('teste.pode', $1, true), set_config('teste.uid', '00000000-0000-4000-8000-0000000000aa', true)", [pode]);
    await pg.exec("set local role authenticated");
    const r = await pg.query(sql, args);
    await pg.exec("commit");
    return r;
  } catch (e) {
    await pg.exec("rollback");
    throw e;
  }
};

test("a migração só adiciona: sem drop, delete, truncate; escrita só nas funções novas", () => {
  const limpo = SQL2.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
  const cmd = limpo.replace(/\$\$[\s\S]*?\$\$/g, "$$$$");
  assert.doesNotMatch(cmd, /\bdrop\s+(table|column|schema|view|function|index|policy|trigger)\b/);
  assert.doesNotMatch(cmd, /\bdelete\s+from\b|\btruncate\b|\bupdate\s+(public\.)?\w+\s+set\b/);
  const corpos = [...limpo.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]).join("\n");
  assert.deepEqual([...corpos.matchAll(/\bupdate\s+([\w.]+)/g)].map((m) => m[1]), ["public.fidelidade_premios"]);
  assert.doesNotMatch(cmd, /using\s*\(\s*true\s*\)/, "nada de policy aberta");
});

test("cartão completo: o código aparece, a equipe confere e dá baixa uma vez só", { skip: pular }, async () => {
  const pg = await banco();
  const g0 = (await pg.query("select public.fidelidade_gerar_premio($1, $2, 'tacaca') as r", [U, TEL])).rows[0].r;
  assert.deepEqual([g0.ok, g0.motivo, g0.faltam], [false, "faltam", 3]);
  await pedidoPago(pg); // 3 tacacás = cartão completo
  assert.equal(await selos(pg), 3);
  const g1 = (await pg.query("select public.fidelidade_gerar_premio($1, $2, 'tacaca') as r", [U, TEL])).rows[0].r;
  assert.equal(g1.ok, true);
  assert.match(g1.codigo, /^[A-Z2-9]{6}$/);
  const g2 = (await pg.query("select public.fidelidade_gerar_premio($1, $2, 'tacaca') as r", [U, TEL])).rows[0].r;
  assert.equal(g2.codigo, g1.codigo, "abrir de novo mostra o mesmo código");
  await assert.rejects(() => comoEquipe(pg, "", "select public.fidelidade_validar_premio($1, $2)", [U, g1.codigo]), /Sem permissão/);
  const pode = `clientes.loyalty.confirm@${U}`;
  const v = (await comoEquipe(pg, pode, "select public.fidelidade_validar_premio($1, $2) as r", [U, g1.codigo.toLowerCase()])).rows[0].r;
  assert.deepEqual([v.ok, v.pode, v.cliente, v.final, v.recompensa], [true, true, "Manuela", "7777", "1 Tacacá"]);
  const c = (await comoEquipe(pg, pode, "select public.fidelidade_confirmar_premio($1, $2) as r", [U, g1.codigo])).rows[0].r;
  assert.equal(c.ok, true);
  assert.equal(await selos(pg), 0, "os selos saem na retirada");
  await assert.rejects(() => comoEquipe(pg, pode, "select public.fidelidade_confirmar_premio($1, $2)", [U, g1.codigo]), /já foi retirado/);
  const nao = (await comoEquipe(pg, pode, "select public.fidelidade_validar_premio($1, 'ZZZZZZ') as r", [U])).rows[0].r;
  assert.equal(nao.motivo, "nao_existe");
  const mov = (await pg.query("select tipo, selos, observacao, criado_por from public.fidelidade_movimentos where tipo = 'selo_resgate'")).rows;
  assert.equal(mov.length, 1);
  assert.equal(mov[0].observacao, `Código ${g1.codigo}`);
  assert.ok(mov[0].criado_por, "fica quem liberou");
  await assert.rejects(() => comoEquipe(pg, "*", "insert into public.fidelidade_premios (unidade_id, cliente_tel, cartao_id, codigo, selos, valido_ate) values ('x', '91988887777', 'a', 'ABCDEF', 3, now())"), /permission|permissão/i);
});

test("canais: sem lista conta como antes; com lista só os canais escolhidos; iFood nunca", { skip: pular }, async () => {
  const pg = await banco();
  await pedidoPago(pg, { tipo: "qrcode", qtd: 1 });
  await pedidoPago(pg, { tipo: "ifood", qtd: 1 });
  assert.equal(await selos(pg), 1, "iFood não conta");
  const pg2 = await banco({ ...CFG, canais: ["delivery"] });
  await pedidoPago(pg2, { tipo: "salao", qtd: 1 });
  await pedidoPago(pg2, { tipo: "retirada", qtd: 2 });
  assert.equal(await selos(pg2), 2, "mesa fora da lista; retirada conta como delivery");
});
