// Testes da F2.3 (Contas a Receber, recebimentos, cartões, contas financeiras, fluxo).
// Rode com: PGLITE=<caminho de @electric-sql/pglite> node app/lib/contas-receber.test.mjs
// A camada roda contra o SQL REAL da F2.1 num Postgres em memória (PGlite).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  escolherTaxa, calcularTaxa, montarRecebiveis, validarRecebivel, criarContaReceber, editarContaReceber,
  registrarRecebimento, estornarRecebimento, cancelarContaReceber, criarContaFinanceira, editarContaFinanceira,
  criarTaxa, encerrarTaxa, resumoReceber, resumoFluxo, anexarBrutoSemTaxa, podeReceber, podeCancelarReceber,
  sugerirBaixa, ajustarBaixa, avaliarBaixa,
} from "./contas-receber.mjs";
import { registrarPagamento, criarContaPagar } from "./contas-pagar.mjs";
import { criarBancoF21, clienteSupabase } from "./teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};

// ── 1. puras ─────────────────────────────────────────────────────────────────
const regras = [
  { id: "g", meio: "credito", adquirente: null, bandeira: null, modalidade: "a_vista", parcelas_min: 1, parcelas_max: 1, taxa_percentual: 4, taxa_fixa: 0, dias_para_recebimento: 30, vigente_desde: "2026-01-01", ativa: true },
  { id: "s", meio: "credito", adquirente: "Stone", bandeira: "Visa", modalidade: "a_vista", parcelas_min: 1, parcelas_max: 1, taxa_percentual: 3, taxa_fixa: 0, dias_para_recebimento: 30, vigente_desde: "2026-01-01", ativa: true },
  { id: "x", meio: "credito", adquirente: "Stone", bandeira: "Visa", modalidade: "a_vista", parcelas_min: 1, parcelas_max: 1, taxa_percentual: 9, taxa_fixa: 0, dias_para_recebimento: 30, vigente_desde: "2026-01-01", ativa: false },
];
conferir("taxa: regra mais específica ganha (Stone/Visa 3%)", escolherTaxa(regras, { meio: "credito", adquirente: "stone", bandeira: "VISA", data: "2026-10-01" })?.id, "s");
conferir("taxa: sem adquirente cai na regra genérica", escolherTaxa(regras, { meio: "credito", adquirente: "Cielo", data: "2026-10-01" })?.id, "g");
conferir("taxa: meio sem cadastro → nenhuma (não inventa)", escolherTaxa(regras, { meio: "debito", data: "2026-10-01" }), null);
conferir("taxa: regra encerrada não vale", escolherTaxa(regras.filter((r) => r.id === "x"), { meio: "credito", adquirente: "Stone", bandeira: "Visa", data: "2026-10-01" }), null);
conferir("taxa: 3% de 100 = 3,00", calcularTaxa(regras[1], 100), 3);
conferir("taxa sem regra = null (não informada)", calcularTaxa(null, 100), null);
const m3 = montarRecebiveis({ valorBruto: 300, valorTaxa: 9, recebiveis: 3, primeiraPrevisao: "2026-10-30" });
conferir("3 recebíveis: bruto 100 cada, taxa 3 cada, mês a mês", m3.map((l) => [l.valor_bruto, l.valor_taxa_previsto, l.data_prevista]),
  [[100, 3, "2026-10-30"], [100, 3, "2026-11-30"], [100, 3, "2026-12-30"]]);
conferir("validação: previsão antes da venda recusada", validarRecebivel({ descricao: "x", valor_bruto: 10, data_venda: "2026-10-10", data_prevista: "2026-10-01", meio: "pix" }).ok, false);

// ── 2. banco simulado ────────────────────────────────────────────────────────
// SEC_FIN_2=1 roda a suíte inteira com a correção de menor privilégio aplicada
const SEC_FIN_2 = process.env.SEC_FIN_2 === "1";
console.log(`(privilégios: padrão Supabase + F2.1${SEC_FIN_2 ? " + SEC-FIN-2" : " — estado de produção em 01/10"})`);
const pg = await criarBancoF21(raiz, "", { secFin2: SEC_FIN_2 });
if (!pg) { console.log("\nPGLITE não informado: integração NÃO executada."); process.exit(2); }
const db = clienteSupabase(pg);
const U = "seldeestrela";
const HOJE = new Date().toISOString().slice(0, 10);
const ver = async (id) => (await pg.query(`select * from public.vw_fin_contas_receber where id = $1`, [id])).rows[0];
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
const listar = async () => (await pg.query(`select * from public.vw_fin_contas_receber where unidade_id = $1`, [U])).rows
  .map((r) => ({ ...r, data_venda: iso(r.data_venda), data_prevista: iso(r.data_prevista) }));

// ── 3. cenário obrigatório: 1.000 → 400 → 600 → estorno 600 ──────────────────
const c1 = await criarContaReceber(db, { unidade_id: U, descricao: "Evento — casamento", meio: "pix", valor_bruto: "1.000,00", data_venda: HOJE, data_prevista: HOJE }, { chave: "rec-1" });
const v1 = await ver(c1.data[0]);
conferir("manual R$ 1.000: origem MANUAL, previsto, taxa não informada", [c1.error, v1.origem_tipo, v1.situacao, Number(v1.valor_bruto), v1.taxa_nao_informada, v1.valor_liquido_previsto], [null, "MANUAL", "previsto", 1000, true, null]);
const r1 = await registrarRecebimento(db, { conta_receber_id: c1.data[0], recebido_em: HOJE, valor_bruto_baixado: 400, valor_liquido_recebido: 400, saldo_bruto: 1000, chave: "rcb-1" });
const v2 = await ver(c1.data[0]);
conferir("receber 400 → PARCIAL, recebido 400, saldo 600", [r1.error, v2.situacao, Number(v2.liquido_recebido), Number(v2.saldo_bruto)], [null, "parcial", 400, 600]);
const r2 = await registrarRecebimento(db, { conta_receber_id: c1.data[0], recebido_em: HOJE, valor_bruto_baixado: 600, valor_liquido_recebido: 600, saldo_bruto: 600, chave: "rcb-2" });
const v3 = await ver(c1.data[0]);
conferir("receber 600 → RECEBIDO, recebido 1.000, saldo 0", [r2.error, v3.situacao, Number(v3.liquido_recebido), Number(v3.saldo_bruto)], [null, "recebido", 1000, 0]);
conferir("estorno sem motivo → recusado", !!(await estornarRecebimento(db, { recebimento_id: r2.data.recebimento_id, motivo: "" })).error, true);
const e1 = await estornarRecebimento(db, { recebimento_id: r2.data.recebimento_id, motivo: "PIX devolvido" });
const v4 = await ver(c1.data[0]);
conferir("estornar 600 → PARCIAL, saldo 600", [e1.error, v4.situacao, Number(v4.saldo_bruto), Number(v4.liquido_recebido)], [null, "parcial", 600, 400]);
const hist = (await pg.query(`select valor_liquido_recebido::float v, estornado_em is not null est, motivo_estorno, estornado_por, criado_por from public.fin_recebimentos where conta_receber_id = $1 order by created_at`, [c1.data[0]])).rows;
conferir("histórico: os 2 recebimentos visíveis; o 2º estornado com motivo e autor",
  hist.map((h) => [h.v, h.est, h.motivo_estorno, h.estornado_por, h.criado_por]),
  [[400, false, null, null, "33333333-3333-3333-3333-333333333333"], [600, true, "PIX devolvido", "33333333-3333-3333-3333-333333333333", "33333333-3333-3333-3333-333333333333"]]);
conferir("recebimento estornado não é apagado nem estornado de novo", !!(await estornarRecebimento(db, { recebimento_id: r2.data.recebimento_id, motivo: "x" })).error, true);

// ── 3b. CORREÇÃO 01/10: estorno não vira taxa nem quita (cenário de produção) ─
// Em produção o modal vinha com "bruto baixado" = saldo inteiro; digitando só o
// líquido (0,40), o banco gravou bruto 1,00 / líquido 0,40 → "taxa" 0,60 e
// conta RECEBIDA. Aqui o fluxo passa pelas MESMAS funções do modal.
{
  // unidade própria: não mexe nos totais "de hoje" que as seções seguintes conferem
  const UC = "correcao";
  await pg.query("insert into public.unidades values ($1, $2)", [UC, "Correção"]);
  const dbc = clienteSupabase(pg, { unidade: UC });
  const fluxoRealizado = async (contaId) => (await pg.query(`select coalesce(sum(f.valor), 0)::float s from public.vw_fin_fluxo_caixa f
     join public.fin_recebimentos r on r.id = f.referencia_id where f.origem = 'recebimento' and r.conta_receber_id = $1`, [contaId])).rows[0].s;
  const recs = async (contaId) => (await pg.query(`select id, conta_receber_id, recebido_em::text recebido_em, valor_bruto_baixado::float valor_bruto_baixado,
     valor_liquido_recebido::float valor_liquido_recebido, valor_taxa_efetiva::float valor_taxa_efetiva, estornado_em
     from public.fin_recebimentos where conta_receber_id = $1 order by created_at`, [contaId])).rows;
  // o que o modal manda: abre, digita só o líquido, confirma
  const pelaTela = async (contaId, liquido, chave) => {
    const conta = await ver(contaId);
    const campos = ajustarBaixa(conta, sugerirBaixa(conta), "valor_liquido_recebido", liquido);
    const b = avaliarBaixa(conta, campos);
    const r = await registrarRecebimento(dbc, { ...campos, conta_receber_id: contaId, recebido_em: HOJE, saldo_bruto: conta.saldo_bruto, chave, taxa_confirmada: !b.precisaConfirmarTaxa });
    return { r, campos, b };
  };
  const nova = async (chave, extra = {}) => (await criarContaReceber(dbc, { unidade_id: UC, descricao: `Correção ${chave}`, meio: "pix", valor_bruto: "1,00", data_venda: HOJE, data_prevista: HOJE, ...extra }, { chave })).data[0];
  const estado = async (id) => { const v = await ver(id); return [v.situacao, Number(v.bruto_baixado), Number(v.liquido_recebido), Number(v.saldo_bruto)]; };

  const k = await nova("cx-prod");
  const t1 = await pelaTela(k, "0,40", "cx-r1");
  conferir("modal sem taxa: abre com bruto e líquido vazios (nada pré-quitado)", [sugerirBaixa(await ver(k)).valor_bruto_baixado, sugerirBaixa(await ver(k)).valor_liquido_recebido], ["", ""]);
  conferir("modal sem taxa: digitar 0,40 → bruto acompanha 0,40, taxa 0, sem confirmação, conta ficará PARCIAL",
    [t1.campos.valor_bruto_baixado, t1.b.taxa, t1.b.precisaConfirmarTaxa, t1.b.quita], ["0,40", 0, false, false]);
  conferir("recebe 0,40 → PARCIAL, saldo 0,60", [t1.r.error, ...(await estado(k))], [null, "parcial", 0.4, 0.4, 0.6]);
  const t2 = await pelaTela(k, "0,60", "cx-r2");
  conferir("recebe 0,60 → RECEBIDO, saldo 0", [t2.r.error, ...(await estado(k))], [null, "recebido", 1, 1, 0]);
  const e = await estornarRecebimento(dbc, { recebimento_id: t2.r.data.recebimento_id, motivo: "teste de estorno" });
  conferir("estorna 0,60 → PARCIAL, recebido ativo 0,40, saldo 0,60", [e.error, ...(await estado(k))], [null, "parcial", 0.4, 0.4, 0.6]);
  conferir("estorno: fluxo realizado da conta = 0,40", await fluxoRealizado(k), 0.4);
  const h = await recs(k);
  conferir("estorno: o de 0,60 continua no histórico como ESTORNADO; nenhuma taxa gravada",
    h.map((r) => [r.valor_bruto_baixado, r.valor_liquido_recebido, r.valor_taxa_efetiva, r.estornado_em != null]), [[0.4, 0.4, 0, false], [0.6, 0.6, 0, true]]);
  const card = resumoReceber([await ver(k)], h, { de: HOJE, ate: HOJE });
  conferir("card: recebido 0,40, bruto baixado 0,40, taxas NÃO INFORMADAS (não R$ 0,60, não 'R$ 0,00 de taxa')",
    [card.recebidoLiquido, card.recebidoBruto, card.taxasEfetivas, card.taxasNaoInformadas], [0.4, 0.4, 0, true]);
  const v = await ver(k);
  conferir("conta: taxa prevista continua NÃO INFORMADA", [v.taxa_nao_informada, v.valor_taxa_previsto, v.valor_liquido_previsto], [true, null, null]);

  // o que causou o erro não passa mais: bruto = saldo com líquido menor, sem confirmar
  const k2 = await nova("cx-antigo");
  const antigo = await registrarRecebimento(dbc, { conta_receber_id: k2, recebido_em: HOJE, valor_bruto_baixado: "1,00", valor_liquido_recebido: "0,40", saldo_bruto: 1, chave: "cx-a1" });
  conferir("bruto 1,00 / líquido 0,40 sem confirmar taxa → RECUSADO (0,60 não vira taxa)", [/seria registrada como TAXA/.test(antigo.error || ""), ...(await estado(k2))], [true, "previsto", 0, 0, 1]);
  conferir("sem bruto baixado → RECUSADO (o banco quitaria o saldo inteiro)", /Informe o bruto baixado/.test((await registrarRecebimento(dbc, { conta_receber_id: k2, recebido_em: HOJE, valor_liquido_recebido: "0,40", saldo_bruto: 1, chave: "cx-a2" })).error || ""), true);
  conferir("modal: bruto editado para 1,00 com líquido 0,97 em conta sem taxa → pede confirmação",
    avaliarBaixa(await ver(k2), ajustarBaixa(await ver(k2), ajustarBaixa(await ver(k2), sugerirBaixa(await ver(k2)), "valor_liquido_recebido", "0,97"), "valor_bruto_baixado", "1,00")).precisaConfirmarTaxa, true);
  const explicita = await registrarRecebimento(dbc, { conta_receber_id: k2, recebido_em: HOJE, valor_bruto_baixado: "1,00", valor_liquido_recebido: "0,97", saldo_bruto: 1, chave: "cx-a3", taxa_confirmada: true });
  conferir("taxa EXPLÍCITA confirmada pelo usuário (0,03) → aceita, RECEBIDO", [explicita.error, ...(await estado(k2)), (await recs(k2))[0].valor_taxa_efetiva], [null, "recebido", 1, 0.97, 0, 0.03]);

  // estornar o PRIMEIRO
  const k3 = await nova("cx-primeiro");
  const p1 = await pelaTela(k3, "0,40", "cx-p1"); await pelaTela(k3, "0,60", "cx-p2");
  await estornarRecebimento(dbc, { recebimento_id: p1.r.data.recebimento_id, motivo: "primeiro errado" });
  conferir("estornar o PRIMEIRO (0,40) → PARCIAL, ativo 0,60, saldo 0,40, fluxo 0,60", [...(await estado(k3)), await fluxoRealizado(k3)], ["parcial", 0.6, 0.6, 0.4, 0.6]);

  // estornar TODOS
  const k4 = await nova("cx-todos");
  const q1 = await pelaTela(k4, "0,40", "cx-q1"); const q2 = await pelaTela(k4, "0,60", "cx-q2");
  await estornarRecebimento(dbc, { recebimento_id: q1.r.data.recebimento_id, motivo: "x" });
  await estornarRecebimento(dbc, { recebimento_id: q2.r.data.recebimento_id, motivo: "x" });
  const c4 = resumoReceber([await ver(k4)], await recs(k4), { de: HOJE, ate: HOJE });
  conferir("estornar TODOS → PREVISTO, nada baixado, saldo 1,00, fluxo 0, card 0 recebido / sem taxa",
    [...(await estado(k4)), await fluxoRealizado(k4), c4.recebidoLiquido, c4.recebidoBruto, c4.taxasEfetivas, c4.taxasNaoInformadas, (await recs(k4)).length], ["previsto", 0, 0, 1, 0, 0, 0, 0, false, 2]);
  conferir("depois de estornar tudo, recebe de novo normalmente", (await pelaTela(k4, "1,00", "cx-q3")).r.error, null);

  // MÚLTIPLOS recebimentos, estorno do meio
  const k5 = await nova("cx-multi");
  await pelaTela(k5, "0,30", "cx-m1"); const m2 = await pelaTela(k5, "0,30", "cx-m2"); await pelaTela(k5, "0,40", "cx-m3");
  conferir("múltiplos: 0,30 + 0,30 + 0,40 → RECEBIDO", await estado(k5), ["recebido", 1, 1, 0]);
  await estornarRecebimento(dbc, { recebimento_id: m2.r.data.recebimento_id, motivo: "x" });
  conferir("múltiplos: estorna o do meio → PARCIAL, ativo 0,70, saldo 0,30, fluxo 0,70", [...(await estado(k5)), await fluxoRealizado(k5)], ["parcial", 0.7, 0.7, 0.3, 0.7]);

  // taxa REAL (cadastrada): baixa parcial pela tela — bruto acompanha na proporção da taxa
  const kc = (await criarContaReceber(dbc, { unidade_id: UC, descricao: "Correção cartão", meio: "credito", valor_bruto: 100, data_venda: HOJE, data_prevista: HOJE, modo_taxa: "informada", valor_taxa: "3" }, { chave: "cx-card" })).data[0];
  const pc = await pelaTela(kc, "48,50", "cx-c1");
  conferir("taxa real: digitar 48,50 líquido → bruto 50,00, taxa 1,50 (= prevista), sem confirmação",
    [pc.campos.valor_bruto_baixado, pc.b.taxa, pc.b.taxaPrevista, pc.b.precisaConfirmarTaxa, pc.r.error], ["50,00", 1.5, 1.5, false, null]);
  conferir("taxa real: PARCIAL, saldo 50, taxa efetiva 1,50 gravada", [...(await estado(kc)), (await recs(kc))[0].valor_taxa_efetiva], ["parcial", 50, 48.5, 50, 1.5]);
  const pc2 = await pelaTela(kc, "48,50", "cx-c2");
  await estornarRecebimento(dbc, { recebimento_id: pc2.r.data.recebimento_id, motivo: "x" });
  const cc = resumoReceber([await ver(kc)], await recs(kc), { de: HOJE, ate: HOJE });
  conferir("taxa real: estorno da 2ª baixa → PARCIAL, saldo 50; card só conta a taxa da baixa ativa (1,50), taxa informada",
    [...(await estado(kc)), cc.taxasEfetivas, cc.taxasNaoInformadas], ["parcial", 50, 48.5, 50, 1.5, false]);
}

// ── 4. cartão: bruto ≠ líquido ───────────────────────────────────────────────
const t1 = await criarTaxa(db, { unidade_id: U, meio: "credito", adquirente: "Stone", bandeira: "Visa", modalidade: "a_vista", parcelas_min: 1, parcelas_max: 1, taxa_percentual: "3", dias_para_recebimento: 30, vigente_desde: "2026-01-01" });
conferir("cadastrar taxa Stone crédito Visa 1x 3% D+30", t1.error, null);
const regrasDb = (await pg.query(`select * from public.fin_taxas_meio_pagamento`)).rows.map((r) => ({ ...r, vigente_desde: iso(r.vigente_desde), vigente_ate: iso(r.vigente_ate) }));
const venda = await criarContaReceber(db, { unidade_id: U, descricao: "Venda cartão", meio: "credito", valor_bruto: 100, data_venda: "2026-09-30", data_prevista: "2026-10-30",
  adquirente: "Stone", bandeira: "Visa", modalidade: "a_vista", parcelas_venda: 1, modo_taxa: "regra" }, { chave: "rec-card", regras: regrasDb });
const vc = await ver(venda.data[0]);
conferir("venda 100 crédito Visa/Stone: taxa 3, líquido previsto 97, previsão 30/10", [venda.error, Number(vc.valor_taxa_previsto), Number(vc.valor_liquido_previsto), iso(vc.data_prevista)], [null, 3, 97, "2026-10-30"]);
conferir("taxa pelo cadastro sem regra para débito → recusado (não inventa)",
  /Nenhuma taxa cadastrada/.test((await criarContaReceber(db, { unidade_id: U, descricao: "x", meio: "debito", valor_bruto: 50, data_venda: HOJE, data_prevista: HOJE, modo_taxa: "regra" }, { chave: "rec-d", regras: regrasDb })).error), true);
const banco = await criarContaFinanceira(db, { unidade_id: U, nome: "Banco X", tipo: "banco", saldo_inicial: "0,00", saldo_inicial_em: "2026-01-01" });
const vcBaixa = avaliarBaixa(vc, sugerirBaixa(vc));
conferir("modal com taxa cadastrada: sugere bruto 100 / líquido 97, taxa = prevista, sem pedir confirmação",
  [sugerirBaixa(vc).valor_bruto_baixado, sugerirBaixa(vc).valor_liquido_recebido, vcBaixa.taxa, vcBaixa.taxaPrevista, vcBaixa.precisaConfirmarTaxa], ["100,00", "97,00", 3, 3, false]);
const rc = await registrarRecebimento(db, { conta_receber_id: venda.data[0], recebido_em: HOJE, valor_bruto_baixado: 100, valor_liquido_recebido: 97, conta_financeira_id: banco.data.id, chave: "rcb-card", taxa_confirmada: !vcBaixa.precisaConfirmarTaxa });
const tx = (await pg.query(`select valor_bruto_baixado::float b, valor_liquido_recebido::float l, valor_taxa_efetiva::float t, recebido_em::text d from public.fin_recebimentos where id = $1`, [rc.data.recebimento_id])).rows[0];
conferir("recebimento real: bruto 100, líquido 97, taxa efetiva 3, data efetiva", [rc.error, tx.b, tx.l, tx.t, tx.d], [null, 100, 97, 3, HOJE]);
conferir("líquido maior que o bruto → recusado", !!(await registrarRecebimento(db, { conta_receber_id: c1.data[0], recebido_em: HOJE, valor_bruto_baixado: 10, valor_liquido_recebido: 11, chave: "rcb-x" })).error, true);
conferir("data futura → recusada", !!(await registrarRecebimento(db, { conta_receber_id: c1.data[0], recebido_em: "2999-01-01", valor_bruto_baixado: 10, valor_liquido_recebido: 10, chave: "rcb-y" })).error, true);

// ── 5. parcelamento da venda × do recebimento ────────────────────────────────
const p3 = await criarContaReceber(db, { unidade_id: U, descricao: "Venda 3x", meio: "credito", valor_bruto: 300, data_venda: "2026-09-30", data_prevista: "2026-10-30",
  modalidade: "parcelado_loja", parcelas_venda: 3, recebiveis: 3, modo_taxa: "informada", valor_taxa: "9" }, { chave: "rec-3x" });
const l3 = (await pg.query(`select descricao, valor_bruto::float b, valor_taxa_previsto::float t, data_prevista::text d, origem_id from public.fin_contas_receber where chave_idempotencia like 'rec-3x:%' order by parcela_numero`)).rows;
conferir("venda 300 em 3x → 3 recebíveis de 100 (taxa 3 cada), mês a mês, mesma origem",
  [p3.error, l3.map((l) => [l.descricao, l.b, l.t, l.d]), new Set(l3.map((l) => l.origem_id)).size],
  [null, [["Venda 3x (1/3)", 100, 3, "2026-10-30"], ["Venda 3x (2/3)", 100, 3, "2026-11-30"], ["Venda 3x (3/3)", 100, 3, "2026-12-30"]], 1]);
const cons = await criarContaReceber(db, { unidade_id: U, descricao: "Venda 3x consolidada", meio: "credito", valor_bruto: 300, data_venda: "2026-09-30", data_prevista: "2026-10-30",
  modalidade: "parcelado_emissor", parcelas_venda: 3, recebiveis: 1 }, { chave: "rec-cons" });
const lc = (await pg.query(`select parcelas_total, valor_bruto::float b, observacao from public.fin_contas_receber where id = $1`, [cons.data[0]])).rows[0];
conferir("venda 300 em 3x consolidada → 1 recebível de 300, registro da venda em 3x", [lc.parcelas_total, lc.b, lc.observacao], [1, 300, "Venda em 3x, recebível consolidado."]);

// ── 6. formas canônicas ──────────────────────────────────────────────────────
for (const meio of ["pix", "dinheiro", "debito", "credito", "voucher", "boleto", "transferencia", "delivery_marketplace", "outro"]) {
  const r = await criarContaReceber(db, { unidade_id: U, descricao: `Teste ${meio}`, meio, valor_bruto: 10, data_venda: HOJE, data_prevista: HOJE }, { chave: `rec-m-${meio}` });
  conferir(`forma ${meio} aceita`, r.error, null);
}
conferir("forma fora da lista → recusada", !!(await criarContaReceber(db, { unidade_id: U, descricao: "x", meio: "cheque", valor_bruto: 10, data_venda: HOJE, data_prevista: HOJE }, { chave: "rec-ch" })).error, true);

// ── 7. contas financeiras e saldo gerencial (+97 − 40 = 57) ──────────────────
conferir("conta financeira sem saldo inicial → recusada (não presume)", /saldo inicial/.test((await criarContaFinanceira(db, { unidade_id: U, nome: "Caixa", tipo: "caixa", saldo_inicial: "", saldo_inicial_em: HOJE })).error), true);
conferir("nome repetido → recusado", /Já existe/.test((await criarContaFinanceira(db, { unidade_id: U, nome: "Banco X", tipo: "banco", saldo_inicial: 0, saldo_inicial_em: "2026-01-01" })).error), true);
const cp = await criarContaPagar(db, { unidade_id: U, descricao: "Gás", valor: 40, data_vencimento: HOJE, competencia: HOJE.slice(0, 7), categoria_codigo: "utilidades_gas" }, { chave: "cp-gas" });
await registrarPagamento(db, { conta_pagar_id: cp.data[0], pago_em: HOJE, valor_principal: 40, conta_financeira_id: banco.data.id, chave: "pg-gas" });
const saldo = (await pg.query(`select saldo_calculado::float s from public.vw_fin_saldo_contas_financeiras where id = $1`, [banco.data.id])).rows[0].s;
conferir("saldo gerencial do Banco X = 0 + 97 − 40 = 57", saldo, 57);
conferir("desativar conta financeira", (await editarContaFinanceira(db, { id: banco.data.id, unidade_id: U, ativa: false })).error, null);

// ── 8. fluxo: realizado × previsto, pela data do dinheiro ────────────────────
const fluxo = (await pg.query(`select natureza, direcao, valor::float valor, origem from public.vw_fin_fluxo_caixa where unidade_id = $1 and data between $2 and $3`, [U, "2026-01-01", "2026-12-31"])).rows;
const rf = resumoFluxo(fluxo);
const hojeFluxo = (await pg.query(`select natureza, direcao, valor::float valor, origem from public.vw_fin_fluxo_caixa where unidade_id = $1 and data = $2`, [U, HOJE])).rows;
const rh = resumoFluxo(hojeFluxo);
conferir("fluxo de hoje (realizado): entradas 400+97+... líquidos, saídas 40", [rh.realizado.saidas, rh.realizado.entradas], [40, 400 + 97]);
conferir("previsto fica separado do realizado", typeof rf.previsto.entradas === "number" && rf.previsto.entradas !== rf.realizado.entradas, true);
// taxa não informada: o fluxo não inventa o líquido, mas mostra o BRUTO em aberto
// (mesmo caminho do fetchFluxoCaixa, pelo cliente com os grants reais)
{
  const fl = (await db.from("vw_fin_fluxo_caixa").select("*").eq("unidade_id", U).gte("data", "2026-01-01").lte("data", "2026-12-31")).data;
  const ids = [...new Set(fl.filter((l) => l.natureza === "previsto" && l.origem === "conta_receber" && l.valor == null).map((l) => l.referencia_id))];
  const rec = await db.from("vw_fin_contas_receber").select("id, saldo_bruto").eq("unidade_id", U).in("id", ids);
  const com = resumoFluxo(anexarBrutoSemTaxa(fl, rec.data));
  const esperado = (await pg.query(`select coalesce(sum(saldo_bruto), 0)::float s from public.vw_fin_contas_receber where unidade_id = $1
     and situacao in ('previsto','parcial','atrasado') and saldo_bruto > 0 and valor_liquido_previsto is null and data_prevista between '2026-01-01' and '2026-12-31'`, [U])).rows[0].s;
  conferir("fluxo: lê o bruto dos recebíveis sem taxa pela view (grants reais)", [rec.error, ids.length > 0], [null, true]);
  conferir("fluxo: bruto sem taxa = soma do saldo bruto em aberto sem taxa", [com.previsto.entradasIncompletas, com.previsto.brutoSemTaxa], [true, esperado]);
  conferir("fluxo: líquido conhecido continua só com o que tem taxa", [com.previsto.entradas, com.previsto.entradasConhecidas], [rf.previsto.entradas, true]);
  conferir("fluxo: cada linha sem taxa ganha o bruto; as outras ficam iguais",
    anexarBrutoSemTaxa(fl, rec.data).filter((l) => l.bruto_sem_taxa != null).length === ids.length && anexarBrutoSemTaxa(fl, rec.data).filter((l) => l.valor != null).every((l) => l.bruto_sem_taxa === undefined), true);
  conferir("fluxo: sem conseguir ler o bruto → brutoSemTaxa null (tela cai no aviso antigo)", resumoFluxo(fl).previsto.brutoSemTaxa, null);
}
{
  const so = [{ natureza: "previsto", direcao: "entrada", valor: null, origem: "conta_receber", referencia_id: "a", bruto_sem_taxa: 1 }];
  const r = resumoFluxo(so);
  conferir("fluxo só com recebível sem taxa (caso de produção): líquido 0 mas NÃO conhecido; bruto 1,00",
    [r.previsto.entradas, r.previsto.entradasConhecidas, r.previsto.entradasIncompletas, r.previsto.brutoSemTaxa], [0, false, true, 1]);
  const vazio = resumoFluxo([]).previsto;
  conferir("fluxo vazio: nada incompleto, bruto sem taxa 0", [vazio.entradasIncompletas, vazio.entradasConhecidas, vazio.brutoSemTaxa], [false, false, 0]);
}

// ── 9. receita (bruto, competência) ≠ dinheiro (líquido, caixa) ──────────────
const lista = await listar();
const recs = (await pg.query(`select recebido_em::text recebido_em, valor_bruto_baixado::float valor_bruto_baixado, valor_liquido_recebido::float valor_liquido_recebido, valor_taxa_efetiva::float valor_taxa_efetiva, estornado_em from public.fin_recebimentos where unidade_id = $1`, [U])).rows;
const set = resumoReceber(lista, recs.filter((r) => r.recebido_em === HOJE), { de: "2026-09-30", ate: "2026-09-30" });
const hojeR = resumoReceber(lista, recs.filter((r) => r.recebido_em === HOJE), { de: HOJE, ate: HOJE });
conferir("receita lançada em 30/09 = bruto 100 + 300 + 300 (não o líquido)", set.receitaCompetencia, 700);
conferir("recebido hoje: líquido 497, bruto baixado 500, taxas 3", [hojeR.recebidoLiquido, hojeR.recebidoBruto, hojeR.taxasEfetivas], [497, 500, 3]);
conferir("a receber líquido = não apurado (há taxa não informada)", hojeR.aReceberLiquido, null);

// ── 10. cancelamento ─────────────────────────────────────────────────────────
const semRec = lista.find((c) => c.descricao === "Teste boleto");
conferir("cancelar sem motivo → recusado", !!(await cancelarContaReceber(db, { id: semRec.id, unidade_id: U, motivo: "" })).error, true);
const cx = await cancelarContaReceber(db, { id: semRec.id, unidade_id: U, motivo: "lançado em duplicidade" });
const vx = (await pg.query(`select situacao from public.vw_fin_contas_receber where id = $1`, [semRec.id])).rows[0];
conferir("cancelar sem recebimento → CANCELADO, continua existindo", [cx.error, vx.situacao], [null, "cancelado"]);
conferir("cancelar conta com recebimento → recusado", !!(await cancelarContaReceber(db, { id: c1.data[0], unidade_id: U, motivo: "x" })).error, true);
conferir("conta cancelada não recebe", /cancelada/i.test((await registrarRecebimento(db, { conta_receber_id: semRec.id, recebido_em: HOJE, valor_bruto_baixado: 10, valor_liquido_recebido: 10, chave: "rcb-c" })).error || ""), true);
const vparc = lista.find((c) => c.id === c1.data[0]);
conferir("regras de botão: parcial pode receber e não pode cancelar", [podeReceber(vparc), podeCancelarReceber(vparc)], [true, false]);

// ── 11. edição ───────────────────────────────────────────────────────────────
const ed = await editarContaReceber(db, { id: c1.data[0], unidade_id: U, contaAtual: vparc, descricao: "Evento — casamento (sinal)", valor_bruto: 1000 });
conferir("editar: grava só o que mudou", ed.data?.alterados, ["descricao"]);
conferir("editar bruto depois de recebimento → recusado", /não pode mudar/.test((await editarContaReceber(db, { id: c1.data[0], unidade_id: U, contaAtual: vparc, descricao: "x", valor_bruto: 2000 })).error), true);
// edição completa (todos os campos que a tela altera) numa conta sem recebimento:
// prova que o UPDATE por coluna da SEC-FIN-2 cobre tudo o que a F2.3 grava
const semRecebimento = (await listar()).find((c) => c.descricao === "Teste credito");
const extra = (await pg.query(`select nsu, autorizacao, observacao, conta_financeira_prevista_id from public.fin_contas_receber where id = $1`, [semRecebimento.id])).rows[0];
const edTudo = await editarContaReceber(db, { id: semRecebimento.id, unidade_id: U, contaAtual: { ...semRecebimento, ...extra },
  descricao: "Teste crédito (editado)", valor_bruto: "12,50", valor_taxa_previsto: "0,50", data_venda: "2026-09-01", data_prevista: "2026-09-15",
  adquirente: "Cielo", bandeira: "Master", nsu: "123", autorizacao: "AB1", observacao: "conferido", conta_financeira_prevista_id: banco.data.id });
conferir("edição completa (bruto, taxa, datas, cartão, NSU, conta prevista, obs) grava",
  [edTudo.error, (edTudo.data?.alterados || []).sort()],
  [null, ["adquirente", "autorizacao", "bandeira", "conta_financeira_prevista_id", "data_prevista", "data_venda", "descricao", "nsu", "observacao", "taxa_fixa_prevista", "taxa_percentual_prevista", "taxa_regra_id", "valor_bruto", "valor_taxa_previsto"]]);
conferir("renomear conta financeira grava", (await editarContaFinanceira(db, { id: banco.data.id, unidade_id: U, nome: "Banco X (principal)" })).error, null);

// ── 12. idempotência, duplo clique, erro de banco ────────────────────────────
conferir("retry da criação (mesma chave) → idempotente", (await criarContaReceber(db, { unidade_id: U, descricao: "Evento — casamento", meio: "pix", valor_bruto: 1000, data_venda: HOJE, data_prevista: HOJE }, { chave: "rec-1" })).idempotente, true);
const nova = await criarContaReceber(db, { unidade_id: U, descricao: "Aluguel do salão", meio: "transferencia", valor_bruto: 500, data_venda: HOJE, data_prevista: HOJE }, { chave: "rec-alug" });
const [a, b] = await Promise.all([
  registrarRecebimento(db, { conta_receber_id: nova.data[0], recebido_em: HOJE, valor_bruto_baixado: 500, valor_liquido_recebido: 500, chave: "rcb-dup" }),
  registrarRecebimento(db, { conta_receber_id: nova.data[0], recebido_em: HOJE, valor_bruto_baixado: 500, valor_liquido_recebido: 500, chave: "rcb-dup" }),
]);
conferir("duplo clique no recebimento → 1 registro, um retorno idempotente",
  [(await pg.query(`select count(*)::int n from public.fin_recebimentos where chave_idempotencia = 'rcb-dup'`)).rows[0].n, [a.data?.idempotente, b.data?.idempotente].sort()], [1, [false, true]]);
const quebrado = clienteSupabase(pg, { quebrar: "connection reset" });
const errs = [
  await criarContaReceber(quebrado, { unidade_id: U, descricao: "x", meio: "pix", valor_bruto: 1, data_venda: HOJE, data_prevista: HOJE }, { chave: "q1" }),
  await registrarRecebimento(quebrado, { conta_receber_id: c1.data[0], recebido_em: HOJE, valor_bruto_baixado: 1, valor_liquido_recebido: 1, chave: "q2" }),
  await estornarRecebimento(quebrado, { recebimento_id: r1.data.recebimento_id, motivo: "x" }),
  await cancelarContaReceber(quebrado, { id: c1.data[0], unidade_id: U, motivo: "x" }),
];
conferir("erro de banco: todas devolvem erro e data nula", errs.map((r) => [r.error, r.data]), Array(4).fill(["connection reset", null]));

// ── 13. isolamento entre unidades ────────────────────────────────────────────
const outra = clienteSupabase(pg, { uid: "44444444-4444-4444-4444-444444444444", unidade: "outra" });
conferir("outra unidade não vê contas a receber", (await outra.from("vw_fin_contas_receber").select("id")).data.length, 0);
conferir("outra unidade não vê recebimentos", (await outra.from("fin_recebimentos").select("id")).data.length, 0);
conferir("outra unidade não vê contas financeiras nem taxas", [(await outra.from("fin_contas_financeiras").select("id")).data.length, (await outra.from("fin_taxas_meio_pagamento").select("id")).data.length], [0, 0]);
conferir("outra unidade não recebe conta alheia (RPC)", /não encontrada/.test((await registrarRecebimento(outra, { conta_receber_id: nova.data[0], recebido_em: HOJE, valor_bruto_baixado: 1, valor_liquido_recebido: 1, chave: "o1" })).error || ""), true);
conferir("outra unidade não estorna recebimento alheio", !!(await estornarRecebimento(outra, { recebimento_id: r1.data.recebimento_id, motivo: "x" })).error, true);
conferir("outra unidade não cria recebível na unidade alheia", /row-level security/.test((await criarContaReceber(outra, { unidade_id: U, descricao: "x", meio: "pix", valor_bruto: 1, data_venda: HOJE, data_prevista: HOJE }, { chave: "o2" })).error || ""), true);
conferir("outra unidade não cancela conta alheia", !!(await cancelarContaReceber(outra, { id: nova.data[0], unidade_id: U, motivo: "x" })).error, true);
conferir("app não grava recebimento direto (só RPC)", /permission denied/.test((await db.from("fin_recebimentos").insert([{ unidade_id: U, conta_receber_id: nova.data[0], recebido_em: HOJE, valor_bruto_baixado: 1, valor_liquido_recebido: 1 }]).select("id")).error?.message || ""), true);
const anon = clienteSupabase(pg, { uid: null });
conferir("anon não lê contas a receber", /permission denied/.test((await anon.from("fin_contas_receber").select("id")).error?.message || ""), true);

// ── 14. taxas: encerrar ──────────────────────────────────────────────────────
conferir("encerrar taxa", (await encerrarTaxa(db, { id: t1.data.id, unidade_id: U, hoje: HOJE })).error, null);
const regrasDepois = (await pg.query(`select * from public.fin_taxas_meio_pagamento`)).rows.map((r) => ({ ...r, vigente_desde: iso(r.vigente_desde), vigente_ate: iso(r.vigente_ate) }));
conferir("taxa encerrada não é mais aplicada", escolherTaxa(regrasDepois, { meio: "credito", adquirente: "Stone", bandeira: "Visa", data: HOJE }), null);

// ── 15. estáticos ────────────────────────────────────────────────────────────
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
conferir("Vendas e Recebimentos antiga → redireciona para Contas a Receber", ler("app/dashboard/vendas/page.js").includes('router.replace("/dashboard/financeiro/receber")'), true);
conferir("Recebíveis/Conciliação antigas → redirecionam", ["app/dashboard/financeiro/recebiveis/page.js", "app/dashboard/financeiro/conciliacao/page.js"].every((f) => ler(f).includes('router.replace("/dashboard/financeiro/receber")')), true);
const novos = ["app/lib/contas-receber.mjs", "app/dashboard/financeiro/receber/page.js", "app/dashboard/financeiro/caixa/page.js", "app/components/ModalRecebimentoConta.js", "app/components/navigation/PosicaoFinanceira.js"].map(ler).join("\n");
conferir("sem UUID falso de unidade", novos.includes("00000000-0000-0000-0000-000000000001"), false);
conferir("nenhum percentual de taxa padrão no código", /taxa_percentual:\s*\d/.test(novos), false);
conferir("faturamento aparece como NÃO APURADO na Central", /Faturamento[\s\S]{0,80}Não apurado/.test(ler("app/components/navigation/PosicaoFinanceira.js")), true);
const efeitos = (ler("app/dashboard/financeiro/receber/page.js").match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) || []).join("\n");
conferir("abrir Contas a Receber não grava nada", /salvar|receberConta|cancelar|estornar|criar/i.test(efeitos), false);

// ── 16. privilégios EXATOS de produção (auditoria F2.3 de 01/10/2026) ───────
// O Supabase dá, por padrão, ALL ao authenticated em tabelas/views novas; a
// F2.1 só retirou parte. Produção ficou: views com DELETE/INSERT/UPDATE/
// TRUNCATE e tabelas com REFERENCES/TRIGGER. Reproduz e tenta abusar.
{
  // (os privilégios vêm do padrão Supabase reproduzido em teste-banco-f21.mjs)
  const comoSql = async (unidade, sql) => {
    await pg.exec("reset role");
    await pg.query(`select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false), set_config('test.unidade',$1,false), set_config('test.rede','false',false)`, [unidade]);
    await pg.exec("set role authenticated");
    try { const r = await pg.query(sql); return { ok: true, linhas: r.affectedRows ?? 0 }; }
    catch (e) { return { ok: false, erro: e.message }; }
    finally { await pg.exec("reset role"); }
  };
  const contaFin = (await pg.query(`select id from public.fin_contas_financeiras limit 1`)).rows[0].id;
  const ataques = {
    "INSERT na view de recebíveis": await comoSql(U, `insert into public.vw_fin_contas_receber (id) values (gen_random_uuid())`),
    "UPDATE na view de recebíveis": await comoSql(U, `update public.vw_fin_contas_receber set descricao = 'x'`),
    "DELETE na view de recebíveis": await comoSql(U, `delete from public.vw_fin_contas_receber`),
    "TRUNCATE na view de fluxo": await comoSql(U, `truncate public.vw_fin_fluxo_caixa`),
    "DELETE de conta financeira pela view": await comoSql(U, `delete from public.vw_fin_saldo_contas_financeiras`),
    "outra unidade altera conta financeira pela view": await comoSql("outra", `update public.vw_fin_saldo_contas_financeiras set nome = 'x' where id = '${contaFin}'`),
  };
  conferir("privilégios de produção: INSERT/UPDATE/DELETE/TRUNCATE nas views não funcionam",
    Object.entries(ataques).slice(0, 5).map(([k, r]) => [k, r.ok]), Object.keys(ataques).slice(0, 5).map((k) => [k, false]));
  const viaView = ataques["outra unidade altera conta financeira pela view"];
  conferir("privilégios de produção: outra unidade não altera nada pela view", !viaView.ok || viaView.linhas === 0, true);
  const criarTrigger = await comoSql(U, `create function public.x_trg() returns trigger language plpgsql as $f$ begin return new; end $f$`);
  // Em produção a proteção real é outra: o app só fala com o banco pela API (PostgREST),
  // que não executa DDL. Aqui só se confirma que o papel não cria função no schema.
  conferir("simulado: authenticated não cria função/trigger (a API em produção não executa DDL)", criarTrigger.ok, false);
  // O que JÁ era possível (e continua): editar a própria conta financeira, inclusive saldo_inicial,
  // direto na tabela (UPDATE concedido). A tela não deixa; o banco deixa. Registrado como pendência.
  const saldoDireto = await comoSql(U, `update public.fin_contas_financeiras set saldo_inicial = saldo_inicial where id = '${contaFin}'`);
  if (SEC_FIN_2) conferir("SEC-FIN-2: saldo_inicial não é mais alterável pela API", [saldoDireto.ok, /permission denied/.test(saldoDireto.erro || "")], [false, true]);
  else conferir("[pendência conhecida] a própria unidade consegue alterar saldo_inicial direto na tabela", saldoDireto.linhas, 1);
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
