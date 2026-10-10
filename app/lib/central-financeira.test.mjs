// CENTRAL FINANCEIRA: motor puro (TESTADO LOCAL). Dados espelham o que a
// auditoria de 10/10/2026 achou na Seldeestrela: 4 contas vencidas somando
// R$ 7.930,19; outubro com 1 recebimento de R$ 0,40 e 3 pagamentos de R$ 1,79;
// nenhum faturamento lançado; nenhum inventário fechado.
import test from "node:test";
import assert from "node:assert/strict";
import { intervaloCentral, faturamentoNaJanela, compromissos, montarCentral, ROTAS } from "./central-financeira.mjs";

const HOJE = "2026-10-10";
const conta = (id, venc, saldo, extra = {}) => ({ id, descricao: `Conta ${id}`, data_vencimento: venc, saldo, valor_original: saldo, situacao: venc < HOJE ? "vencido" : "pendente", vencida: venc < HOJE, grupo: "Custo fixo", ...extra });
const PAGAR_REAL = [conta("v1", "2026-09-01", 5500), conta("v2", "2026-06-22", 2420.4), conta("v3", "2026-09-15", 5), conta("v4", "2026-09-20", 4.79)];
const FLUXO = [
  { data: "2026-10-03", natureza: "realizado", direcao: "entrada", valor: 0.4, origem: "recebimento" },
  { data: "2026-10-05", natureza: "realizado", direcao: "saida", valor: 1, origem: "pagamento" },
  { data: "2026-10-08", natureza: "realizado", direcao: "saida", valor: 0.5, origem: "pagamento" },
  { data: "2026-10-10", natureza: "realizado", direcao: "saida", valor: 0.29, origem: "pagamento" },
  { data: "2026-10-12", natureza: "previsto", direcao: "saida", valor: 100, origem: "conta_pagar" },
];
const fontesBase = (extra = {}) => ({
  pagar: { data: PAGAR_REAL }, receber: { data: [] }, fluxo: { data: FLUXO }, saldos: { data: [{ id: "cx", ativa: true, saldo_calculado: 0, saldo_inicial_em: null }] },
  faturamento: { disponivel: true, dias: [] }, cmo: { colaboradores: [{ salario: 2000, status: "ativo", tipo_contrato: "CLT" }], recibos: [] },
  custosFixos: { data: [], incluirFolha: true }, cmv: { periodo: null }, ...extra,
});
const central = (periodo = "mes", extra = {}, pers) => montarCentral({ hoje: HOJE, intervalo: intervaloCentral(periodo, HOJE, pers), fontes: fontesBase(extra) });

test("filtros: hoje, 7 dias, 30 dias, mês atual (até hoje) e personalizado validado", () => {
  assert.deepEqual(intervaloCentral("hoje", HOJE), { de: HOJE, ate: HOJE, rotulo: "Hoje, 10/10/2026", valido: true });
  assert.equal(intervaloCentral("7d", HOJE).de, "2026-10-04");
  assert.equal(intervaloCentral("30d", HOJE).de, "2026-09-11");
  assert.deepEqual(intervaloCentral("mes", HOJE), { de: "2026-10-01", ate: HOJE, rotulo: "Outubro de 2026", valido: true });
  assert.equal(intervaloCentral("personalizado", HOJE, { de: "2026-10-05", ate: "2026-10-01" }).valido, false);
  assert.equal(intervaloCentral("personalizado", HOJE, { de: "2026-01-01", ate: "2026-10-01" }).rotulo, "01/01/2026 a 01/10/2026");
});

test("A PAGAR: R$ 7.930,19, todas vencidas, alerta crítico com 'Resolver' na lista de vencidas", () => {
  const c = central();
  assert.equal(c.cards.aPagar.valor, 7930.19);
  assert.equal(c.cards.aPagar.vencido, 7930.19);
  assert.equal(c.cards.aPagar.nVencidas, 4);
  assert.equal(c.cards.aPagar.tom, "critico");
  const a = c.alertas.find((x) => x.id === "vencidas");
  assert.deepEqual([a.prioridade, a.valor, a.acao, a.href], ["critico", 7930.19, "Resolver", ROTAS.contasVencidas]);
  assert.equal(c.alertas[0].id, "vencidas", "crítico primeiro");
});

test("SALDO = entradas − saídas, só realizado, e cada filtro recorta o período", () => {
  const mes = central("mes").cards.fluxo;
  assert.deepEqual([mes.entradas, mes.saidas, mes.saldo, mes.lancamentos], [0.4, 1.79, -1.39, 4]);
  const hoje = central("hoje").cards.fluxo;
  assert.deepEqual([hoje.entradas, hoje.saidas, hoje.saldo, hoje.lancamentos], [0, 0.29, -0.29, 1]);
  const sete = central("7d").cards.fluxo;
  assert.deepEqual([sete.saidas, sete.lancamentos], [1.79, 3]);
  assert.equal(central("personalizado", {}, { de: "2026-09-01", ate: "2026-09-30" }).cards.fluxo.estado, "zero");
  assert.match(central("personalizado", {}, { de: "2026-09-01", ate: "2026-09-30" }).cards.fluxo.motivo, /Nenhum recebimento ou pagamento/);
});

test("FATURAMENTO: nunca vem das entradas do caixa; dia faltando nunca vira zero", () => {
  const c = central();
  assert.ok(c.cards.fluxo.entradas > 0, "há entrada de dinheiro");
  assert.equal(c.cards.faturamento.estado, "nao_apurado", "…e mesmo assim o faturamento não é apurado");
  assert.equal(c.cards.faturamento.valor, null);
  assert.ok(c.alertas.some((a) => a.id === "faturamento" && a.href === ROTAS.faturamento));
  const fonte = { disponivel: true, dias: [{ data: "2026-10-09", valor: 1000 }, { data: "2026-10-10", valor: 500 }] };
  assert.deepEqual(faturamentoNaJanela(fonte, "2026-10-09", "2026-10-10"), { estado: "ok", valor: 1500, lancados: 2, esperados: 2 });
  const parcial = faturamentoNaJanela(fonte, "2026-10-01", "2026-10-10");
  assert.deepEqual([parcial.estado, parcial.valor, parcial.lancados, parcial.esperados], ["parcial", 1500, 2, 10]);
  assert.equal(faturamentoNaJanela({ disponivel: false, motivo: "sem tabela" }, "2026-10-01", HOJE).estado, "nao_apurado");
  assert.equal(faturamentoNaJanela({ erro: "rede" }, "2026-10-01", HOJE).estado, "erro");
});

test("CMV: sem inventário fechado é NÃO CALCULADO (nada de 28,4% inventado); com período, CMV R$ sem % se faltar faturamento", () => {
  const sem = central().indicadores.cmv;
  assert.equal(sem.estado, "nao_calculado");
  assert.equal(sem.pct, undefined);
  assert.ok(!JSON.stringify(central()).includes("28.4"));
  const per = { de: "2026-09-01", ate: "2026-09-30", estoque_inicial: 1000, compras: 3000, estoque_final: 1200, cmv_real: 2800, faturamento: null, cmv_pct: null, motivos: [] };
  const c = central("mes", { cmv: { periodo: per, meta: 30 } }).indicadores.cmv;
  assert.deepEqual([c.estado, c.valor, c.pct, c.saude], ["ok", 2800, null, null]);
  assert.match(c.motivoPct, /sem faturamento/);
  const comPct = central("mes", { cmv: { periodo: { ...per, cmv_pct: 36, faturamento: 7777.78 }, meta: 30 } });
  assert.equal(comPct.indicadores.cmv.saude, "acima");
  assert.ok(comPct.alertas.some((a) => a.id === "cmv" && a.impacto === "CMV 36% · meta 30%"));
  assert.equal(central("mes", { cmv: { periodo: { ...per, cmv_pct: 36 } } }).indicadores.cmv.saude, null, "sem meta configurada não julga");
});

test("CMO: valor absoluto da folha + extras; % só com faturamento do mês completo", () => {
  const c = central().indicadores.cmo;
  assert.deepEqual([c.estado, c.valor, c.pct], ["ok", 2000, null]);
  assert.equal(c.motivoPct, "Percentual indisponível porque o faturamento ainda não foi apurado.");
  const dias = Array.from({ length: 10 }, (_, i) => ({ data: `2026-10-${String(i + 1).padStart(2, "0")}`, valor: 1000 }));
  assert.equal(central("mes", { faturamento: { disponivel: true, dias } }).indicadores.cmo.pct, 20);
});

test("MARGEM, LUCRO e PONTO DE EQUILÍBRIO: dados insuficientes listam o que falta; com tudo do mês, calculam", () => {
  const ins = central().indicadores;
  assert.equal(ins.lucro.estado, "insuficiente");
  assert.match(ins.lucro.motivo, /faturamento do mês completo/);
  assert.match(ins.lucro.motivo, /custos fixos cadastrados/);
  const HOJE_FIM = "2026-09-30";
  const dias = Array.from({ length: 30 }, (_, i) => ({ data: `2026-09-${String(i + 1).padStart(2, "0")}`, valor: 1000 }));
  const r = montarCentral({ hoje: HOJE_FIM, intervalo: intervaloCentral("mes", HOJE_FIM), fontes: fontesBase({
    faturamento: { disponivel: true, dias }, custosFixos: { data: [{ nome: "Aluguel", valor: 6000 }], incluirFolha: true },
    cmv: { periodo: { de: "2026-09-01", ate: "2026-09-30", cmv_real: 9000, cmv_pct: 30, motivos: [] } },
  }) }).indicadores;
  assert.deepEqual(r.lucro, { estado: "ok", valor: 13000 }, "30000 − 9000 − 2000 − 6000");
  assert.deepEqual(r.margem, { estado: "ok", pct: 43.33 });
  assert.deepEqual(r.pontoEquilibrio, { estado: "ok", mensal: 11428.57, diario: 380.95, semanal: 2666.67 }, "(2000 + 6000) ÷ (1 − 0,30)");
});

test("ESTADOS: zero real com mensagem, erro com 'tentar novamente', nunca R$ 0,00 mudo", () => {
  const vazio = montarCentral({ hoje: HOJE, intervalo: intervaloCentral("mes", HOJE), fontes: fontesBase({ pagar: { data: [] }, fluxo: { data: [] }, cmo: { colaboradores: [], recibos: [] } }) });
  assert.deepEqual([vazio.cards.aPagar.estado, vazio.cards.aPagar.motivo], ["zero", "Nenhuma conta a pagar em aberto."]);
  assert.deepEqual([vazio.cards.aReceber.estado, vazio.cards.aReceber.motivo], ["zero", "Nenhuma conta a receber em aberto."]);
  assert.equal(vazio.cards.fluxo.estado, "zero");
  assert.equal(vazio.indicadores.cmo.estado, "zero");
  assert.ok(!vazio.alertas.some((a) => a.id === "vencidas"));
  const erro = central("mes", { pagar: { error: "timeout" }, fluxo: { error: "rede" } });
  assert.equal(erro.cards.aPagar.estado, "erro");
  assert.equal(erro.cards.fluxo.estado, "erro");
  assert.equal(erro.compromissos, null);
  const alErro = erro.alertas.filter((a) => a.recarregar);
  assert.deepEqual(alErro.map((a) => [a.prioridade, a.acao]), [["critico", "Tentar novamente"], ["critico", "Tentar novamente"]]);
  assert.equal(central("mes", { saldos: { data: [] } }).cards.saldoGerencial.estado, "nao_apurado");
});

test("COMPROMISSOS: vencidas mais antigas primeiro, depois hoje e 7 dias; limite e contagem", () => {
  const rows = [...PAGAR_REAL, conta("h", HOJE, 50), conta("n", "2026-10-13", 70), conta("longe", "2026-11-30", 90)];
  const c = compromissos(rows, HOJE, 4);
  assert.deepEqual(c.contagem, { vencidas: 4, hoje: 1, proximos7: 1 });
  assert.equal(c.total, 6);
  assert.deepEqual(c.linhas.map((l) => l.id), ["v2", "v1", "v3", "v4"]);
  assert.deepEqual(compromissos(rows, HOJE, 10).linhas.slice(4).map((l) => [l.id, l.status.rotulo]), [["h", "Vence hoje"], ["n", "Em 3 dias"]]);
  assert.equal(c.linhas[0].vencimentoBr, "22/06/2026", "data do banco, sem conversão de fuso");
  const leg = compromissos([conta("x", "2026-06-23", 10, { grupo: "LEGADO", natureza: "pessoal", categoria_texto_antigo: "cmo" })], HOJE);
  assert.equal(leg.linhas[0].categoria, "Pessoal (CMO)", "natureza legível, nunca 'LEGADO'");
  assert.equal(leg.linhas[0].vencimentoBr, "23/06/2026");
});

test("RESUMO DO HÉFISTO: só fatos dos dados (vencidas, faturamento, saldo)", () => {
  const r = central().resumo.map((x) => x.texto);
  assert.ok(r[0].startsWith("4 conta(s) vencida(s)"));
  assert.ok(r.some((t) => t.startsWith("Faturamento ainda não apurado")));
  assert.ok(r.some((t) => t.startsWith("Saldo de caixa do período negativo")));
  assert.ok(r.length <= 4);
});
