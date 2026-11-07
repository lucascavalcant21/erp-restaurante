// SQL REAL da COM_5 (trocar e juntar mesas, transferir e cancelar item) em
// Postgres na memória (PGlite). Rode com:
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/comanda-mesas-banco.test.mjs
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
  console.log("PGLITE não informado: testes de mesas e cancelamento de item NÃO executados.");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

await pg.exec(`
create role anon; create role authenticated;
create schema auth; create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000aa'::uuid $$;
create table mesas (id uuid primary key default gen_random_uuid(), unidade_id text, numero text, numero_mesa text, status text);
create table pedidos (id uuid primary key default gen_random_uuid(), unidade_id text, mesa_id uuid, status text, tipo_pedido text, valor_total numeric, garcom_nome text, identificacao text, created_at timestamptz default now(), updated_at timestamptz);
create table pedidos_itens (id uuid primary key default gen_random_uuid(), pedido_id uuid, produto_id int, quantidade int, valor_unitario numeric, status_kds text, updated_at timestamptz);
create table permitido (unidade_id text, perm text);
create function hefisto_user_can(p text, u text) returns boolean language sql as $$ select exists (select 1 from permitido where unidade_id = u and (perm is null or perm = p)) $$;
insert into permitido values ('a', 'salao.tables.move'), ('a', 'salao.tables.cancel');
`);
await pg.exec(ler("db/comandas/COM_5_MESAS_E_CANCELAMENTO_DE_ITEM.sql"));
console.log("ok   COM_5 aplicada");

const q = (sql, p = []) => pg.query(sql, p).then((r) => r.rows);
const erro = (promessa) => promessa.then(() => "SEM ERRO", (e) => e.message);
const mesa = async (n, status = "livre", unidade = "a") => (await q("insert into mesas (unidade_id, numero, numero_mesa, status) values ($1, $2, $2, $3) returning id", [unidade, n, status]))[0].id;
const comanda = async (m, n, garcom = "Larissa") => (await q("insert into pedidos (unidade_id, mesa_id, status, tipo_pedido, garcom_nome, identificacao) values ('a', $1, 'aberto', 'salao', $2, $3) returning id", [m, garcom, `${n}.01`]))[0].id;
const item = async (p, status = "pendente") => (await q("insert into pedidos_itens (pedido_id, produto_id, quantidade, valor_unitario, status_kds) values ($1, 1, 1, 10, $2) returning id", [p, status]))[0].id;
const statusMesa = async (id) => (await q("select status from mesas where id = $1", [id]))[0].status;

// ── Trocar mesa ─────────────────────────────────────────────────────────────
const m1 = await mesa("1", "ocupada"); const m2 = await mesa("2"); const m3 = await mesa("3", "ocupada"); const mb = await mesa("9", "livre", "b");
const p1 = await comanda(m1, "1"); const i1 = await item(p1); const i2 = await item(p1);
const p3 = await comanda(m3, "3"); await item(p3);
conferir("troca para mesa livre", (await q("select comanda_trocar_mesa($1, $2) r", [p1, m2]))[0].r.ok, true);
conferir("comanda foi para a mesa 2 com a identificação nova", (await q("select mesa_id = $2 m, identificacao from pedidos where id = $1", [p1, m2]))[0], { m: true, identificacao: "2.01" });
conferir("mesa 1 livre, mesa 2 ocupada", [await statusMesa(m1), await statusMesa(m2)], ["livre", "ocupada"]);
conferir("mesa ocupada pede para juntar", await erro(q("select comanda_trocar_mesa($1, $2)", [p1, m3])), "A mesa 3 já tem comanda aberta. Use juntar mesas.");
conferir("mesa de outra unidade é recusada", await erro(q("select comanda_trocar_mesa($1, $2)", [p1, mb])), "Mesa de destino não encontrada.");

// ── Sem permissão ───────────────────────────────────────────────────────────
await q("delete from permitido where perm = 'salao.tables.move'");
conferir("garçom sem permissão não troca", await erro(q("select comanda_trocar_mesa($1, $2)", [p1, m1])), "Sem permissão para trocar mesa.");
conferir("garçom sem permissão não junta", await erro(q("select comanda_juntar($1, $2)", [p1, p3])), "Sem permissão para juntar mesas.");
conferir("garçom sem permissão não transfere", await erro(q("select comanda_transferir_itens($1, $2)", [[i1], m1])), "Sem permissão para transferir item.");
await q("insert into permitido values ('a', 'salao.tables.move')");

// ── Transferir item ─────────────────────────────────────────────────────────
const t = (await q("select comanda_transferir_itens($1, $2, 'Caio') r", [[i1], m1]))[0].r;
conferir("item vai para a mesa 1 (livre): abre comanda nova", t.itens, 1);
conferir("comanda nova com garçom e identificação", (await q("select garcom_nome, identificacao, status from pedidos where id = $1", [t.pedido_id]))[0], { garcom_nome: "Caio", identificacao: "1.01", status: "aberto" });
conferir("item lembra de onde veio", (await q("select transferido_de = $2 v from pedidos_itens where id = $1", [i1, p1]))[0].v, true);
conferir("mesa 1 ocupada de novo", await statusMesa(m1), "ocupada");

// ── Juntar ──────────────────────────────────────────────────────────────────
const j = (await q("select comanda_juntar($1, $2) r", [p1, p3]))[0].r;
conferir("junta a mesa 2 na 3", j, { ok: true, itens: 1, pedido_id: p3 });
conferir("comanda de origem fica transferida e a mesa 2 livre", [(await q("select status from pedidos where id = $1", [p1]))[0].status, await statusMesa(m2)], ["transferido", "livre"]);
conferir("juntar com comanda fechada é recusado", await erro(q("select comanda_juntar($1, $2)", [p1, p3])), "As duas comandas precisam estar abertas.");

// ── Cancelar item ───────────────────────────────────────────────────────────
conferir("motivo é obrigatório", await erro(q("select comanda_cancelar_item($1, ' ')", [i2])), "Informe o motivo do cancelamento.");
conferir("cancela com motivo", (await q("select comanda_cancelar_item($1, 'Cliente desistiu') r", [i2]))[0].r.ok, true);
conferir("item cancelado com quem e por quê", (await q("select status_kds, motivo_cancelamento m, cancelado_por is not null quem from pedidos_itens where id = $1", [i2]))[0], { status_kds: "cancelado", m: "Cliente desistiu", quem: true });
conferir("segundo toque não muda", (await q("select comanda_cancelar_item($1, 'de novo') r", [i2]))[0].r.repetido, true);
conferir("item cancelado não transfere", await erro(q("select comanda_transferir_itens($1, $2)", [[i2], m2])), "Item cancelado não pode ser transferido.");
const pPago = await comanda(m2, "2"); const iPago = await item(pPago);
await q("update pedidos set status = 'pago' where id = $1", [pPago]);
conferir("comanda paga: cancelamento é pelo caixa", await erro(q("select comanda_cancelar_item($1, 'Erro')", [iPago])), "A conta desta comanda já foi fechada. Cancele a venda pelo caixa.");
await q("delete from permitido where perm = 'salao.tables.cancel'");
const iOutro = await item(p3);
conferir("garçom sem permissão não cancela", await erro(q("select comanda_cancelar_item($1, 'Erro')", [iOutro])), "Sem permissão para cancelar item.");
conferir("anon não executa", (await q("select has_function_privilege('anon', 'comanda_cancelar_item(uuid, text)', 'execute') p"))[0].p, false);
conferir("função interna fechada", (await q("select has_function_privilege('authenticated', '_comanda_liberar_mesa(uuid)', 'execute') p"))[0].p, false);

// ── Rollback ────────────────────────────────────────────────────────────────
conferir("rollback recusa com histórico", (await erro(pg.exec(ler("db/comandas/COM_5_ROLLBACK.sql")))).includes("Rollback recusado"), true);
await pg.exec("rollback");
await q("update pedidos_itens set motivo_cancelamento = null, transferido_de = null");
await pg.exec(ler("db/comandas/COM_5_ROLLBACK.sql"));
conferir("rollback remove as funções", (await q("select to_regprocedure('comanda_juntar(uuid, uuid)')::text t"))[0].t, null);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
