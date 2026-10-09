// Testes de COMPRAS → CUSTO MÉDIO → CONTA A PAGAR (F2.4B). Puras + integração
// no Postgres em memória (PGlite) com o SQL REAL da F2.1 + SEC-FIN-2 + a
// proposta db/F2_4B_COMPRAS_CUSTO_MEDIO.sql. Uso:
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/compras-estoque.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  montarItemCompra, divergenciaPedido, totalCompra, resumoCompras, variacaoPct, custoNaUnidade,
  salvarRascunho, confirmarCompra, cancelarCompra, criarFornecedor,
} from "./compras-estoque.mjs";
import { criarContagem, salvarItemContagem, fecharContagem } from "./contagem-estoque.mjs";
import { registrarPagamento } from "./contas-pagar.mjs";
import { criarBancoF21, clienteSupabase } from "./teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};

// ── 1. puras ─────────────────────────────────────────────────────────────────
const picanhaCad = { id: "p", nome: "Picanha", unidade_medida: "kg" };
const m1 = montarItemCompra({ insumo: picanhaCad, quantidade: "20", valor_total: "900" });
conferir("item 20 kg por R$ 900 → 20 × 1000 g, base g, R$ 45/kg", [m1.linha.quantidade_embalagens, m1.linha.conteudo_por_embalagem, m1.linha.unidade_base, m1.quantidade_base, m1.precoPorUnidade], [20, 1000, "g", 20000, 45]);
const m2 = montarItemCompra({ insumo: picanhaCad, embalagens: "2", conteudo: "5", valor_total: "450" });
conferir("item 2 caixas × 5 kg por R$ 450 → 10000 g, R$ 45/kg", [m2.linha.quantidade_embalagens, m2.linha.conteudo_por_embalagem, m2.quantidade_base, m2.precoPorUnidade], [2, 5000, 10000, 45]);
conferir("item cerveja 24 un → base un", montarItemCompra({ insumo: { id: "c", nome: "Cerveja", unidade_medida: "un" }, quantidade: "24", valor_total: "120" }).linha.unidade_base, "un");
conferir("item sem quantidade / sem valor / embalagem sem conteúdo → erro",
  [montarItemCompra({ insumo: picanhaCad, quantidade: "", valor_total: "1" }).erro != null, montarItemCompra({ insumo: picanhaCad, quantidade: "1", valor_total: "" }).erro != null,
   montarItemCompra({ insumo: picanhaCad, embalagens: "2", valor_total: "1" }).erro != null], [true, true, true]);
const dv = divergenciaPedido({ quantidade_embalagens: 18.7, conteudo_por_embalagem: 1000, valor_total: 860.2, quantidade_pedida_embalagens: 20, valor_pedido: 900 }, "kg");
conferir("pedido 20 kg a R$ 45 × recebido 18,7 kg por R$ 860,20 → −1,3 kg e preço +2,22%", [dv.pedida, dv.recebida, dv.diferencaQtd, dv.precoPedido, dv.precoRecebido, dv.variacaoPrecoPct], [20, 18.7, -1.3, 45, 46, 2.22]);
conferir("total da nota = itens + frete − desconto", totalCompra([900, 50], "10", "5"), { itens: 950, total: 955 });
conferir("variação de preço contra o custo médio", [variacaoPct(50, 45), variacaoPct(45, 0)], [11.11, null]);
conferir("custo base → por unidade do cadastro (0,045/g = R$ 45/kg)", custoNaUnidade(0.045, "kg"), 45);

// ── 2. banco: F2.1 + SEC-FIN-2 + F2.4B ──────────────────────────────────────
const extra = `
  alter table public.insumos add column unidade_medida text, add column categoria text;
  alter table public.fornecedores add column ativo boolean default true;
  grant select, insert, update on public.fornecedores to authenticated;
  grant select on public.insumos to authenticated;
`;
const pg = await criarBancoF21(raiz, extra, { secFin2: true, f24b: true });
if (!pg) { console.log("\nPGLITE não informado: integração NÃO executada."); process.exit(falhas ? 1 : 2); }
const db = clienteSupabase(pg);
const outra = clienteSupabase(pg, { unidade: "outra", uid: "44444444-4444-4444-4444-444444444444" });
const U = "seldeestrela";
// "hoje" no fuso de São Paulo, como fin_hoje() no banco (em UTC o teste falhava entre 21h e 24h)
const HOJE = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const VENC = (() => { const d = new Date(); d.setDate(d.getDate() + 10); return d.toISOString().slice(0, 10); })();
const id = async (sql, params = []) => (await pg.query(sql, params)).rows[0].id;
const picanha = await id(`insert into public.insumos (unidade_id, nome, unidade_medida) values ($1,'Picanha','kg') returning id`, [U]);
const arroz = await id(`insert into public.insumos (unidade_id, nome, unidade_medida) values ($1,'Arroz','kg') returning id`, [U]);
const oleo = await id(`insert into public.insumos (unidade_id, nome, unidade_medida) values ($1,'Óleo','L') returning id`, [U]);
const estCozinha = await id(`insert into public.estoques (unidade_id, nome) values ($1,'Cozinha') returning id`, [U]);
const custo = async (insumo) => (await pg.query(`select custo_medio_base::float c, saldo_referencia::float s, unidade_base b, origem_tipo o from public.estoque_custos where unidade_id = $1 and insumo_id = $2`, [U, insumo])).rows[0] || null;
const cab = (extraCab = {}) => ({ unidade_id: U, fornecedor_id: forn.data.id, numero_documento: "NF 123", data_compra: HOJE, data_recebimento: HOJE, forma_pagamento: "boleto", ...extraCab });
const comprar = async (itens, { chave, cabExtra = {}, conta = true, venc = VENC } = {}) => {
  const r = await salvarRascunho(db, { compra: cab({ numero_documento: `NF ${chave}`, ...cabExtra }), itens, chave });
  if (r.error) return r;
  const c = await confirmarCompra(db, { compra_id: r.data.id, gerar_conta_pagar: conta, data_vencimento: venc });
  return { ...c, compra_id: r.data.id };
};
const insP = { id: picanha, nome: "Picanha", unidade_medida: "kg" };

const forn = await criarFornecedor(db, { unidade_id: U, nome: "Frigorífico A" });
conferir("cadastrar fornecedor na hora (0 cadastrados em produção)", [forn.error, forn.data?.nome], [null, "Frigorífico A"]);

// exemplo do dono: 20 kg a R$ 45 + 10 kg por R$ 500 → R$ 46,6667/kg
const c1 = await comprar([{ insumo: insP, estoque_id: estCozinha, quantidade: "20", valor_total: "900" }], { chave: "c1" });
const cab1 = (await pg.query(`select status, confirmada_em is not null conf, confirmada_por, conta_pagar_id, data_vencimento::text v from public.compras where id = $1`, [c1.compra_id])).rows[0];
conferir("compra 1 confirmada: status, quando e quem", [c1.error, cab1.status, cab1.conf, cab1.confirmada_por], [null, "confirmada", true, "33333333-3333-3333-3333-333333333333"]);
conferir("compra 1: custo médio R$ 45/kg (0,045/g), saldo de referência 20 kg, origem COMPRA", await custo(picanha), { c: 0.045, s: 20000, b: "g", o: "COMPRA" });
const conta1 = (await pg.query(`select valor::float valor, status, categoria, categoria_codigo, origem_tipo, origem_id, fornecedor_id, documento_numero, competencia::text comp, data_vencimento::text venc, descricao
  from public.contas_pagar where id = $1`, [cab1.conta_pagar_id])).rows[0];
conferir("compra 1 gerou CONTA A PAGAR: R$ 900, pendente, mercadoria (não é despesa), origem COMPRA, NF, vencimento",
  [conta1.valor, conta1.status, conta1.categoria_codigo, conta1.categoria, conta1.origem_tipo, conta1.origem_id === c1.compra_id, conta1.fornecedor_id === forn.data.id, conta1.documento_numero, conta1.comp === `${HOJE.slice(0, 7)}-01`, conta1.venc],
  [900, "pendente", "mercadoria_insumos", "cmv", "COMPRA", true, true, "NF c1", true, VENC]);
conferir("descrição da conta", conta1.descricao, "Compra NF NF c1 — Frigorífico A");
conferir("mesma NF do mesmo fornecedor lançada de novo → recusada com aviso claro",
  /já existe uma compra com o documento "NF c1"/i.test((await salvarRascunho(db, { compra: cab({ numero_documento: "NF c1" }), itens: [{ insumo: insP, quantidade: "1", valor_total: "1" }], chave: "outra-chave" })).error || ""), true);
const c2 = await comprar([{ insumo: insP, estoque_id: estCozinha, quantidade: "10", valor_total: "500" }], { chave: "c2" });
const cu2 = await custo(picanha);
conferir("compra 2: (20 kg × 45 + 500) / 30 kg = R$ 46,6667/kg; saldo 30 kg", [c2.error, custoNaUnidade(cu2.c, "kg"), cu2.s], [null, 46.667, 30000]);
const hist = (await pg.query(`select origem_tipo, saldo_anterior::float sa, custo_medio_anterior::float ca, quantidade::float q, valor::float v, custo_entrada::float ce, saldo_novo::float sn, custo_medio_novo::float cn
  from public.estoque_custos_historico where insumo_id = $1 order by seq`, [picanha])).rows;
conferir("histórico do custo: antes → depois de cada compra", hist.map((h) => [h.origem_tipo, h.sa, h.ca, h.q, h.v, h.ce, h.sn, h.cn]),
  [["COMPRA", null, null, 20000, 900, 0.045, 20000, 0.045], ["COMPRA", 20000, 0.045, 10000, 500, 0.05, 30000, 0.046667]]);

// idempotência e imutabilidade
const again = await confirmarCompra(db, { compra_id: c2.compra_id, gerar_conta_pagar: true, data_vencimento: VENC });
conferir("confirmar de novo (clique duplo) → nada duplica", [again.data?.idempotente, (await pg.query(`select count(*)::int n from public.contas_pagar where origem_id = $1`, [c2.compra_id])).rows[0].n, (await pg.query(`select count(*)::int n from public.estoque_custos_historico where origem_id = $1`, [c2.compra_id])).rows[0].n], [true, 1, 1]);
const dup1 = await salvarRascunho(db, { compra: cab({ numero_documento: "NF c1" }), itens: [{ insumo: insP, quantidade: "1", valor_total: "1" }], chave: "c1" });
conferir("salvar rascunho com a mesma chave → devolve a compra já criada", [dup1.data?.id === c1.compra_id, dup1.data?.idempotente], [true, true]);
conferir("compra confirmada não volta a ser rascunho editável", /não é mais rascunho/.test((await salvarRascunho(db, { compra: { ...cab(), id: c1.compra_id }, itens: [{ insumo: insP, quantidade: "1", valor_total: "1" }] })).error || ""), true);
conferir("item de compra confirmada não pode ser apagado (trigger)", !!(await db.from("compras_itens").delete().eq("compra_id", c1.compra_id)).error, true);
conferir("app não escreve no custo médio direto", !!(await db.from("estoque_custos").update({ custo_medio_base: 1 }).eq("insumo_id", picanha)).error, true);

// rascunho editável
const rz = await salvarRascunho(db, { compra: cab({ numero_documento: "NF rz" }), itens: [{ insumo: insP, quantidade: "1", valor_total: "40" }, { insumo: { id: arroz, nome: "Arroz", unidade_medida: "kg" }, quantidade: "5", valor_total: "25" }], chave: "rz" });
const rz2 = await salvarRascunho(db, { compra: { ...cab({ numero_documento: "NF rz" }), id: rz.data.id }, itens: [{ insumo: { id: arroz, nome: "Arroz", unidade_medida: "kg" }, quantidade: "10", valor_total: "50" }] });
conferir("rascunho: trocar os itens substitui por inteiro (sem confirmar, custo não muda)",
  [rz2.error, (await pg.query(`select count(*)::int n from public.compras_itens where compra_id = $1`, [rz.data.id])).rows[0].n, await custo(arroz)], [null, 1, null]);

// vencimento obrigatório, frete rateado, desconto maior que valor
conferir("gerar conta sem vencimento → recusado e a compra continua rascunho",
  [/vencimento/.test((await confirmarCompra(db, { compra_id: rz.data.id, gerar_conta_pagar: true, data_vencimento: null })).error || ""),
   (await pg.query(`select status from public.compras where id = $1`, [rz.data.id])).rows[0].status, await custo(arroz)], [true, "rascunho", null]);
const c3 = await comprar([{ insumo: { id: arroz, nome: "Arroz", unidade_medida: "kg" }, quantidade: "10", valor_total: "50" }], { chave: "c3", cabExtra: { valor_frete: "5" } });
conferir("frete entra no custo: arroz 10 kg R$ 50 + frete R$ 5 → R$ 5,50/kg; conta R$ 55",
  [c3.error, custoNaUnidade((await custo(arroz)).c, "kg"), (await pg.query(`select valor::float v from public.contas_pagar where origem_id = $1`, [c3.compra_id])).rows[0].v], [null, 5.5, 55]);
const cd = await comprar([{ insumo: { id: arroz, nome: "Arroz", unidade_medida: "kg" }, quantidade: "1", valor_total: "5" }], { chave: "cd", cabExtra: { valor_desconto: "10" } });
conferir("desconto maior que o valor → recusado", /desconto/.test(cd.error || ""), true);
const sc = await comprar([{ insumo: { id: arroz, nome: "Arroz", unidade_medida: "kg" }, quantidade: "10", valor_total: "60" }], { chave: "sc", conta: false });
conferir("compra sem gerar conta (pago na hora): custo atualiza, nenhuma conta", [sc.error, sc.data?.conta_pagar_id ?? null, custoNaUnidade((await custo(arroz)).c, "kg")], [null, null, 5.75]);

// unidade incompatível
await pg.query(`update public.insumos set unidade_medida = 'un' where id = $1`, [arroz]);
const ui = await comprar([{ insumo: { id: arroz, nome: "Arroz", unidade_medida: "un" }, quantidade: "3", valor_total: "15" }], { chave: "ui" });
conferir("produto com custo em g recebido em 'un' → recusado; nada muda (compra continua rascunho, sem conta)",
  [/incompatível/.test(ui.error || ""), (await pg.query(`select status from public.compras where id = $1`, [ui.compra_id])).rows[0].status, (await pg.query(`select count(*)::int n from public.contas_pagar where origem_id = $1`, [ui.compra_id])).rows[0].n],
  [true, "rascunho", 0]);
await pg.query(`update public.insumos set unidade_medida = 'kg' where id = $1`, [arroz]);

// cancelamento
const contaC2 = (await pg.query(`select conta_pagar_id from public.compras where id = $1`, [c2.compra_id])).rows[0].conta_pagar_id;
const x2 = await cancelarCompra(db, { compra_id: c2.compra_id, motivo: "nota lançada em dobro" });
const contaX2 = (await pg.query(`select status, motivo_cancelamento m from public.contas_pagar where id = $1`, [contaC2])).rows[0];
conferir("cancelar a compra mais recente → custo volta a R$ 45/kg e 20 kg; conta cancelada com motivo; compra cancelada",
  [x2.error, await custo(picanha), contaX2.status, contaX2.m, (await pg.query(`select status from public.compras where id = $1`, [c2.compra_id])).rows[0].status],
  [null, { c: 0.045, s: 20000, b: "g", o: "AJUSTE" }, "cancelado", "Compra cancelada: nota lançada em dobro", "cancelada"]);
conferir("histórico guarda o estorno (nada apagado)", (await pg.query(`select origem_tipo, quantidade::float q from public.estoque_custos_historico where insumo_id = $1 order by seq`, [picanha])).rows.map((h) => `${h.origem_tipo}:${h.q}`),
  ["COMPRA:20000", "COMPRA:10000", "ESTORNO_COMPRA:-10000"]);
const x1 = await cancelarCompra(db, { compra_id: c1.compra_id, motivo: "teste" });
conferir("depois, cancelar a anterior também → sem custo (era a primeira)", [x1.error, await custo(picanha)], [null, null]);
const c4 = await comprar([{ insumo: insP, quantidade: "10", valor_total: "450" }], { chave: "c4" });
const c5 = await comprar([{ insumo: insP, quantidade: "10", valor_total: "470" }], { chave: "c5" });
conferir("cancelar compra com compra POSTERIOR do mesmo produto → recusado (custo já seguiu)", /posterior/.test((await cancelarCompra(db, { compra_id: c4.compra_id, motivo: "x" })).error || ""), true);
const contaC5 = (await pg.query(`select conta_pagar_id from public.compras where id = $1`, [c5.compra_id])).rows[0].conta_pagar_id;
const pg5 = await registrarPagamento(db, { conta_pagar_id: contaC5, pago_em: HOJE, valor_principal: 100, chave: "pg-c5" });
conferir("pagar parte da conta da compra 5", pg5.error, null);
conferir("cancelar compra com conta já paga (parcial) → recusado", /pagamento/.test((await cancelarCompra(db, { compra_id: c5.compra_id, motivo: "x" })).error || ""), true);
conferir("cancelar sem motivo → recusado", !!(await cancelarCompra(db, { compra_id: c5.compra_id, motivo: "" })).error, true);

// inventário fechado alimenta o custo
const ct = await criarContagem(db, { unidade_id: U, tipo: "inicial", data_referencia: HOJE });
const ip = await salvarItemContagem(db, { contagem_id: ct.data.id, unidade_id: U, insumo_id: picanha, estoque_id: estCozinha, quantidade: "8,350", unidade_medida: "kg" });
const io = await salvarItemContagem(db, { contagem_id: ct.data.id, unidade_id: U, insumo_id: oleo, estoque_id: estCozinha, quantidade: "14", unidade_medida: "L" });
const fx = await fecharContagem(db, { contagem_id: ct.data.id, itens: [{ id: ip.data.id, insumo_id: picanha, quantidade_contada: 8350 }, { id: io.data.id, insumo_id: oleo, quantidade_contada: 14000 }],
  unidadesPorInsumo: { [picanha]: "kg", [oleo]: "L" }, custos: { [ip.data.id]: { porUnidade: "46" }, [io.data.id]: { porUnidade: "9" } }, confirmado: true });
conferir("fechar inventário continua funcionando com o gatilho de custo", fx.error, null);
conferir("inventário fechado: picanha (já tinha custo médio) → saldo de referência = 8,350 kg contados, custo médio mantido",
  await custo(picanha), { c: 0.046, s: 8350, b: "g", o: "CONTAGEM" });
conferir("inventário fechado: óleo (sem custo antes) → custo inicial = custo congelado na contagem (R$ 9/L), saldo 14 L",
  await custo(oleo), { c: 0.009, s: 14000, b: "ml", o: "CONTAGEM" });
const c6 = await comprar([{ insumo: { id: oleo, nome: "Óleo", unidade_medida: "L" }, quantidade: "14", valor_total: "140" }], { chave: "c6" });
conferir("compra depois do inventário: óleo (14 L × 9 + 140) / 28 L = R$ 9,50/L", [c6.error, custoNaUnidade((await custo(oleo)).c, "L"), (await custo(oleo)).s], [null, 9.5, 28000]);

// isolamento e permissões
conferir("outra unidade não confirma compra alheia", /não encontrada/.test((await confirmarCompra(outra, { compra_id: rz.data.id, gerar_conta_pagar: false })).error || ""), true);
conferir("outra unidade não vê histórico de custo", (await outra.from("estoque_custos_historico").select("id")).data.length, 0);
const anon = clienteSupabase(pg, { uid: null });
conferir("anônimo não chama a confirmação", !!(await anon.rpc("compras_confirmar", { p_compra_id: rz.data.id })).error, true);
conferir("funções internas de custo não são chamáveis pelo app",
  /permission denied/.test((await db.rpc("estoque_custo_aplicar_contagem", { p_contagem_id: ct.data.id })).error?.message || ""), true);

// ── 3. migration: conferência, repetição, inventário anterior, rollback ─────
const SQL = fs.readFileSync(path.join(raiz, "db", "F2_4B_COMPRAS_CUSTO_MEDIO.sql"), "utf8");
const CONFERENCIA = SQL.match(/\/\* ── CONFERÊNCIA[^\n]*\n([\s\S]*?)\n\s*─+ \*\//)[1];
const ROLLBACK = SQL.match(/\/\* ── ROLLBACK[^\n]*\n([\s\S]*?)\n\s*─+ \*\//)[1].replace(/^[^\n]*\n[^\n]*\n[^\n]*\n/, "");
const conf = (await pg.query(CONFERENCIA)).rows.map((r) => `${r.t}:${r.i}`);
conferir("conferência pós-migration: 6 colunas, 4 funções e o trigger", conf.filter((x) => !x.startsWith("custos")).length, 11);
let erroRepetir = null; try { await pg.exec(SQL); } catch (e) { erroRepetir = e.message; await pg.exec("rollback"); }
conferir("rodar a migration de novo não quebra nem mexe no custo", [erroRepetir, custoNaUnidade((await custo(oleo)).c, "L")], [null, 9.5]);
{
  // inventário fechado ANTES da migration inicializa o custo na hora de aplicar
  const pg2 = await criarBancoF21(raiz, extra, { secFin2: true });
  const db2 = clienteSupabase(pg2);
  const ins2 = (await pg2.query(`insert into public.insumos (unidade_id, nome, unidade_medida) values ($1,'Feijão','kg') returning id`, [U])).rows[0].id;
  const k = await criarContagem(db2, { unidade_id: U, tipo: "inicial", data_referencia: HOJE });
  const it = await salvarItemContagem(db2, { contagem_id: k.data.id, unidade_id: U, insumo_id: ins2, quantidade: "5", unidade_medida: "kg" });
  await fecharContagem(db2, { contagem_id: k.data.id, itens: [{ id: it.data.id, insumo_id: ins2, quantidade_contada: 5000 }], unidadesPorInsumo: { [ins2]: "kg" }, custos: { [it.data.id]: { porUnidade: "8" } }, confirmado: true });
  await pg2.exec(SQL);
  conferir("inventário fechado antes da migration → custo inicial criado ao aplicar (R$ 8/kg, 5 kg)",
    (await pg2.query(`select custo_medio_base::float c, saldo_referencia::float s, origem_tipo o from public.estoque_custos where insumo_id = $1`, [ins2])).rows[0], { c: 0.008, s: 5000, o: "CONTAGEM" });
  await pg2.exec(ROLLBACK);
  const sobra = (await pg2.query(`select (select count(*)::int from pg_proc where proname in ('compras_confirmar','compras_cancelar','estoque_custo_registrar_entrada','estoque_custo_aplicar_contagem')) f,
    (select count(*)::int from information_schema.columns where table_name = 'compras' and column_name in ('data_recebimento','forma_pagamento','data_vencimento')) c,
    to_regclass('public.estoque_custos_historico') is null h`)).rows[0];
  conferir("rollback: funções, colunas novas e histórico removidos", sobra, { f: 0, c: 0, h: true });
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
