// SQL REAL de COM_1 e COM_3 em Postgres na memória (PGlite). Rode com:
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/comanda-fechar-banco.test.mjs
// Sem PGLITE os testes NÃO rodam (e o processo sai com código 2).

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
if (!process.env.PGLITE) {
  console.log("PGLITE não informado: testes de fechamento da comanda NÃO executados.");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

await pg.exec(`
create role anon; create role authenticated;
create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create table unidades (id text primary key); insert into unidades values ('a'), ('b');
create table mesas (id int primary key, unidade_id text, status text);
create table produtos (id int primary key, nome_produto text);
create table pedidos (id uuid primary key default gen_random_uuid(), unidade_id text, mesa_id int, status text, valor_total numeric, updated_at timestamptz, forma_pagamento text, identificacao text);
create table pedidos_itens (id serial primary key, pedido_id uuid, produto_id int, quantidade int, valor_unitario numeric, status_kds text);
create table pdv_caixas (id uuid primary key default gen_random_uuid(), unidade_id text, status text);
create table vendas (id uuid primary key default gen_random_uuid(), subtotal numeric, desconto numeric, total numeric, forma_pagamento text, cliente text, observacao text, status text, unidade_id text, taxa_servico numeric, acrescimo numeric, caixa_id uuid);
create table venda_itens (id serial primary key, venda_id uuid, nome text, preco_unit numeric, quantidade numeric, subtotal numeric, unidade_id text);
create table fin_contas_receber (id serial primary key, unidade_id text, origem_tipo text, origem_id uuid, venda_id uuid, descricao text, meio text, modalidade text, data_venda date, data_prevista date, valor_bruto numeric, status text, chave_idempotencia text unique, criado_por uuid);
create table fin_faturamento_diario (unidade_id text, data date, vendas_brutas numeric, descontos numeric default 0, fonte text, criado_por uuid, updated_at timestamptz, atualizado_por uuid, unique (unidade_id, data));
create table permitido (unidade_id text);
create function hefisto_user_can(p text, u text) returns boolean language sql as $$ select exists (select 1 from permitido where unidade_id = u) $$;
create function hefisto_ve_todas_unidades() returns boolean language sql as $$ select false $$;
create function hefisto_unidades_do_usuario() returns text[] language sql as $$ select '{}'::text[] $$;
insert into permitido values ('a');
insert into mesas values (1, 'a', 'fechando'), (2, 'b', 'ocupada');
insert into produtos values (1, 'Suco'), (2, 'Tacacá');
`);
await pg.exec(ler("db/comandas/COM_3_FECHAR_COMANDA.sql"));
console.log("ok   COM_3 aplicada");

const q = async (s, p) => (await pg.query(s, p)).rows;
const [{ id: caixa }] = await q("insert into pdv_caixas (unidade_id, status) values ('a', 'aberto') returning id");
const [{ id: caixaOutro }] = await q("insert into pdv_caixas (unidade_id, status) values ('b', 'aberto') returning id");
async function novoPedido(mesa = 1, unidade = "a") {
  const [{ id }] = await q("insert into pedidos (unidade_id, mesa_id, status, identificacao) values ($1, $2, 'aberto', '1.01') returning id", [unidade, mesa]);
  await q("insert into pedidos_itens (pedido_id, produto_id, quantidade, valor_unitario, status_kds) values ($1, 1, 2, 12, 'pronto'), ($1, 2, 1, 40, 'entregue'), ($1, 2, 1, 999, 'cancelado')", [id]);
  return id;
}
const fechar = (ped, pag, opc = {}) => q("select comanda_fechar($1, $2, $3::jsonb, $4, $5, $6, $7) r", [ped, opc.caixa || caixa, JSON.stringify(pag), opc.desconto || 0, opc.taxa || 0, opc.acrescimo || 0, opc.cliente || null]).then((r) => r[0].r);
const erro = (p) => p.then(() => "sem erro", (e) => e.message);

const p1 = await novoPedido();
conferir("pagamento menor é recusado", await erro(fechar(p1, [{ forma: "pix", valor: 50 }])), "Pagamentos somam 50.00 e a conta é 64.00.");
conferir("nada ficou gravado", (await q("select count(*)::int n from vendas"))[0].n, 0);
conferir("caixa de outra unidade é recusado", await erro(fechar(p1, [{ forma: "pix", valor: 64 }], { caixa: caixaOutro })), "Abra o caixa antes de receber.");
conferir("desconto acima da conta é recusado", await erro(fechar(p1, [{ forma: "pix", valor: 1 }], { desconto: 65 })), "O desconto passa do valor da comanda.");

// 64 de consumo − 4 de desconto + 6 de 10% = 66
const r = await fechar(p1, [{ forma: "dinheiro", valor: 26 }, { forma: "credito", valor: 30 }, { forma: "pix", valor: 10 }], { desconto: 4, taxa: 6, cliente: "Ana" });
conferir("fecha e soma pelo banco, sem o item cancelado", [r.ok, Number(r.total)], [true, 66]);
const [v] = await q("select subtotal::float, desconto::float, total::float, taxa_servico::float, forma_pagamento, cliente, pedido_id = $1 ligada from vendas", [p1]);
conferir("venda gravada", v, { subtotal: 64, desconto: 4, total: 66, taxa_servico: 6, forma_pagamento: "multiplo", cliente: "Ana", ligada: true });
conferir("itens da venda", (await q("select nome, quantidade::int, subtotal::float from venda_itens order by nome")), [{ nome: "Suco", quantidade: 2, subtotal: 24 }, { nome: "Tacacá", quantidade: 1, subtotal: 40 }]);
conferir("pagamentos", (await q("select forma, valor::float from venda_pagamentos order by forma")), [{ forma: "credito", valor: 30 }, { forma: "dinheiro", valor: 26 }, { forma: "pix", valor: 10 }]);
conferir("cartão e Pix a receber; dinheiro não", (await q("select meio, valor_bruto::float, status from fin_contas_receber order by meio")), [{ meio: "credito", valor_bruto: 30, status: "previsto" }, { meio: "pix", valor_bruto: 10, status: "previsto" }]);
conferir("faturamento sem os 10%", (await q("select vendas_brutas::float, descontos::float from fin_faturamento_diario")), [{ vendas_brutas: 64, descontos: 4 }]);
conferir("pedido pago e mesa livre", [(await q("select status from pedidos where id = $1", [p1]))[0].status, (await q("select status from mesas where id = 1"))[0].status], ["pago", "livre"]);

const rep = await fechar(p1, [{ forma: "pix", valor: 66 }]);
conferir("segundo toque devolve a mesma venda", [rep.repetido, (await q("select count(*)::int n from vendas"))[0].n, (await q("select vendas_brutas::float v from fin_faturamento_diario"))[0].v], [true, 1, 64]);

const p2 = await novoPedido();
await fechar(p2, [{ forma: "dinheiro", valor: 64 }]);
conferir("faturamento do dia soma a segunda conta", (await q("select vendas_brutas::float v from fin_faturamento_diario"))[0].v, 128);
conferir("forma única fica na venda", (await q("select forma_pagamento f from vendas where pedido_id = $1", [p2]))[0].f, "dinheiro");

const p3 = await novoPedido(2, "b");
conferir("sem permissão na unidade", await erro(fechar(p3, [{ forma: "pix", valor: 64 }], { caixa: caixaOutro })), "Sem permissão para receber contas nesta unidade.");
const p4 = await novoPedido();
conferir("forma inválida desfaz tudo", [(await erro(fechar(p4, [{ forma: "fiado", valor: 64 }]))).includes("venda_pagamentos_forma_check"), (await q("select count(*)::int n from vendas where pedido_id = $1", [p4]))[0].n, (await q("select status from pedidos where id = $1", [p4]))[0].status], [true, 0, "aberto"]);

await pg.exec(ler("db/comandas/COM_3_ROLLBACK.sql"));
conferir("rollback", (await q("select to_regclass('public.venda_pagamentos')::text t"))[0].t, null);
console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
