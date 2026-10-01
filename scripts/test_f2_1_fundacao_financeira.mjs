// Teste LOCAL da migration db/F2_1_FUNDACAO_FINANCEIRA.sql num Postgres em
// memória (PGlite). Nada aqui toca o banco de produção.
//
// O banco simulado imita só o que a F2.1 usa: unidades, fornecedores,
// insumos, estoques, vendas, contas_pagar (colunas EXATAS de produção) e as
// funções auth.uid(), auth_unidade_id(), pode_ver_todas() (SEC-RH-1.4).
// As 7 contas são SINTÉTICAS, com o mesmo formato do resultado S10/datas
// (categoria, status, data, soma por grupo) — nenhuma descrição real.
//
// Uso: PGLITE=<caminho do pacote @electric-sql/pglite> node scripts/test_f2_1_fundacao_financeira.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const alvo = process.env.PGLITE || "@electric-sql/pglite";
const { PGlite } = await import(alvo.startsWith("@") ? alvo : pathToFileURL(path.join(alvo, "dist", "index.js")).href);
const SQL = fs.readFileSync(path.join(raiz, "db", "F2_1_FUNDACAO_FINANCEIRA.sql"), "utf8");

let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};
async function erroDe(db, sql, params) {
  try { await db.query(sql, params); return null; } catch (e) { return e.message; }
}
async function erroDoScript(db, sql) {
  // como no SQL Editor: erro no meio → a transação inteira é desfeita
  try { await db.exec(sql); return null; } catch (e) { await db.exec("rollback"); return e.message; }
}

const BASE = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;

create table public.unidades (id text primary key, nome text);
create table public.fornecedores (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
create table public.insumos (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
create table public.estoques (id uuid primary key default gen_random_uuid(), unidade_id text, nome text);
create table public.vendas (id uuid primary key default gen_random_uuid(), unidade_id text, total numeric);
create table public.contas_pagar (
  id uuid primary key default gen_random_uuid(), unidade_id text, descricao text, valor numeric,
  data_vencimento date, data_pagamento date, categoria text, status text,
  created_at timestamptz default now(), updated_at timestamptz default now(), recorrente boolean default false);
-- como em produção hoje: authenticated escreve em contas_pagar
alter table public.contas_pagar enable row level security;
create policy cp_auth on public.contas_pagar for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.contas_pagar to authenticated;
grant select on public.unidades, public.fornecedores, public.insumos, public.estoques, public.vendas to authenticated;

create function public.auth_unidade_id() returns text language sql stable security definer as
  $$ select coalesce(current_setting('test.unidade', true), '') $$;
create function public.pode_ver_todas() returns boolean language sql stable security definer as
  $$ select coalesce(current_setting('test.rede', true), 'false') = 'true' $$;

insert into public.unidades values ('seldeestrela', 'Unidade real'), ('outra', 'Outra unidade');
insert into public.fornecedores (id, unidade_id, nome) values ('11111111-1111-1111-1111-111111111111', 'seldeestrela', 'Fornecedor X');
insert into public.insumos (id, unidade_id, nome) values ('22222222-2222-2222-2222-222222222222', 'seldeestrela', 'Picanha');
-- 7 contas sintéticas no formato do S10 + datas
insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, data_pagamento, categoria, status, created_at, updated_at) values
 ('seldeestrela','Histórica A',2382.20,'2026-06-23','2026-06-23','cmo','pago','2026-06-23','2026-06-23'),
 ('seldeestrela','Histórica B',2382.20,'2026-06-23','2026-06-23','cmo','pago','2026-06-23','2026-06-23'),
 ('seldeestrela','Histórica C', 800.00,'2026-06-23',null,'cmo','pendente','2026-06-23','2026-06-23'),
 ('seldeestrela','Histórica D', 800.00,'2026-06-23',null,'cmo','pendente','2026-06-23','2026-06-23'),
 ('seldeestrela','Histórica E', 821.98,'2026-06-23',null,'cmo','pendente','2026-06-23','2026-06-23'),
 ('seldeestrela','Histórica F',   9.00,'2026-07-15',null,'cmv','pendente','2026-07-15','2026-07-15'),
 ('seldeestrela','Histórica G',5500.00,'2026-09-02',null,'custo_variavel','pendente','2026-09-02','2026-09-02');
`;

const USUARIO = "33333333-3333-3333-3333-333333333333";
async function comoUsuario(db, unidade = "seldeestrela", rede = false) {
  await db.exec(`reset role;`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('test.unidade', $2, false), set_config('test.rede', $3, false)`,
    [USUARIO, unidade, rede ? "true" : "false"]);
  await db.exec(`set role authenticated;`);
}
async function comoDono(db) { await db.exec(`reset role;`); }

// ── 1. banco simulado + migration ───────────────────────────────────────────
const db = new PGlite();
await db.exec(BASE);
const COLS = "id, unidade_id, descricao, valor, data_vencimento, data_pagamento, categoria, status, created_at, updated_at, recorrente";
const antes = (await db.query(`select ${COLS} from public.contas_pagar order by descricao`)).rows;

await db.exec(SQL);
conferir("migration roda no banco simulado", true, true);
const depois = (await db.query(`select ${COLS} from public.contas_pagar order by descricao`)).rows;
conferir("os 7 registros históricos ficam idênticos (colunas originais)", JSON.stringify(depois), JSON.stringify(antes));
const novas = (await db.query(`select count(*)::int n from public.contas_pagar
  where coalesce(categoria_codigo, competencia::text, origem_tipo, criado_por::text, atualizado_por::text) is not null`)).rows[0].n;
conferir("colunas novas ficam nulas nos 7 registros", novas, 0);

// ── 2. idempotência da migration ────────────────────────────────────────────
const nCat = (await db.query(`select count(*)::int n from public.fin_categorias`)).rows[0].n;
await db.exec(SQL);
conferir("rodar de novo não quebra", true, true);
conferir("rodar de novo não duplica categorias", (await db.query(`select count(*)::int n from public.fin_categorias`)).rows[0].n, nCat);
conferir("histórico continua idêntico após 2ª execução",
  JSON.stringify((await db.query(`select ${COLS} from public.contas_pagar order by descricao`)).rows), JSON.stringify(antes));

// ── 3. leitura do histórico pela view ───────────────────────────────────────
await comoUsuario(db);
const v = (await db.query(`select descricao, categoria_codigo, natureza, exige_revisao, situacao, vencida, pagamento_legado,
  competencia_efetiva::text, competencia_inferida, valor_pago::float, saldo::float from public.vw_fin_contas_pagar order by descricao`)).rows;
conferir("view: 7 contas visíveis para a unidade", v.length, 7);
conferir("view: as 2 pagas antigas = pagamento legado integral",
  v.filter((r) => r.pagamento_legado).map((r) => [r.situacao, r.saldo]), [["pago", 0], ["pago", 0]]);
conferir("view: as 3 CMO pendentes de junho = vencidas", v.filter((r) => ["Histórica C", "Histórica D", "Histórica E"].includes(r.descricao)).map((r) => r.situacao), ["vencido", "vencido", "vencido"]);
conferir("view: 'cmv' de R$ 9 lido como mercadoria a revisar (não CMV)",
  v.find((r) => r.descricao === "Histórica F") && [v.find((r) => r.descricao === "Histórica F").categoria_codigo, v.find((r) => r.descricao === "Histórica F").natureza, v.find((r) => r.descricao === "Histórica F").exige_revisao],
  ["legado_cmv", "mercadoria", true]);
conferir("view: competência inferida pelo vencimento", [v[0].competencia_efetiva, v[0].competencia_inferida], ["2026-06-01", true]);

// ── 4. pagamentos parciais, juros, idempotência ─────────────────────────────
const { rows: [conta] } = await db.query(`insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, categoria, status, categoria_codigo, centro_custo_codigo, competencia)
  values ('seldeestrela','Fornecedor carnes',5000,'2026-09-30','custo_variavel','pendente','com_entregas','cozinha','2026-09-01') returning id, criado_por`);
conferir("insert pelo app: criado_por preenchido pelo trigger", conta.criado_por, USUARIO);
const p1 = (await db.query(`select public.fin_registrar_pagamento($1, '2026-09-30', 2000, 0,0,0, 'pix', null, null, 'PAG-1') r`, [conta.id])).rows[0].r;
conferir("pagamento 1 (2.000 de 5.000) → parcial", [p1.status, p1.saldo], ["parcial", 3000]);
const p1b = (await db.query(`select public.fin_registrar_pagamento($1, '2026-09-30', 2000, 0,0,0, 'pix', null, null, 'PAG-1') r`, [conta.id])).rows[0].r;
conferir("mesma chave de idempotência → não duplica", [p1b.idempotente, p1b.pagamento_id], [true, p1.pagamento_id]);
conferir("pagar acima do saldo → recusado", /maior que o saldo/.test(await erroDe(db, `select public.fin_registrar_pagamento($1, '2026-09-30', 3500)`, [conta.id])), true);
conferir("data futura → recusada", /futura/.test(await erroDe(db, `select public.fin_registrar_pagamento($1, '2999-01-01', 10)`, [conta.id])), true);
const p2 = (await db.query(`select public.fin_registrar_pagamento($1, '2026-10-01', 3000, 50, 10, 0, 'boleto') r`, [conta.id])).rows[0].r;
conferir("pagamento 2 (3.000 + juros/multa) → pago", [p2.status, p2.saldo], ["pago", 0]);
const vc = (await db.query(`select valor_original::float, valor_pago::float, saldo::float, saida_caixa_total::float, situacao from public.vw_fin_contas_pagar where id = $1`, [conta.id])).rows[0];
conferir("valor original preservado; saída de caixa inclui juros/multa", [vc.valor_original, vc.valor_pago, vc.saldo, vc.saida_caixa_total, vc.situacao], [5000, 5000, 0, 5060, "pago"]);
conferir("data_pagamento da conta = último pagamento",
  (await db.query(`select data_pagamento::text d from public.contas_pagar where id = $1`, [conta.id])).rows[0].d, "2026-10-01");
await db.query(`select public.fin_estornar_pagamento($1, 'lançado em duplicidade')`, [p2.pagamento_id]);
conferir("estorno do pagamento 2 → volta a parcial, data limpa",
  Object.values((await db.query(`select status, data_pagamento from public.contas_pagar where id = $1`, [conta.id])).rows[0]), ["parcial", null]);
conferir("estorno sem motivo → recusado", /motivo/.test(await erroDe(db, `select public.fin_estornar_pagamento($1, '  ')`, [p1.pagamento_id])), true);
conferir("pagamento estornado não pode ser estornado de novo", /já estornado/.test(await erroDe(db, `select public.fin_estornar_pagamento($1, 'x')`, [p2.pagamento_id])), true);

// ── 5. escrita direta e exclusão bloqueadas ─────────────────────────────────
conferir("app não grava direto em fin_pagamentos", /permission denied/.test(await erroDe(db,
  `insert into public.fin_pagamentos (unidade_id, conta_pagar_id, pago_em, valor_principal) values ('seldeestrela', $1, '2026-10-01', 1)`, [conta.id])), true);
await comoDono(db);
conferir("nem o dono apaga pagamento (só estorno)", /não pode ser apagado/.test(await erroDe(db, `delete from public.fin_pagamentos where id = $1`, [p1.pagamento_id])), true);
conferir("pagamento gravado é imutável", /imutável/.test(await erroDe(db, `update public.fin_pagamentos set valor_principal = 1 where id = $1`, [p1.pagamento_id])), true);
await comoUsuario(db);

// ── 6. legado e cancelamento ────────────────────────────────────────────────
const idLegadoPago = (await db.query(`select id from public.contas_pagar where descricao = 'Histórica A'`)).rows[0].id;
conferir("conta paga antiga não recebe novo pagamento", /registro anterior/.test(await erroDe(db, `select public.fin_registrar_pagamento($1, '2026-10-01', 1)`, [idLegadoPago])), true);
conferir("conta com pagamento não pode ser cancelada", /estorne/.test(await erroDe(db, `select public.fin_cancelar_conta_pagar($1, 'erro')`, [conta.id])), true);
const idPend = (await db.query(`insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, categoria, status) values ('seldeestrela','Lançada errado',10,'2026-10-05','outros','pendente') returning id`)).rows[0].id;
await db.query(`select public.fin_cancelar_conta_pagar($1, 'lançada em duplicidade')`, [idPend]);
conferir("cancelar pendente → cancelado, sem apagar", (await db.query(`select situacao from public.vw_fin_contas_pagar where id = $1`, [idPend])).rows[0].situacao, "cancelado");
conferir("status inválido em conta nova → recusado", /contas_pagar_status_f21/.test(await erroDe(db,
  `insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, status) values ('seldeestrela','x',1,'2026-10-01','PAGA')`)), true);
conferir("valor zero em conta nova → recusado", /contas_pagar_valor_f21/.test(await erroDe(db,
  `insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, status) values ('seldeestrela','x',0,'2026-10-01','pendente')`)), true);
conferir("conta antiga continua editável (hotfix)", await erroDe(db, `update public.contas_pagar set descricao = descricao where descricao = 'Histórica G'`), null);

// ── 7. isolamento por unidade ───────────────────────────────────────────────
await comoUsuario(db, "outra");
conferir("outra unidade não vê pagamentos", (await db.query(`select count(*)::int n from public.fin_pagamentos`)).rows[0].n, 0);
conferir("outra unidade não paga conta alheia", /não encontrada/.test(await erroDe(db, `select public.fin_registrar_pagamento($1, '2026-10-01', 1)`, [conta.id])), true);
conferir("outra unidade não cria compra na unidade alheia", /row-level security/.test(await erroDe(db,
  `insert into public.compras (unidade_id, data_compra) values ('seldeestrela', '2026-10-01')`)), true);
await comoUsuario(db, "outra", true);
conferir("quem vê a rede vê os pagamentos", (await db.query(`select count(*)::int n from public.fin_pagamentos`)).rows[0].n, 2);
await db.exec(`reset role;`);
await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
await db.exec(`set role anon;`);
conferir("anon não lê categorias", /permission denied/.test(await erroDe(db, `select * from public.fin_categorias`)), true);
conferir("anon não lê a view de contas", /permission denied/.test(await erroDe(db, `select * from public.vw_fin_contas_pagar`)), true);
conferir("anon não executa RPC de pagamento", /permission denied/.test(await erroDe(db, `select public.fin_registrar_pagamento($1, '2026-10-01', 1)`, [conta.id])), true);
await comoUsuario(db);

// ── 8. contas a receber: bruto ≠ líquido ────────────────────────────────────
const cr = (await db.query(`insert into public.fin_contas_receber (unidade_id, origem_tipo, descricao, meio, data_venda, data_prevista, valor_bruto, valor_taxa_previsto)
  values ('seldeestrela','MANUAL','Venda cartão crédito','credito','2026-09-30','2026-10-30',100,3) returning id, valor_liquido_previsto::float`)).rows[0];
conferir("recebível: bruto 100, taxa 3 → líquido previsto 97", cr.valor_liquido_previsto, 97);
const crSemTaxa = (await db.query(`insert into public.fin_contas_receber (unidade_id, origem_tipo, descricao, meio, data_venda, data_prevista, valor_bruto)
  values ('seldeestrela','MANUAL','Taxa desconhecida','debito','2026-09-30','2026-10-01',50) returning valor_liquido_previsto`)).rows[0];
conferir("taxa não informada → líquido previsto nulo (nunca inventado)", crSemTaxa.valor_liquido_previsto, null);
const rc = (await db.query(`select public.fin_registrar_recebimento($1, '2026-10-01', 97) r`, [cr.id])).rows[0].r;
const vr = (await db.query(`select situacao, valor_bruto::float, liquido_recebido::float from public.vw_fin_contas_receber where id = $1`, [cr.id])).rows[0];
conferir("recebimento de 97 baixa o bruto de 100", [rc.status, vr.situacao, vr.valor_bruto, vr.liquido_recebido], ["recebido", "recebido", 100, 97]);
conferir("taxa efetiva = 3", (await db.query(`select valor_taxa_efetiva::float t from public.fin_recebimentos where id = $1`, [rc.recebimento_id])).rows[0].t, 3);
const fl = (await db.query(`select natureza, direcao, valor::float, origem from public.vw_fin_fluxo_caixa where referencia_id = $1`, [rc.recebimento_id])).rows;
conferir("fluxo de caixa: entrada realizada de 97 (não 100)", fl, [{ natureza: "realizado", direcao: "entrada", valor: 97, origem: "recebimento" }]);
const legadoFluxo = (await db.query(`select count(*)::int n, sum(valor)::float s from public.vw_fin_fluxo_caixa where origem = 'pagamento_legado'`)).rows[0];
conferir("fluxo de caixa: as 2 pagas antigas aparecem como saída legado", [legadoFluxo.n, legadoFluxo.s], [2, 4764.4]);

// ── 9. custo médio ponderado (fonte única) ──────────────────────────────────
const cm = (await db.query(`select public.estoque_custo_medio_novo(0, null, 20, 900)::float a, public.estoque_custo_medio_novo(20, 45, 10, 500)::float b`)).rows[0];
conferir("custo médio: 20 kg por R$ 900 = 45/kg", cm.a, 45);
conferir("custo médio: + 10 kg por R$ 500 = 46,666667/kg", cm.b, 46.666667);

// ── 10. compras ─────────────────────────────────────────────────────────────
const compra = (await db.query(`insert into public.compras (unidade_id, fornecedor_id, numero_documento, data_compra) values ('seldeestrela','11111111-1111-1111-1111-111111111111','NF-1','2026-09-30') returning id`)).rows[0].id;
conferir("confirmar compra sem itens → recusado", /sem itens/.test(await erroDe(db, `update public.compras set status = 'confirmada' where id = $1`, [compra])), true);
await db.query(`insert into public.compras_itens (unidade_id, compra_id, insumo_id, quantidade_embalagens, conteudo_por_embalagem, unidade_base, valor_total)
  values ('seldeestrela', $1, '22222222-2222-2222-2222-222222222222', 20, 1000, 'g', 900)`, [compra]);
conferir("item de outra unidade no documento → recusado", /mesma unidade/.test(await erroDe(db, (await comoDono(db), `insert into public.compras_itens (unidade_id, compra_id, insumo_id, quantidade_embalagens, conteudo_por_embalagem, unidade_base, valor_total)
  values ('outra', '${compra}', '22222222-2222-2222-2222-222222222222', 1, 1, 'g', 1)`))), true);
await comoUsuario(db);
const it = (await db.query(`select quantidade_base::float q, custo_unitario_base::float c from public.compras_itens where compra_id = $1`, [compra])).rows[0];
conferir("item: 20 × 1000 g, R$ 900 → 20.000 g a R$ 0,045/g", [it.q, it.c], [20000, 0.045]);
await db.query(`update public.compras set status = 'confirmada' where id = $1`, [compra]);
conferir("item de compra confirmada não muda", /não aceita alteração/.test(await erroDe(db, `update public.compras_itens set valor_total = 1 where compra_id = $1`, [compra])), true);
conferir("mesma NF do mesmo fornecedor → recusada", /compras_documento/.test(await erroDe(db,
  `insert into public.compras (unidade_id, fornecedor_id, numero_documento, data_compra) values ('seldeestrela','11111111-1111-1111-1111-111111111111','NF-1','2026-09-30')`)), true);
conferir("compra NÃO gera conta nem CMV sozinha", (await db.query(`select count(*)::int n from public.contas_pagar where origem_tipo = 'COMPRA'`)).rows[0].n, 0);

// ── 11. inventário ──────────────────────────────────────────────────────────
const cont = (await db.query(`insert into public.estoque_contagens (unidade_id, tipo, data_referencia) values ('seldeestrela','final','2026-09-30') returning id`)).rows[0].id;
await db.query(`insert into public.estoque_contagens_itens (unidade_id, contagem_id, insumo_id, quantidade_contada, unidade_base) values ('seldeestrela',$1,'22222222-2222-2222-2222-222222222222', 5000, 'g')`, [cont]);
conferir("fechar contagem com item sem custo → recusado", /sem custo/.test(await erroDe(db, `update public.estoque_contagens set status = 'fechada' where id = $1`, [cont])), true);
await db.query(`update public.estoque_contagens_itens set custo_unitario = 0.045 where contagem_id = $1`, [cont]);
await db.query(`update public.estoque_contagens set status = 'fechada' where id = $1`, [cont]);
conferir("contagem fechada: valor do item = 225,00", (await db.query(`select valor_total::float v from public.estoque_contagens_itens where contagem_id = $1`, [cont])).rows[0].v, 225);
conferir("contagem fechada é imutável", /não pode ser alterada/.test(await erroDe(db, `update public.estoque_contagens set observacao = 'x' where id = $1`, [cont])), true);
conferir("item de contagem fechada é imutável", /não aceita alteração/.test(await erroDe(db, `update public.estoque_contagens_itens set quantidade_contada = 1 where contagem_id = $1`, [cont])), true);

// ── 12. verificação prévia (fail-closed) ────────────────────────────────────
{
  const db2 = new PGlite();
  await db2.exec(BASE.replace(/create table public\.fornecedores[^;]+;/, "").replace(/insert into public\.fornecedores[^;]+;/, "")
    .replace(", public.fornecedores", ""));
  const e = await erroDoScript(db2, SQL);
  conferir("sem fornecedores: migration aborta com mensagem", /PREFLIGHT \[S1\/S2\]: public\.fornecedores/.test(e || ""), true);
  conferir("sem fornecedores: nada foi criado", (await db2.query(`select to_regclass('public.fin_categorias') r`)).rows[0].r, null);
  const db3 = new PGlite();
  await db3.exec(BASE + `alter table public.contas_pagar add constraint chk_antigo check (status in ('pendente','pago'));`);
  conferir("CHECK antigo em contas_pagar: aborta [S5]", /PREFLIGHT \[S5\]/.test((await erroDoScript(db3, SQL)) || ""), true);
  const db4 = new PGlite();
  await db4.exec(BASE + `alter table public.contas_pagar add column valor_pago numeric;`);
  conferir("coluna inesperada em contas_pagar: aborta", /colunas inesperadas \(valor_pago\)/.test((await erroDoScript(db4, SQL)) || ""), true);
}

// ── 12b. rollback ───────────────────────────────────────────────────────────
{
  const ROLLBACK = fs.readFileSync(path.join(raiz, "db", "F2_1_FUNDACAO_FINANCEIRA_ROLLBACK.sql"), "utf8");
  await comoDono(db);
  conferir("rollback com dado novo gravado: aborta", /ROLLBACK F2\.1 abortado/.test((await erroDoScript(db, ROLLBACK)) || ""), true);
  const db5 = new PGlite();
  await db5.exec(BASE);
  const antes5 = (await db5.query(`select ${COLS} from public.contas_pagar order by descricao`)).rows;
  await db5.exec(SQL);
  await db5.exec(ROLLBACK);
  const cols5 = (await db5.query(`select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_schema='public' and table_name='contas_pagar'`)).rows[0].c;
  conferir("rollback limpo: contas_pagar volta às 11 colunas", cols5, COLS.replace(/ /g, ""));
  conferir("rollback limpo: 7 registros idênticos",
    JSON.stringify((await db5.query(`select ${COLS} from public.contas_pagar order by descricao`)).rows), JSON.stringify(antes5));
  conferir("rollback limpo: nada da F2.1 sobra", (await db5.query(`select to_regclass('public.fin_pagamentos') a, to_regclass('public.fin_categorias') b`)).rows[0], { a: null, b: null });
  await db5.exec(SQL);
  conferir("depois do rollback a migration roda de novo", (await db5.query(`select count(*)::int n from public.vw_fin_contas_pagar`)).rows[0].n, 7);
}

// ── 13. o arquivo não tem DROP/TRUNCATE/DELETE nem UPDATE fora de função ────
{
  const semComentario = SQL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
  // (REVOKE ... truncate só retira permissão; o proibido são comandos DROP/TRUNCATE)
  conferir("sem comando DROP / TRUNCATE no arquivo", /(^|;|')\s*(drop|truncate)\s/im.test(semComentario), false);
  const foraDeFuncao = semComentario.replace(/\$\$[\s\S]*?\$\$/g, "");
  conferir("nenhum UPDATE/DELETE de dados fora de funções", /^\s*(update|delete\s+from)\b/im.test(foraDeFuncao), false);
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
