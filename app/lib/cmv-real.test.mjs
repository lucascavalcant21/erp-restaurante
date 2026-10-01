// Testes do CMV REAL (F2.4C). Puros (casos A–J pedidos pelo dono) + integração
// no Postgres em memória (PGlite) com o SQL real da F2.1 + SEC-FIN-2 + F2.4B
// (e a tabela opcional de faturamento diário). Uso:
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/cmv-real.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG_CMV, periodosEntreContagens, periodoPorDatas, contagensValidas, apurarPeriodo, faturamentoDaJanela, analiseCompras,
  maisConsumidos, porCategoria, variacoesPreco, comparacaoPeriodos, mediasHistoricas, alertas, estoqueParado, cmvRealPeriodo, somarDiasIso, entradasSaidasPorProduto,
} from "./cmv-real.mjs";
import { carregarDadosCmv, salvarFaturamentoDia, MOTIVO_SEM_FATURAMENTO } from "./cmv-dados.mjs";
import { criarContagem, salvarItemContagem, fecharContagem } from "./contagem-estoque.mjs";
import { salvarRascunho, confirmarCompra, cancelarCompra, criarFornecedor } from "./compras-estoque.mjs";
import { criarBancoF21, clienteSupabase } from "./teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};

// ── 1. puras: casos obrigatórios ─────────────────────────────────────────────
const ins = new Map([
  ["p", { id: "p", nome: "Picanha", departamento: "cozinha", categoria: "Carne vermelha" }],
  ["c", { id: "c", nome: "Cerveja", departamento: "bar", categoria: "Cervejas" }],
  ["l", { id: "l", nome: "Detergente", departamento: "limpeza", categoria: "Limpeza" }],
  ["e", { id: "e", nome: "Pote delivery", departamento: "embalagens", categoria: "Embalagens" }],
]);
const C1 = { id: "C1", tipo: "inicial", status: "fechada", estoque_id: null, data_referencia: "2026-10-01", fechada_em: "2026-10-01T12:00:00Z" };
const C2 = { id: "C2", tipo: "intermediaria", status: "fechada", estoque_id: null, data_referencia: "2026-10-08", fechada_em: "2026-10-08T12:00:00Z" };
const it = (insumo_id, q, v, base = "g", estoque_id = "E1") => ({ insumo_id, estoque_id, quantidade_contada: q, unidade_base: base, valor_total: v, custo_unitario: q ? v / q : 0 });
const compra = (id, status, data, valor, extra = {}) => ({ id, status, data_compra: data, data_recebimento: data, valor_total: valor, valor_itens: valor, fornecedor_id: "F1", ...extra });
const citem = (compra_id, insumo_id, q, v, base = "g") => ({ compra_id, insumo_id, quantidade_base: q, unidade_base: base, valor_total: v });
const fonteDias = (de, n, valorDia) => ({ disponivel: true, nome: "teste", dias: Array.from({ length: n }, (_, k) => ({ data: somarDiasIso(de, k), valor: valorDia })) });
const base = (extra = {}) => ({
  itensPorContagem: new Map([["C1", [it("p", 10000, 1000)]], ["C2", [it("p", 8000, 800)]]]),
  compras: [compra("K1", "confirmada", "2026-10-03", 500)], comprasItens: [citem("K1", "p", 5000, 500)], insumoPorId: ins, ...extra,
});
const [per1] = periodosEntreContagens([C1, C2], "2026-10-09");

const A = apurarPeriodo(per1, base());
conferir("A) EI 1000 + compras 500 − EF 800 = CMV 700 (APURADO)", [A.status, A.ei.valor, A.compras.valor, A.ef.valor, A.cmv.valor], ["apurado", 1000, 500, 800, 700]);
const B = apurarPeriodo(per1, base({ fonteFaturamento: fonteDias("2026-10-01", 7, 2000 / 7) }));
conferir("B) CMV 700 ÷ faturamento 2000 = 35%", [B.faturamento.valor, B.cmvPct], [2000, 35]);
const Cc = apurarPeriodo({ ...per1, fim: null, emAndamento: false }, base());
conferir("C) sem estoque final → NÃO APURADO (nunca zero)", [Cc.status, Cc.cmv.valor, Cc.ef.valor, Cc.motivos], ["nao_apurado", null, null, ["Inventário final ainda não realizado."]]);
const D = apurarPeriodo(per1, base({ fonteFaturamento: null }));
conferir("D) sem faturamento → CMV R$ 700 calculado; CMV % NÃO APURADO com motivo", [D.cmv.valor, D.cmvPct, D.motivoPct != null], [700, null, true]);
const E = apurarPeriodo(per1, base({ compras: [compra("K1", "confirmada", "2026-10-03", 500), compra("K2", "cancelada", "2026-10-04", 300)], comprasItens: [citem("K1", "p", 5000, 500), citem("K2", "p", 3000, 300)] }));
conferir("E) compra cancelada não entra (e aparece listada como fora)", [E.compras.valor, E.cmv.valor, E.compras.canceladas.map((c) => c.id)], [500, 700, ["K2"]]);
const F = apurarPeriodo(per1, base({ compras: [compra("K1", "confirmada", "2026-10-03", 500), compra("K3", "confirmada", "2026-10-07", 200)], comprasItens: [citem("K1", "p", 5000, 500), citem("K3", "p", 2000, 200)] }));
conferir("F) compra confirmada dentro do período entra", [F.compras.valor, F.cmv.valor], [700, 900]);
const G = apurarPeriodo(per1, base({ compras: [compra("K1", "confirmada", "2026-10-03", 500), compra("K4", "confirmada", "2026-09-30", 999), compra("K5", "confirmada", "2026-10-08", 777)],
  comprasItens: [citem("K1", "p", 5000, 500), citem("K4", "p", 1, 999), citem("K5", "p", 1, 777)] }));
conferir("G) compra fora do período (antes do início ou no dia da contagem final, que abre o próximo) não entra", [G.compras.valor, G.compras.confirmadas.map((c) => c.id)], [500, ["K1"]]);
const C3 = { id: "C3", tipo: "intermediaria", status: "fechada", estoque_id: null, data_referencia: "2026-10-15", fechada_em: "2026-10-15T12:00:00Z" };
const pers = periodosEntreContagens([C3, C1, C2], "2026-10-16");
conferir("H) contagens consecutivas → 01/10→08/10, 08/10→15/10 (a de 08/10 fecha um e abre o outro) + em andamento",
  pers.map((p) => `${p.de}>${p.ateExclusivo}:${p.emAndamento ? "andamento" : "fechado"}`), ["2026-10-01>2026-10-08:fechado", "2026-10-08>2026-10-15:fechado", "2026-10-15>2026-10-17:andamento"]);
const emAnd = apurarPeriodo(pers[2], base());
conferir("H) período depois da última contagem: EM ANDAMENTO, aguardando a próxima contagem", [emAnd.status, emAnd.motivos], ["em_andamento", ["Aguardando a próxima contagem de estoque."]]);
// I) movimentações internas e separação: transferência entre locais não muda o CMV; limpeza fica fora; consumo é "aparente"
const I = apurarPeriodo(per1, base({ itensPorContagem: new Map([
  ["C1", [it("p", 10000, 1000, "g", "E1"), it("l", 5, 50, "un", "E3"), it("e", 100, 30, "un", "E4")]],
  ["C2", [it("p", 3000, 300, "g", "E1"), it("p", 5000, 500, "g", "E2"), it("l", 2, 20, "un", "E3"), it("e", 40, 12, "un", "E4")]]]) }));
conferir("I) produto movido de local (Cozinha → Bar) soma igual: transferência não vira consumo", I.cmv.mercadoria, 700);
conferir("I) limpeza fora do CMV (consumo operacional à parte); embalagem dentro, à parte", [I.cmv.valor, I.cmv.embalagem, I.cmv.operacional], [718, 18, 30]);
conferir("I) consumo por produto é 'aparente' (estoque inicial + compras − final), não venda", maisConsumidos(I).porValor.map((p) => [p.nome, p.consumo_v]), [["Picanha", 700], ["Pote delivery", 18], ["Detergente", 30]].sort((a, b) => b[1] - a[1]));

// cobertura (não inventa): produto sem contagem final / inicial; unidades misturadas
const cov = apurarPeriodo(per1, base({ itensPorContagem: new Map([["C1", [it("p", 10000, 1000), it("c", 24, 120, "un")]], ["C2", [it("p", 8000, 800)]]]) }));
conferir("produto com estoque inicial NÃO contado no final → NÃO APURADO com motivo; mostra só o parcial dos produtos contados nas duas pontas",
  [cov.status, cov.cmv.valor, cov.cmv.parcial, /não foram contados no inventário final: Cerveja/.test(cov.motivos.join(" "))], ["nao_apurado", null, 700, true]);
const cov2 = apurarPeriodo(per1, base({ itensPorContagem: new Map([["C1", [it("p", 10000, 1000)]], ["C2", [it("p", 8000, 800), it("c", 10, 50, "un")]]]) }));
conferir("produto contado no final sem contagem inicial → NÃO APURADO", [cov2.status, /não foram contados no inicial: Cerveja/.test(cov2.motivos.join(" "))], ["nao_apurado", true]);
const zero = apurarPeriodo(per1, base({ itensPorContagem: new Map([["C1", [it("p", 10000, 1000), it("c", 0, 0, "un")]], ["C2", [it("p", 8000, 800)]]]) }));
conferir("produto contado ZERO no início e sem compra não exige contagem final", zero.status, "apurado");
const uni = apurarPeriodo(per1, base({ comprasItens: [citem("K1", "p", 5, 500, "un")] }));
conferir("unidades diferentes do mesmo produto (g × un) → NÃO APURADO, sem misturar", [uni.status, /unidades diferentes/.test(uni.motivos.join(" "))], ["nao_apurado", true]);

// faturamento: dia faltando → nulo; zero → sem base
conferir("faturamento com dia faltando → NÃO APURADO com os dias", (() => { const f = faturamentoDaJanela("2026-10-01", "2026-10-08", fonteDias("2026-10-01", 6, 100)); return [f.valor, f.diasFaltando]; })(), [null, ["2026-10-07"]]);
conferir("faturamento zero no período → CMV % NÃO APURADO (sem base)", apurarPeriodo(per1, base({ fonteFaturamento: fonteDias("2026-10-01", 7, 0) })).cmvPct, null);

// mês fechado: inicial em 01/10 (abertura) + fechamento em 31/10 (fim do dia) = outubro inteiro
const CF = { id: "CF", tipo: "final", status: "fechada", estoque_id: null, data_referencia: "2026-10-31", fechada_em: "2026-10-31T23:00:00Z" };
const CI11 = { id: "CI11", tipo: "inicial", status: "fechada", estoque_id: null, data_referencia: "2026-11-01", fechada_em: "2026-11-01T09:00:00Z" };
const mes = periodoPorDatas("2026-10-01", "2026-10-31", [C1, C2, C3, CF]);
conferir("mês: inventário de 01/10 (abertura) e de 31/10 (fim do dia) delimitam outubro inteiro", [mes.inicio?.id, mes.fim?.id, mes.ateExclusivo], ["C1", "CF", "2026-11-01"]);
const mesAp = apurarPeriodo(mes, base({ itensPorContagem: new Map([["C1", [it("p", 10000, 1000)]], ["CF", [it("p", 2000, 200)]]]),
  compras: [compra("K1", "confirmada", "2026-10-03", 500), compra("K6", "confirmada", "2026-10-31", 100)], comprasItens: [citem("K1", "p", 5000, 500), citem("K6", "p", 1000, 100)] }));
conferir("mês: compra de 31/10 entra em outubro (contagem final é no fim do dia); CMV = 1000 + 600 − 200", [mesAp.compras.valor, mesAp.cmv.valor], [600, 1400]);
conferir("fechamento de 31/10 e inicial de 01/11 são o mesmo momento: uma fronteira só, sem período vazio",
  periodosEntreContagens([C1, CF, CI11], "2026-11-02").map((p) => `${p.de}>${p.ateExclusivo}`), ["2026-10-01>2026-11-01", "2026-11-01>2026-11-03"]);
conferir("semana que não começa/termina em contagem → CMV NÃO APURADO com o motivo (compras continuam analisáveis)",
  (() => { const a = apurarPeriodo(periodoPorDatas("2026-10-05", "2026-10-11", [C1, C2]), base()); return [a.status, a.motivos.length, a.compras.valor]; })(), ["nao_apurado", 2, 0]);
conferir("contagem de um local só (não é da unidade inteira) não vira fronteira", contagensValidas([C1, { ...C2, estoque_id: "E1" }]).map((c) => c.id), ["C1"]);

// análises
const ac = analiseCompras(apurarPeriodo(per1, base({ compras: [compra("K1", "confirmada", "2026-10-03", 500), compra("K7", "confirmada", "2026-10-04", 120, { fornecedor_id: "F2" })],
  comprasItens: [citem("K1", "p", 5000, 500), citem("K7", "c", 24, 120, "un")] })), { insumoPorId: ins, fornecedorPorId: new Map([["F1", { nome: "Frigorífico" }], ["F2", { nome: "Distribuidora" }]]) });
conferir("análise de compras: total, nº compras, nº itens, ticket médio, fornecedores", [ac.total, ac.quantidadeCompras, ac.quantidadeItens, ac.ticketMedio, ac.fornecedores.map((f) => f.nome)], [620, 2, 2, 310, ["Frigorífico", "Distribuidora"]]);
conferir("rankings por quantidade e preço SEPARADOS por unidade (kg × un)", [ac.porQuantidade.g.map((p) => p.nome), ac.porQuantidade.un.map((p) => p.nome), ac.maisCaros.g[0].precoMedio, ac.maisCaros.un[0].precoMedio], [["Picanha"], ["Cerveja"], 100, 5]);
const vp = variacoesPreco([compra("V1", "confirmada", "2026-09-20", 399), compra("V2", "confirmada", "2026-10-03", 425), compra("V3", "cancelada", "2026-10-05", 1)],
  [citem("V1", "p", 10000, 399), citem("V2", "p", 10000, 425), citem("V3", "p", 1000, 1)]);
conferir("variação de preço: R$ 39,90/kg → R$ 42,50/kg = +R$ 2,60 (+6,52%); compra cancelada fora", [vp[0].anterior.preco, vp[0].atual.preco, vp[0].diferenca, vp[0].pct, vp[0].historico.length], [39.9, 42.5, 2.6, 6.52, 2]);
const p2 = periodosEntreContagens([C1, C2, C3], "2026-10-16");
const ap1 = apurarPeriodo(p2[0], base({ fonteFaturamento: fonteDias("2026-10-01", 14, 2000 / 7) }));
const ap2 = apurarPeriodo(p2[1], { ...base({ fonteFaturamento: fonteDias("2026-10-01", 14, 2000 / 7) }), itensPorContagem: new Map([["C2", [it("p", 8000, 800)]], ["C3", [it("p", 7000, 700)]]]),
  compras: [compra("K8", "confirmada", "2026-10-10", 600)], comprasItens: [citem("K8", "p", 6000, 600)] });
const cmp = comparacaoPeriodos([ap1, ap2]);
conferir("comparação: 35% → 35% (+0 p.p.); CMV 700 → 700; compras 500 → 600 (+20%)", [cmp[1].vsAnterior.cmvPctPontos, cmp[1].vsAnterior.cmv.valor, cmp[1].vsAnterior.compras.pct], [0, 0, 20]);
conferir("médias: 1 período → HISTÓRICO INSUFICIENTE; 2 períodos → média baseada em 2", [mediasHistoricas([ap1]).suficiente, mediasHistoricas([ap1, ap2]).periodos, mediasHistoricas([ap1, ap2]).cmv], [false, 2, 700]);
conferir("categorias do CMV (do cadastro) com %", porCategoria(I).categorias.map((c) => [c.nome, c.valor, c.pct]), [["Carne vermelha", 700, 97.49], ["Embalagens", 18, 2.51]]);
const parado = estoqueParado(apurarPeriodo(per1, base({ itensPorContagem: new Map([["C1", [it("p", 10000, 1000), it("c", 24, 120, "un")]], ["C2", [it("p", 8000, 800), it("c", 24, 120, "un")]]]) })), { compras: [], itens: [] });
conferir("estoque parado: cerveja sem consumo no período, R$ 120 parados", parado.map((p) => [p.nome, p.valorParado]), [["Cerveja", 120]]);
const al = alertas({ apurados: [], variacoes: variacoesPreco([compra("V1", "confirmada", "2026-09-01", 400), compra("V2", "confirmada", "2026-09-10", 400), compra("V3", "confirmada", "2026-10-03", 480)],
  [citem("V1", "p", 10000, 400), citem("V2", "p", 10000, 400), citem("V3", "p", 10000, 480)]), insumoPorId: ins });
conferir("alerta de preço: +20% sobre a média das 2 compras anteriores, com média, base, fonte e limite", al.map((a) => [a.tipo, a.diferencaPct, a.media, a.base, a.limite]), [["preco", 20, 40, "2 compras anteriores", `${CONFIG_CMV.alertas.variacaoPrecoPct}%`]]);
// entradas e saídas por produto, com médias (inclui embalagens e limpeza)
const es = entradasSaidasPorProduto([ap1, ap2]);
const picES = es.find((x) => x.insumo_id === "p");
conferir("entradas/saídas da picanha em 2 períodos (14 dias): entrada 11 kg, saída (10+5−8)+(8+6−7) = 14 kg → 1 kg/dia, 7 kg/semana, 30 kg/mês; entrada 0,786 kg/dia (em g)",
  [picES.entrada_q, picES.saida_q, picES.dias, picES.periodos, picES.saidaDia, picES.saidaSemana, picES.saidaMes, picES.entradaDia], [11000, 14000, 14, 2, 1000, 7000, 30000, 785.714]);
conferir("cobertura: estoque final (7 kg) ÷ saída média de 1 kg/dia = 7 dias", picES.coberturaDias, 7);
const esI = entradasSaidasPorProduto([I]);
conferir("embalagens e limpeza também têm entrada/saída e média (grupo à parte)",
  esI.map((x) => [x.nome, x.grupo, x.saidaDia]).sort(), [["Detergente", "operacional", 0.429], ["Picanha", "mercadoria", 1000], ["Pote delivery", "embalagem", 8.571]]);
conferir("período não apurado não entra na média (nada estimado)", entradasSaidasPorProduto([Cc, cov]).length, 0);
conferir("resultado para o DRE futuro (cmv_real_periodo)", cmvRealPeriodo(B), { de: "2026-10-01", ate: "2026-10-07", status: "apurado", estoque_inicial: 1000, compras: 500, estoque_final: 800, cmv_real: 700, faturamento: 2000, cmv_pct: 35, motivos: [] });

// ── 2. integração: banco com F2.1 + SEC-FIN-2 + F2.4B ──────────────────────
const extra = `
  alter table public.insumos add column unidade_medida text, add column categoria text, add column departamento text;
  alter table public.fornecedores add column ativo boolean default true;
  grant select, insert, update on public.fornecedores to authenticated;
  grant select on public.insumos to authenticated;
`;
const pg = await criarBancoF21(raiz, extra, { secFin2: true, f24b: true });
if (!pg) { console.log("\nPGLITE não informado: integração NÃO executada."); process.exit(falhas ? 1 : 2); }
const db = clienteSupabase(pg);
const U = "seldeestrela";
const hoje = new Date().toISOString().slice(0, 10);
const D1 = somarDiasIso(hoje, -14); const D2 = somarDiasIso(hoje, -7);
const id = async (sql, ps = []) => (await pg.query(sql, ps)).rows[0].id;
const picanha = await id(`insert into public.insumos (unidade_id, nome, unidade_medida, departamento, categoria) values ($1,'Picanha','kg','cozinha','Carne vermelha') returning id`, [U]);
const deterg = await id(`insert into public.insumos (unidade_id, nome, unidade_medida, departamento, categoria) values ($1,'Detergente','un','limpeza','Limpeza') returning id`, [U]);
const est = await id(`insert into public.estoques (unidade_id, nome) values ($1,'Cozinha') returning id`, [U]);
const fornA = (await criarFornecedor(db, { unidade_id: U, nome: "Frigorífico A" })).data.id;
const contar = async (tipo, data, linhas) => {
  const c = await criarContagem(db, { unidade_id: U, tipo, data_referencia: data });
  const its = [];
  for (const [insumo_id, qtd, um, custo] of linhas) { const r = await salvarItemContagem(db, { contagem_id: c.data.id, unidade_id: U, insumo_id, estoque_id: est, quantidade: qtd, unidade_medida: um }); its.push({ id: r.data.id, insumo_id, quantidade_contada: r.data.quantidade_contada, custo, um }); }
  const f = await fecharContagem(db, { contagem_id: c.data.id, itens: its, unidadesPorInsumo: Object.fromEntries(its.map((i) => [i.insumo_id, i.um])), custos: Object.fromEntries(its.map((i) => [i.id, { porUnidade: i.custo }])), confirmado: true });
  return { id: c.data.id, erro: f.error };
};
const comprar = async (data, itens, chave) => {
  const r = await salvarRascunho(db, { compra: { unidade_id: U, fornecedor_id: fornA, numero_documento: `NF ${chave}`, data_compra: data, data_recebimento: data }, itens, chave });
  const c = await confirmarCompra(db, { compra_id: r.data.id, gerar_conta_pagar: false });
  return { id: r.data.id, erro: r.error || c.error };
};
const k1 = await contar("inicial", D1, [[picanha, "10", "kg", "100"], [deterg, "5", "un", "10"]]);   // R$ 1000 + R$ 50
const cp1 = await comprar(somarDiasIso(D1, 2), [{ insumo: { id: picanha, nome: "Picanha", unidade_medida: "kg" }, quantidade: "5", valor_total: "500" }], "i1");
const cp2 = await comprar(somarDiasIso(D1, 3), [{ insumo: { id: picanha, nome: "Picanha", unidade_medida: "kg" }, quantidade: "3", valor_total: "300" }], "i2");
const cx = await cancelarCompra(db, { compra_id: cp2.id, motivo: "lançada em dobro" });
const k2 = await contar("intermediaria", D2, [[picanha, "8", "kg", "100"], [deterg, "2", "un", "10"]]);   // R$ 800 + R$ 20
conferir("cenário no banco: 2 inventários fechados, 1 compra confirmada, 1 cancelada", [k1.erro, k2.erro, cp1.erro, cp2.erro, cx.error], [null, null, null, null, null]);
const apurarDoBanco = async () => {
  const d = await carregarDadosCmv(db, U);
  const per = periodosEntreContagens(d.data.contagens, hoje)[0];
  return { erro: d.error, ap: apurarPeriodo(per, d.data), fonte: d.data.fonteFaturamento };
};
const r1 = await apurarDoBanco();
conferir("banco: CMV = 1000 + 500 − 800 = 700 (cancelada fora); limpeza 50 − 20 = 30 à parte", [r1.erro, r1.ap.status, r1.ap.ei.porGrupo.mercadoria, r1.ap.compras.valor, r1.ap.cmv.valor, r1.ap.cmv.operacional], [null, "apurado", 1000, 500, 700, 30]);
conferir("banco: sem tabela de faturamento → CMV % NÃO APURADO com o motivo da auditoria", [r1.ap.cmvPct, r1.ap.motivoPct === MOTIVO_SEM_FATURAMENTO, r1.fonte.habilitado], [null, true, false]);
conferir("banco: estoque inicial vem do inventário fechado (valor congelado), não do custo atual", r1.ap.ei.contagem?.id === k1.id, true);
const r2 = await apurarDoBanco();
conferir("J) recarregar: os mesmos resultados", JSON.stringify(cmvRealPeriodo(r2.ap)) === JSON.stringify(cmvRealPeriodo(r1.ap)), true);
// faturamento diário (tabela opcional)
await pg.exec(fs.readFileSync(path.join(raiz, "db", "F2_4C_FATURAMENTO_DIARIO_OPCIONAL.sql"), "utf8"));
const lancamentos = [];
for (let k = 0; k < 7; k++) lancamentos.push(await salvarFaturamentoDia(db, { unidade_id: U, data: somarDiasIso(D1, k), vendas_brutas: "320", cancelamentos: "10", descontos: "10", fonte: "Saipos — relatório do dia" }));
conferir("faturamento diário: 7 dias lançados (receita = vendas − cancelamentos − descontos)", lancamentos.map((l) => l.error).filter(Boolean), []);
const r3 = await apurarDoBanco();
conferir("com faturamento informado: 7 × 300 = R$ 2.100 → CMV % = 700 ÷ 2100 = 33,33%", [r3.ap.faturamento.valor, r3.ap.cmvPct, /informado/.test(r3.ap.faturamento.fonte)], [2100, 33.33, true]);
conferir("corrigir um dia atualiza (não duplica)", [(await salvarFaturamentoDia(db, { unidade_id: U, data: D1, vendas_brutas: "300", fonte: "Saipos" })).data?.novo, (await pg.query(`select count(*)::int n from public.fin_faturamento_diario`)).rows[0].n], [false, 7]);
conferir("faturamento: cancelamento maior que a venda → recusado", !!(await salvarFaturamentoDia(db, { unidade_id: U, data: hoje, vendas_brutas: "10", cancelamentos: "20", fonte: "x" })).error, true);
conferir("faturamento: sem fonte → recusado", !!(await salvarFaturamentoDia(db, { unidade_id: U, data: hoje, vendas_brutas: "10", fonte: "" })).error, true);
const outra = clienteSupabase(pg, { unidade: "outra", uid: "44444444-4444-4444-4444-444444444444" });
conferir("outra unidade não vê o faturamento nem os inventários", [(await outra.from("fin_faturamento_diario").select("id")).data.length, (await carregarDadosCmv(outra, "outra")).data.contagens.length], [0, 0]);
conferir("app não apaga faturamento lançado", !!(await db.from("fin_faturamento_diario").delete().eq("unidade_id", U)).error, true);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
