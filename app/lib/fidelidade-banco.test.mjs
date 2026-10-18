// FIDELIDADE-1 aplicada num Postgres real em memória (PGlite), sobre pedidos,
// pedidos_itens e config_sistema com as colunas do banco de produção (18/10/2026).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/fidelidade-banco.test.mjs
// Sem PGLITE os testes de banco são pulados (aparecem como "skipped", não como aprovados).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { saldoDoCliente } from "./fidelidade.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SQL = fs.readFileSync(path.join(raiz, "db", "FIDELIDADE_1_SELOS_E_CASHBACK.sql"), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";
const IMPRESSAO = "407bcd9c6a4b80101073aecb68d07928";

const U = "seldeestrela";
const CAFE = "11111111-1111-4111-8111-111111111111";
const BURGER = "33333333-3333-4333-8333-333333333333";
const OUTRO = "44444444-4444-4444-8444-444444444444";
const TEL = "(91) 98888-7777";
const CFG = {
  ativo: true,
  cartoes: [
    { id: "cafe", nome: "Cartão do café", produto_ids: [CAFE], selos: 3, recompensa: "1 café grátis", validade_dias: 90, ativo: true, por: "unidade" },
    { id: "burger", nome: "Burger", produto_ids: [BURGER], selos: 5, recompensa: "1 burger", por: "pedido", ativo: true, validade_dias: 0 },
  ],
  cashback: { ativo: true, percentual: 5, minimo_pedido: 20, validade_dias: 60, uso_maximo_pct: 50 },
};

// Colunas reais (information_schema, 18/10/2026) e as funções de permissão, simuladas.
const BASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  create function public.hefisto_user_can(p_permission text, p_unidade_id text) returns boolean language sql stable as $$
    select coalesce(current_setting('teste.pode', true), '') = '*'
        or position((p_permission || '@' || p_unidade_id) in coalesce(current_setting('teste.pode', true), '')) > 0 $$;
  create table public.config_sistema (id uuid primary key default gen_random_uuid(), unidade_id text, params jsonb, created_at timestamptz default now());
  create table public.unidades (id text primary key, nome text not null);
  insert into public.unidades values ('seldeestrela', 'Sel de Estrela'), ('outra', 'Outra');
  create table public.clientes (id uuid primary key default gen_random_uuid(), nome text not null, tel text, total_gasto numeric default 0,
    total_pedidos integer default 0, ultima_compra date, unidade_id text, created_at timestamptz default now());
  create table public.pedidos (id uuid primary key default gen_random_uuid(), unidade_id text, mesa_id uuid, status text, valor_total numeric,
    created_at timestamptz default now(), updated_at timestamptz default now(), tipo_pedido text, cliente_nome text, cliente_telefone text,
    endereco_entrega text, troco_para text, forma_pagamento text, garcom_id uuid, identificacao text);
  create table public.pedidos_itens (id uuid primary key default gen_random_uuid(), pedido_id uuid, produto_id uuid, quantidade integer,
    valor_unitario numeric, observacao text, status_kds text, created_at timestamptz default now(), updated_at timestamptz default now());
  grant select, insert, update on public.pedidos, public.pedidos_itens to authenticated;
`;

async function banco({ cfg = CFG } = {}) {
  const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
  const pg = new PGlite();
  await pg.exec(BASE);
  await pg.query("insert into public.config_sistema (unidade_id, params) values ($1, $2)", [U, { fidelidade: cfg, outra_coisa: 1 }]);
  await pg.exec(SQL);
  return pg;
}

async function pedido(pg, { tel = TEL, itens = [[CAFE, 2, 5], [BURGER, 3, 10]], unidade = U, status = "novo_online" } = {}) {
  const { rows } = await pg.query("insert into public.pedidos (unidade_id, status, tipo_pedido, cliente_telefone, valor_total) values ($1, $2, 'delivery', $3, 0) returning id", [unidade, status, tel]);
  const id = rows[0].id;
  for (const [prod, qtd, preco] of itens) {
    await pg.query("insert into public.pedidos_itens (pedido_id, produto_id, quantidade, valor_unitario, status_kds) values ($1, $2, $3, $4, 'aguardando_aceite')", [id, prod, qtd, preco]);
  }
  return id;
}
const status = (pg, id, s) => pg.query("update public.pedidos set status = $2 where id = $1", [id, s]);
const livro = async (pg, tel = "91988887777") => (await pg.query("select tipo, cartao_id, selos, valor::float8 as valor, pedido_id, created_at from public.fidelidade_movimentos where cliente_tel = $1 order by created_at, tipo", [tel])).rows;
const saldoSelos = async (pg, cartao, validade = 0, tel = "91988887777") => (await pg.query("select public._fidelidade_saldo_cartao($1, $2, $3, $4) as s", [U, tel, cartao, validade])).rows[0].s;
const saldoCash = async (pg, validade = 60, tel = "91988887777") => Number((await pg.query("select public._fidelidade_saldo_cashback($1, $2, $3) as s", [U, tel, validade])).rows[0].s);
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

test("a migração só adiciona: sem drop, delete, update, truncate; policy e grants só nos objetos novos", () => {
  const limpo = SQL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
  // Fora das funções (o que roda na hora de aplicar): nada que apague ou altere linha.
  const cmd = limpo.replace(/\$\$[\s\S]*?\$\$/g, "$$$$");
  assert.doesNotMatch(cmd, /\bdrop\s+(table|column|schema|view|function|index|policy|trigger)\b/);
  assert.doesNotMatch(cmd, /\bdelete\s+from\b/);
  assert.doesNotMatch(cmd, /\bupdate\s+(public\.)?\w+\s+set\b/);
  assert.doesNotMatch(cmd, /\btruncate\s+(table\s+)?public\./);
  for (const m of cmd.matchAll(/\balter\s+table\s+([\w.]+)\s+(\w+(?:\s+\w+)?)/g)) {
    assert.ok(m[1] === "public.fidelidade_movimentos" || (["public.clientes", "public.pedidos"].includes(m[1]) && m[2] === "add column"), m[0]);
  }
  // Dentro das funções: a única escrita fora do livro é o cadastro do próprio cliente.
  const corpos = [...limpo.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]).join("\n");
  assert.doesNotMatch(corpos, /\bdelete\s+from\b|\btruncate\b|\bdrop\b/);
  assert.deepEqual([...corpos.matchAll(/\bupdate\s+([\w.]+)/g)].map((m) => m[1]), ["public.clientes"]);
  for (const m of cmd.matchAll(/\bcreate\s+policy\s+\w+\s+on\s+([\w.]+)/g)) assert.equal(m[1], "public.fidelidade_movimentos");
  assert.doesNotMatch(cmd, /using\s*\(\s*true\s*\)|auth\.role\(\)\s*=/, "nada de policy aberta");
  for (const m of cmd.matchAll(/\b(?:grant|revoke)\b[^;]*?\bon\s+(?:function\s+)?([\w.]+)/g)) assert.match(m[1], /^public\.(_?fidelidade)/, m[0]);
});

test("aplica: tabela com RLS, sem escrita direta, trigger em pedidos e impressão digital", { skip: pular }, async () => {
  const pg = await banco();
  const rls = (await pg.query("select relrowsecurity from pg_class where relname = 'fidelidade_movimentos'")).rows[0].relrowsecurity;
  assert.equal(rls, true);
  const trg = (await pg.query("select tgname from pg_trigger where tgrelid = 'public.pedidos'::regclass and not tgisinternal")).rows.map((r) => r.tgname);
  assert.deepEqual(trg, ["fidelidade_pedido"]);
  const resto = SQL.split("-- Verificação (só leitura)")[1];
  const linhas = resto.slice(resto.indexOf("\n") + 1);
  const h = (await pg.query(linhas)).rows[0].impressao_digital;
  if (IMPRESSAO !== "PREENCHER") assert.equal(h, IMPRESSAO);
  else console.log("IMPRESSAO =", h);
  await assert.rejects(() => banco().then((b) => b.exec(SQL)), /já existe/, "preflight aborta na segunda vez");
});

test("pedido concluído dá selos e cashback; repetir o status não dá de novo; cancelar estorna", { skip: pular }, async () => {
  const pg = await banco();
  const id = await pedido(pg); // 2 cafés (R$ 5) + 3 burgers (R$ 10) = R$ 40
  assert.equal((await livro(pg)).length, 0, "pedido enviado não ganha nada");
  await status(pg, id, "preparando_delivery");
  await status(pg, id, "saiu");
  assert.equal((await livro(pg)).length, 0);
  await status(pg, id, "pago");
  let l = await livro(pg);
  assert.deepEqual(l.map((m) => [m.tipo, m.cartao_id, m.selos, m.valor]).sort(), [
    ["cashback", null, 0, 2], ["selo", "burger", 1, 0], ["selo", "cafe", 2, 0],
  ]);
  await status(pg, id, "entregue");
  await status(pg, id, "pronto");
  await status(pg, id, "pago");
  assert.equal((await livro(pg)).length, 3, "idempotente");
  assert.equal(await saldoSelos(pg, "cafe", 90), 2);
  assert.equal(await saldoCash(pg), 2);
  await status(pg, id, "cancelado");
  l = await livro(pg);
  assert.deepEqual(l.filter((m) => m.tipo.endsWith("estorno")).map((m) => [m.tipo, m.cartao_id, m.selos, m.valor]).sort(), [
    ["cashback_estorno", null, 0, -2], ["selo_estorno", "burger", -1, 0], ["selo_estorno", "cafe", -2, 0],
  ]);
  assert.equal(await saldoSelos(pg, "cafe", 90), 0);
  assert.equal(await saldoCash(pg), 0);
});

test("sem telefone, telefone curto, programa desligado ou abaixo do mínimo: nada", { skip: pular }, async () => {
  const pg = await banco();
  await status(pg, await pedido(pg, { tel: null }), "pago");
  await status(pg, await pedido(pg, { tel: "8888-7777" }), "pago");
  assert.equal((await pg.query("select count(*)::int n from public.fidelidade_movimentos")).rows[0].n, 0);
  await status(pg, await pedido(pg, { itens: [[OUTRO, 1, 15]] }), "pago");
  assert.equal((await livro(pg)).length, 0, "R$ 15 sem produto de cartão e abaixo do mínimo de R$ 20");
  const off = await banco({ cfg: { ...CFG, ativo: false } });
  await status(off, await pedido(off), "pago");
  assert.equal((await livro(off)).length, 0);
});

test("erro na fidelidade não trava o pedido", { skip: pular }, async () => {
  const pg = await banco({ cfg: { ativo: true, cartoes: "lixo", cashback: { ativo: true, percentual: "abc", validade_dias: "x" } } });
  const id = await pedido(pg);
  await status(pg, id, "pago");
  assert.equal((await pg.query("select status from public.pedidos where id = $1", [id])).rows[0].status, "pago");
  assert.deepEqual((await livro(pg)).map((m) => [m.tipo, m.valor]), [["cashback", 2]], "percentual ruim = 5% padrão");
});

test("o livro não aceita update, delete nem truncate", { skip: pular }, async () => {
  const pg = await banco();
  await status(pg, await pedido(pg), "pago");
  await assert.rejects(() => pg.exec("update public.fidelidade_movimentos set selos = 99"), /não pode ser alterado/);
  await assert.rejects(() => pg.exec("delete from public.fidelidade_movimentos"), /não pode ser alterado/);
  await assert.rejects(() => pg.exec("truncate public.fidelidade_movimentos"), /não pode ser alterado/);
});

test("resgate de prêmio: permissão no banco, saldo suficiente e baixa no livro", { skip: pular }, async () => {
  const pg = await banco();
  await status(pg, await pedido(pg), "pago"); // 2 selos de café (cartão de 3)
  const resgatar = (pode) => comoEquipe(pg, pode, "select public.fidelidade_resgatar_selos($1, $2, 'cafe', 'balcão') as r", [U, TEL]);
  await assert.rejects(() => resgatar(""), /Sem permissão/);
  await assert.rejects(() => resgatar(`clientes.loyalty.confirm@outra`), /Sem permissão/, "permissão de outra unidade não vale");
  await assert.rejects(() => resgatar(`clientes.loyalty.confirm@${U}`), /Faltam 1 selo/);
  await status(pg, await pedido(pg, { itens: [[CAFE, 1, 5]] }), "pago");
  const r = (await resgatar(`clientes.loyalty.confirm@${U}`)).rows[0].r;
  assert.deepEqual(r, { ok: true, resgatados: 3, selos: 0 });
  const ultimo = (await livro(pg)).find((m) => m.tipo === "selo_resgate");
  assert.equal(ultimo.selos, -3);
  assert.equal((await pg.query("select criado_por::text from public.fidelidade_movimentos where tipo = 'selo_resgate'")).rows[0].criado_por, "00000000-0000-4000-8000-0000000000aa");
});

test("lançamento manual: motivo obrigatório, limites e permissão de edição", { skip: pular }, async () => {
  const pg = await banco();
  const lancar = (pode, selos, valor, motivo) => comoEquipe(pg, pode, "select public.fidelidade_lancar($1, $2, 'cafe', $3, $4, $5)", [U, TEL, selos, valor, motivo]);
  await assert.rejects(() => lancar(`clientes.loyalty.confirm@${U}`, 1, 0, "compra no balcão"), /Sem permissão/);
  await assert.rejects(() => lancar(`clientes.loyalty.edit@${U}`, 1, 0, ""), /motivo/);
  await assert.rejects(() => lancar(`clientes.loyalty.edit@${U}`, 1, 5, "os dois"), /selos OU cashback/);
  await assert.rejects(() => lancar(`clientes.loyalty.edit@${U}`, 31, 0, "demais"), /limite/);
  await lancar(`clientes.loyalty.edit@${U}`, 2, 0, "compra no balcão");
  assert.equal(await saldoSelos(pg, "cafe"), 2);
});

test("cashback no cardápio: só o servidor reserva, confere telefone e saldo; cancelar devolve", { skip: pular }, async () => {
  const pg = await banco();
  await status(pg, await pedido(pg, { itens: [[OUTRO, 4, 25]] }), "pago"); // R$ 100 → R$ 5 de cashback
  assert.equal(await saldoCash(pg), 5);
  const novo = await pedido(pg, { itens: [[OUTRO, 2, 25]] });
  await assert.rejects(() => comoEquipe(pg, "*", "select public.fidelidade_reservar_cashback($1, $2, $3, 3)", [U, TEL, novo]), /permission denied/, "equipe/anon não chamam");
  await assert.rejects(() => pg.query("select public.fidelidade_reservar_cashback($1, $2, $3, 3)", [U, "(91) 97777-0000", novo]), /não confere/);
  await pg.query("select public.fidelidade_reservar_cashback($1, $2, $3, 3)", [U, TEL, novo]);
  assert.equal(await saldoCash(pg), 2);
  const outro = await pedido(pg, { itens: [[OUTRO, 1, 25]] });
  await assert.rejects(() => pg.query("select public.fidelidade_reservar_cashback($1, $2, $3, 2.5)", [U, TEL, outro]), /insuficiente/);
  // concluído: o cashback novo é sobre o que foi pago (R$ 50 − R$ 3 usados = R$ 47 → R$ 2,35)
  await status(pg, novo, "pago");
  assert.equal(await saldoCash(pg), 4.35);
  await status(pg, novo, "cancelado");
  assert.equal(await saldoCash(pg), 5, "estorna o ganho (−2,35) e devolve o usado (+3)");
});

test("validade: N dias sem ganhar, o saldo vence e o próximo crédito lança o 'expira'", { skip: pular }, async () => {
  const pg = await banco();
  await pg.query(`insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, cartao_id, selos, origem, created_at)
                  values ($1, '91988887777', 'selo', 'cafe', 2, 'painel', now() - interval '100 days')`, [U]);
  await pg.query(`insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, valor, origem, created_at)
                  values ($1, '91988887777', 'cashback', 7, 'painel', now() - interval '61 days')`, [U]);
  assert.equal(await saldoSelos(pg, "cafe", 90), 0);
  assert.equal(await saldoCash(pg, 60), 0);
  await status(pg, await pedido(pg, { itens: [[CAFE, 1, 25]] }), "pago");
  const l = await livro(pg);
  assert.deepEqual(l.filter((m) => m.tipo.endsWith("expira")).map((m) => [m.tipo, m.selos, m.valor]).sort(), [["cashback_expira", 0, -7], ["selo_expira", -2, 0]]);
  assert.equal(await saldoSelos(pg, "cafe", 90), 1, "só o selo novo");
  assert.equal(await saldoCash(pg, 60), 1.25);
});

test("RLS: a equipe só lê o livro da própria unidade e não grava direto", { skip: pular }, async () => {
  const pg = await banco();
  await status(pg, await pedido(pg), "pago");
  await pg.query("insert into public.config_sistema (unidade_id, params) values ('outra', $1)", [{ fidelidade: CFG }]);
  await status(pg, await pedido(pg, { unidade: "outra" }), "pago");
  const ver = (pode) => comoEquipe(pg, pode, "select unidade_id from public.fidelidade_movimentos");
  assert.deepEqual([...new Set((await ver(`clientes.loyalty.view@${U}`)).rows.map((r) => r.unidade_id))], [U]);
  assert.equal((await ver("")).rows.length, 0);
  await assert.rejects(() => comoEquipe(pg, "*", "insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, valor) values ($1, '91988887777', 'cashback', 100)", [U]), /permission denied/);
});

test("o saldo do app (saldoDoCliente) bate com o do banco", { skip: pular }, async () => {
  const pg = await banco();
  await status(pg, await pedido(pg), "pago");
  await status(pg, await pedido(pg, { itens: [[CAFE, 3, 5], [OUTRO, 1, 30]] }), "pago");
  const app = saldoDoCliente(await livro(pg), CFG);
  assert.equal(app.cartoes.cafe.selos, await saldoSelos(pg, "cafe", 90));
  assert.equal(app.cartoes.burger.selos, await saldoSelos(pg, "burger", 0));
  assert.equal(app.cashback.saldo, await saldoCash(pg, 60));
});

// ─── cadastro pelo QR ────────────────────────────────────────────────────────
const CFG_CAD = { ...CFG, cadastro: { ativo: true, desconto_pct: 10, aplica: "primeiro", validade_dias: 0 } };
const cadastrar = (pg, tel = TEL, nome = "Ana Lima", extra = {}) => pg.query("select public.fidelidade_cadastrar($1, $2, $3, $4, $5, $6) as r",
  [extra.unidade || U, nome, tel, extra.email ?? "ana@x.com", extra.aniversario ?? "1990-05-31", extra.novidades ?? true]).then((r) => r.rows[0].r);
const desconto = (pg, tel = TEL) => pg.query("select public.fidelidade_desconto_cadastro($1, $2) as d", [U, tel]).then((r) => Number(r.rows[0].d));

test("cadastro pelo QR: cria o cliente no CRM; o mesmo telefone não duplica nem troca o nome", { skip: pular }, async () => {
  const pg = await banco({ cfg: CFG_CAD });
  assert.deepEqual(await cadastrar(pg), { ok: true, novo: true });
  assert.deepEqual(await cadastrar(pg, "+55 91 98888-7777", "Outra Pessoa", { email: "golpe@x.com" }), { ok: true, novo: false });
  const { rows } = await pg.query("select nome, tel, email, aniversario::text, aceita_novidades, origem, cadastro_em is not null as cad, aceite_lgpd_em is not null as lgpd from public.clientes");
  assert.deepEqual(rows, [{ nome: "Ana Lima", tel: "91988887777", email: "ana@x.com", aniversario: "1990-05-31", aceita_novidades: true, origem: "qr", cad: true, lgpd: true }]);
  await assert.rejects(() => cadastrar(pg, "123"), /inválido/);
  await assert.rejects(() => cadastrar(pg, TEL, "Ana", { unidade: "nao-existe" }), /Unidade inválida/);
});

test("cadastro de quem a equipe já tinha: marca o cadastro e mantém nome e e-mail", { skip: pular }, async () => {
  const pg = await banco({ cfg: CFG_CAD });
  await pg.query("insert into public.clientes (nome, tel, unidade_id, email) values ('Ana (balcão)', '(91) 98888-7777', $1, null)", [U]);
  assert.deepEqual(await cadastrar(pg, TEL, "Ana Nova"), { ok: true, novo: false });
  const { rows } = await pg.query("select nome, tel, email, cadastro_em is not null as cad from public.clientes");
  assert.deepEqual(rows, [{ nome: "Ana (balcão)", tel: "91988887777", email: "ana@x.com", cad: true }]);
});

test("desconto do cadastro: só cadastrado; primeiro pedido; cancelado devolve; validade; programa desligado", { skip: pular }, async () => {
  const pg = await banco({ cfg: CFG_CAD });
  assert.equal(await desconto(pg), 0, "sem cadastro, sem desconto");
  await cadastrar(pg);
  assert.equal(await desconto(pg), 10);
  assert.equal(await desconto(pg, "(91) 97777-0000"), 0, "outro telefone");
  const id = await pedido(pg);
  await pg.query("update public.pedidos set desconto = 4, desconto_origem = 'cadastro' where id = $1", [id]);
  assert.equal(await desconto(pg), 0, "primeiro pedido já usou");
  await status(pg, id, "cancelado");
  assert.equal(await desconto(pg), 10, "pedido cancelado devolve o benefício");
  await pg.query("update public.config_sistema set params = jsonb_set(params, '{fidelidade,cadastro,aplica}', '\"sempre\"')");
  const id2 = await pedido(pg);
  await pg.query("update public.pedidos set desconto = 4, desconto_origem = 'cadastro' where id = $1", [id2]);
  assert.equal(await desconto(pg), 10, "em todos os pedidos");
  await pg.query("update public.config_sistema set params = jsonb_set(params, '{fidelidade,cadastro,validade_dias}', '30')");
  await pg.query("update public.clientes set cadastro_em = now() - interval '31 days'");
  assert.equal(await desconto(pg), 0, "venceu");
  await pg.query("update public.config_sistema set params = jsonb_set(params, '{fidelidade,ativo}', 'false')");
  await pg.query("update public.clientes set cadastro_em = now()");
  assert.equal(await desconto(pg), 0, "programa desligado");
});

test("cadastro e desconto: só o servidor chama; cashback do pedido é sobre o que foi pago", { skip: pular }, async () => {
  const pg = await banco({ cfg: CFG_CAD });
  await assert.rejects(() => comoEquipe(pg, "*", "select public.fidelidade_cadastrar($1, 'Ana', $2, null, null, false)", [U, TEL]), /permission denied/);
  await assert.rejects(() => comoEquipe(pg, "*", "select public.fidelidade_desconto_cadastro($1, $2)", [U, TEL]), /permission denied/);
  const id = await pedido(pg, { itens: [[OUTRO, 4, 25]] }); // R$ 100 de itens
  await pg.query("update public.pedidos set desconto = 10, desconto_origem = 'cadastro' where id = $1", [id]);
  await status(pg, id, "pago");
  assert.equal(await saldoCash(pg), 4.5, "5% de R$ 90 (pagou com 10% de desconto)");
});
