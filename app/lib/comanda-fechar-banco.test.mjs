// SQL REAL de COM_3 e COM_4 em Postgres na memória (PGlite). Rode com:
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
create table vendas (id uuid primary key default gen_random_uuid(), subtotal numeric, desconto numeric, total numeric, forma_pagamento text, cliente text, observacao text, status text, unidade_id text, taxa_servico numeric, acrescimo numeric, caixa_id uuid, created_at timestamptz default now());
create table venda_itens (id serial primary key, venda_id uuid, nome text, preco_unit numeric, quantidade numeric, subtotal numeric, unidade_id text);
create table fin_contas_receber (id serial primary key, unidade_id text, origem_tipo text, origem_id uuid, venda_id uuid, descricao text, meio text, modalidade text, data_venda date, data_prevista date, valor_bruto numeric, status text, chave_idempotencia text unique, criado_por uuid, cancelado_em timestamptz, motivo_cancelamento text, updated_at timestamptz, atualizado_por uuid);
create table fin_faturamento_diario (unidade_id text, data date, vendas_brutas numeric, descontos numeric default 0, cancelamentos numeric not null default 0 check (cancelamentos >= 0), fonte text, criado_por uuid, updated_at timestamptz, atualizado_por uuid, unique (unidade_id, data), check (cancelamentos + descontos <= vendas_brutas));
create table permitido (unidade_id text, perm text);
create function hefisto_user_can(p text, u text) returns boolean language sql as $$ select exists (select 1 from permitido where unidade_id = u and (perm is null or perm = p)) $$;
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

// ── COM-4: cancelar a venda ─────────────────────────────────────────────
await pg.exec(ler("db/comandas/COM_4_CANCELAR_VENDA.sql"));
console.log("ok   COM_4 aplicada");
const cancelar = (venda, motivo) => q("select venda_cancelar($1, $2) r", [venda, motivo]).then((r) => r[0].r);
const vendaDe = async (ped) => (await q("select id from vendas where pedido_id = $1", [ped]))[0].id;
const fat = async () => (await q("select vendas_brutas::float b, descontos::float d, cancelamentos::float c from fin_faturamento_diario"))[0];

const v1 = await vendaDe(p1); // 64 − 4 de desconto + 6 de 10%; crédito 30, Pix 10, dinheiro 26
conferir("motivo é obrigatório", await erro(cancelar(v1, " ")), "Informe o motivo do cancelamento.");
await q("update permitido set perm = 'salao.sector.confirm' where unidade_id = 'a'");
conferir("quem só recebe não cancela", await erro(cancelar(v1, "Forma errada")), "Sem permissão para cancelar vendas nesta unidade.");
await q("update permitido set perm = null where unidade_id = 'a'");
await q("update fin_contas_receber set status = 'recebido' where meio = 'pix' and venda_id = $1", [v1]);
conferir("Pix já conferido: estorno pelo Financeiro", await erro(cancelar(v1, "Forma errada")), "Parte do pagamento já foi conferida como recebida. O estorno precisa ser feito pelo Financeiro.");
conferir("recusa não muda nada", [(await q("select status from vendas where id = $1", [v1]))[0].status, (await fat()).c], ["concluida", 0]);
await q("update fin_contas_receber set status = 'previsto' where meio = 'pix' and venda_id = $1", [v1]);

const c1 = await cancelar(v1, "Cliente pagou na mesa errada");
conferir("cancela e devolve o resumo", [c1.ok, Number(c1.faturamento_cancelado), c1.contas_canceladas, Number(c1.devolver_em_dinheiro)], [true, 60, 2, 26]);
conferir("venda cancelada com motivo", (await q("select status, motivo_cancelamento m, cancelada_em is not null quando from vendas where id = $1", [v1]))[0], { status: "cancelada", m: "Cliente pagou na mesa errada", quando: true });
conferir("contas a receber canceladas", await q("select status, motivo_cancelamento m from fin_contas_receber where venda_id = $1 order by meio", [v1]), [{ status: "cancelado", m: "Venda cancelada: Cliente pagou na mesa errada" }, { status: "cancelado", m: "Venda cancelada: Cliente pagou na mesa errada" }]);
conferir("faturamento do dia tira o líquido da venda", await fat(), { b: 128, d: 4, c: 60 });
conferir("comanda cancelada", (await q("select status from pedidos where id = $1", [p1]))[0].status, "cancelado");
const rep2 = await cancelar(v1, "de novo");
conferir("segundo toque não soma de novo", [rep2.repetido, (await fat()).c], [true, 60]);

const v2 = await vendaDe(p2);
await q("update pdv_caixas set status = 'fechado' where id = $1", [caixa]);
conferir("caixa fechado: estorno pelo Financeiro", await erro(cancelar(v2, "Erro")), "O caixa desta venda já foi fechado. O estorno precisa ser feito pelo Financeiro.");
await q("update pdv_caixas set status = 'aberto' where id = $1", [caixa]);
const [{ id: avulsa }] = await q("insert into vendas (subtotal, total, status, unidade_id, caixa_id) values (10, 10, 'concluida', 'a', $1) returning id", [caixa]);
conferir("venda fora da comanda é recusada", await erro(cancelar(avulsa, "Erro")), "Só vendas de comanda podem ser canceladas aqui.");
const c2 = await cancelar(v2, "Teste de cancelamento");
conferir("cancela tudo no dinheiro: sem contas, devolve 64", [c2.contas_canceladas, Number(c2.devolver_em_dinheiro), (await fat()).c], [0, 64, 124]);
conferir("anon não executa", (await q("select has_function_privilege('anon', 'venda_cancelar(uuid, text)', 'execute') p"))[0].p, false);

conferir("rollback recusa com vendas canceladas", (await erro(pg.exec(ler("db/comandas/COM_4_ROLLBACK.sql")))).includes("Rollback recusado"), true);
await pg.exec("rollback");
await pg.exec(ler("db/comandas/COM_4_ROLLBACK.sql").replace("if exists (select 1 from public.vendas where cancelada_em is not null)", "if false"));
conferir("rollback da COM-4", (await q("select to_regprocedure('venda_cancelar(uuid, text)')::text t"))[0].t, null);

await pg.exec(ler("db/comandas/COM_3_ROLLBACK.sql"));
conferir("rollback", (await q("select to_regclass('public.venda_pagamentos')::text t"))[0].t, null);
console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
