// Resultado do mês: contas exatas, nada inventado. Rode: node --test app/lib/resultado-mes.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { modeloInicial, calcularResultado, cmvDoMes, valorDoItem, depreciacaoMensal } from "./resultado-mes.mjs";

const valor = (r, id) => r.linhas.find((l) => l.id === id);

function mes() {
  const m = modeloInicial();
  m.faturamento = "100.000,00";
  m.impostos_pct = "6";
  m.cartao = { parte_credito_pct: "50", parte_debito_pct: "30", taxa_credito_pct: "3", taxa_debito_pct: "1,5" };
  m.encargos_pct = "10";
  m.itens.fixos = [{ id: "a", nome: "Aluguel", valor: "8000", subitens: [] }, { id: "e", nome: "Energia", valor: "999", subitens: [{ id: "e1", nome: "Cozinha", valor: "2000" }, { id: "e2", nome: "Salão", valor: "1000" }] }];
  m.itens.variaveis = [{ id: "v", nome: "Embalagens", valor: "2000", subitens: [] }];
  m.itens.outros = [{ id: "o", nome: "Manutenção", valor: "500", subitens: [] }];
  m.depreciacao = [{ id: "d", nome: "Forno", valor_bem: "24000", vida_meses: "120" }];
  return m;
}
const CMV = { valor: 30000, natureza: "ESTIMATIVA", motivo: "x" };
const CMO = { folha: 15000, extras: 2000, total: 17000 };

test("DRE do mês: do faturamento ao lucro líquido, com % de cada linha", () => {
  const r = calcularResultado(mes(), { cmv: CMV, cmo: CMO });
  assert.equal(valor(r, "faturamento").valor, 100000);
  assert.equal(valor(r, "impostos").valor, 6000);
  // crédito 50% × 3% = 1.500; débito 30% × 1,5% = 450
  assert.equal(valor(r, "cartao").valor, 1950);
  assert.equal(valor(r, "receita_liquida").valor, 92050);
  assert.equal(valor(r, "lucro_bruto").valor, 62050);
  // CMO 17.000 + encargos 10% da folha (1.500)
  assert.equal(valor(r, "cmo").valor, 18500);
  assert.equal(valor(r, "margem").valor, 62050 - 18500 - 2000);
  // fixos: aluguel 8.000 + energia = soma dos subcustos (3.000), não os 999 digitados
  assert.equal(valor(r, "fixos").valor, 11000);
  assert.equal(valor(r, "depreciacao").valor, 200);
  assert.equal(r.lucroLiquido, 62050 - 18500 - 2000 - 11000 - 500 - 200);
  assert.equal(r.lucroPct, 29.85);
  assert.equal(valor(r, "cmv").pct, 30);
  assert.equal(r.natureza, "ESTIMATIVA");
  assert.equal(r.fatias.length, 7);
});

test("sem CMV, sem CMO ou sem faturamento: DADOS INSUFICIENTES (lucro não inventado)", () => {
  const r = calcularResultado(mes(), { cmv: { valor: null }, cmo: null });
  assert.equal(r.lucroLiquido, null);
  assert.deepEqual(r.faltam, ["CMV (contagens de estoque ou valor informado)", "CMO (equipe no RH)"]);
  assert.equal(r.natureza, "DADOS INSUFICIENTES");
  assert.deepEqual(r.fatias, []);
  // CMV informado à mão vale quando não há contagem
  const m = mes(); m.cmv_manual = "28000";
  const r2 = calcularResultado(m, { cmv: { valor: null }, cmo: CMO });
  assert.equal(valor(r2, "cmv").valor, 28000);
  assert.equal(valor(r2, "cmv").natureza, "INFORMADO");
  const vazio = calcularResultado(modeloInicial(), { cmv: CMV, cmo: CMO });
  assert.equal(vazio.faturamento, 0);
  assert.equal(valor(vazio, "cmv").pct, null);
});

test("subcustos e depreciação", () => {
  assert.equal(valorDoItem({ valor: "1.234,50", subitens: [] }), 1234.5);
  assert.equal(valorDoItem({ valor: "10", subitens: [{ valor: "3" }, { valor: "" }] }), 3);
  assert.equal(depreciacaoMensal({ valor_bem: "12000", vida_meses: "60" }), 200);
  assert.equal(depreciacaoMensal({ valor_bem: "12000", vida_meses: "" }), 0);
});

test("CMV do mês pelas contagens: média diária × dias do mês; REAL só se cobrir o mês", () => {
  const p = (de, ateEx, dias, v, status = "apurado") => ({ periodo: { de, ateExclusivo: ateEx, dias }, status, cmv: { valor: v } });
  // 4 semanas de outubro (28 dias, R$ 28.000) → 1.000/dia × 31
  const out = cmvDoMes([p("2026-10-01", "2026-10-08", 7, 7000), p("2026-10-08", "2026-10-15", 7, 7000), p("2026-10-15", "2026-10-22", 7, 7000), p("2026-10-22", "2026-10-29", 7, 7000), p("2026-10-29", "2026-11-05", 7, null, "em_andamento")], "2026-10");
  assert.equal(out.valor, 31000);
  assert.equal(out.natureza, "ESTIMATIVA");
  const cheio = cmvDoMes([p("2026-10-01", "2026-11-01", 31, 31000)], "2026-10");
  assert.equal(cheio.natureza, "REAL");
  assert.equal(cheio.valor, 31000);
  // sem período no mês: usa os últimos apurados
  const fora = cmvDoMes([p("2026-08-01", "2026-08-08", 7, 3500)], "2026-10");
  assert.equal(fora.valor, 15500);
  assert.match(fora.motivo, /últimos apurados/);
  assert.equal(cmvDoMes([], "2026-10").natureza, "DADOS INSUFICIENTES");
});

test("custo por dia e ponto de equilíbrio (quanto vender por dia para não ter prejuízo)", () => {
  const m = mes(); m.dias_abertos = "25";
  const r = calcularResultado(m, { cmv: CMV, cmo: CMO });
  const fix = r.linhas.find((l) => l.id === "fixos");
  assert.equal(fix.porDia, 440);
  assert.equal(fix.itens.find((i) => i.id === "a").porDia, 320);
  assert.equal(fix.itens.find((i) => i.id === "e").subitens[0].porDia, 80);
  assert.equal(r.linhas.find((l) => l.id === "cmo").porDia, 740);
  // sai de cada venda: 6.000 + 1.950 + 30.000 + 2.000 = 39,95% → sobram 60,05%
  // não mudam: 18.500 + 11.000 + 500 + 200 = 30.200 → 30.200 ÷ 0,6005
  const e = r.equilibrio;
  assert.equal(e.custosFixos, 30200);
  assert.equal(e.margemPct, 60.05);
  assert.equal(e.mes, 50291.42);
  assert.equal(e.dia, 2011.66);
  assert.equal(e.folgaMes, 49708.58);
  assert.equal(e.natureza, "ESTIMATIVA");
  const semFat = calcularResultado({ ...m, faturamento: "" }, { cmv: CMV, cmo: CMO });
  assert.equal(semFat.equilibrio.natureza, "DADOS INSUFICIENTES");
  const semDias = calcularResultado({ ...m, dias_abertos: "" }, { cmv: CMV, cmo: CMO });
  assert.equal(semDias.equilibrio.dia, null);
  assert.ok(semDias.equilibrio.mes > 0);
});

test("equipe pessoa por pessoa: salário + taxa de serviço + bônus + vales + encargos, por dia", async () => {
  const { equipeDoMes } = await import("./resultado-mes.mjs");
  const colab = [
    { id: "1", nome: "Ana", salario: 2000, vale_alimentacao: 300, taxa_servico_mes: 500, usa_vale_transporte: true, vale_transporte_val: 200, tipo_contrato: "Fixo" },
    { id: "2", nome: "Bia", salario: 1800, vale_alimentacao: 0, taxa_servico_mes: 250, tipo_contrato: "Fixo", vale_transporte_val: 999 },
    { id: "3", nome: "Free", salario: 150, tipo_contrato: "Freelancer" },
    { id: "4", nome: "Saiu", salario: 3000, status: "inativo" },
  ];
  const e = equipeDoMes(colab, { bonus: "400", encargos_pct: "10", dias: 25, extrasPagos: 600 });
  assert.equal(e.pessoas.length, 2);
  const ana = e.pessoas.find((p) => p.nome === "Ana");
  // 2.000 + 500 (VA 300 + VT 200) + 500 taxa + 400 bônus + 200 encargos
  assert.equal(ana.total, 3600);
  assert.equal(ana.porDia, 144);
  const bia = e.pessoas.find((p) => p.nome === "Bia");
  assert.equal(bia.vale, 0); // não usa VT: os 999 não contam
  assert.equal(bia.total, 1800 + 250 + 400 + 180);
  assert.equal(e.total, 3600 + 2630 + 600);
  assert.equal(e.bonus, 800);
  const r = calcularResultado(mes(), { cmv: CMV, cmo: e });
  assert.equal(r.linhas.find((l) => l.id === "cmo").valor, e.total);
  assert.ok(r.linhas.find((l) => l.id === "cmo").detalhe.some((d) => d.id === "taxa" && d.valor === 750));
});

test("taxa de serviço lançada no mês vale no lugar da do RH; mês novo herda faturamento e taxas", async () => {
  const { equipeDoMes, mesHerdado } = await import("./resultado-mes.mjs");
  const colab = [{ id: "1", nome: "Ana", salario: 2000, taxa_servico_mes: 500, tipo_contrato: "Fixo" }, { id: "2", nome: "Bia", salario: 1000, taxa_servico_mes: 100, tipo_contrato: "Fixo" }];
  const e = equipeDoMes(colab, { taxas: { 1: "850,50", 2: "" } });
  assert.equal(e.pessoas.find((p) => p.id === "1").taxaServico, 850.5);
  assert.equal(e.pessoas.find((p) => p.id === "1").taxaDoRh, false);
  assert.equal(e.pessoas.find((p) => p.id === "2").taxaServico, 100);
  const todos = { "2026-09": { ...modeloInicial(), faturamento: "90000", taxas_servico: { 1: "700" }, cmv_manual: "25000" } };
  const nov = mesHerdado(todos, "2026-11");
  assert.equal(nov.herdadoDe, "2026-09");
  assert.equal(nov.modelo.faturamento, "90000");
  assert.equal(nov.modelo.taxas_servico[1], "700");
  assert.equal(nov.modelo.cmv_manual, "");
  assert.equal(mesHerdado(todos, "2026-08").herdadoDe, null);
});

test("semanas do CMV: entrou, saiu, estoque e % da semana; ticket médio", async () => {
  const { semanasDoCmv, ticketMedio } = await import("./resultado-mes.mjs");
  const ap = [
    { periodo: { id: "a", de: "2026-10-01", ate: "2026-10-07", dias: 7 }, status: "apurado", ei: { valor: 30000 }, compras: { valor: 10000 }, ef: { valor: 32000 }, cmv: { valor: 8000 }, faturamento: { valor: null } },
    { periodo: { id: "b", de: "2026-10-08", ate: "2026-10-14", dias: 7 }, status: "em_andamento", ei: { valor: 32000 }, compras: { valor: 2000 }, ef: { valor: null }, cmv: { valor: null }, faturamento: { valor: 20000 }, motivos: ["Aguardando a próxima contagem de estoque."] },
  ];
  const s = semanasDoCmv(ap, { mes: "2026-10", faturamentoMes: 124000 });
  assert.equal(s[0].id, "b");
  const a = s.find((x) => x.id === "a");
  // 124.000 ÷ 31 × 7 = 28.000 → 8.000 ÷ 28.000 = 28,57%
  assert.equal(a.faturamento, 28000);
  assert.equal(a.naturezaFaturamento, "ESTIMATIVA");
  assert.equal(a.cmvPct, 28.57);
  assert.equal(a.estoqueFim, 32000);
  assert.equal(s[0].cmvPct, null);
  assert.match(s[0].motivo, /Aguardando/);
  assert.equal(ticketMedio("100000", "2500", 25).valor, 40);
  assert.equal(ticketMedio("100000", "2500", 25).pedidosPorDia, 100);
  assert.equal(ticketMedio("100000", "").valor, null);
});

test("parâmetros da casa vêm do Resultado do mês (no lugar da Pizza do Lucro)", async () => {
  const { parametrosDoResultado, sobreporParametros } = await import("./resultado-mes.mjs");
  const todos = {
    "2026-09": { impostos_pct: "6", cartao: { parte_credito_pct: "50", taxa_credito_pct: "3", parte_debito_pct: "30", taxa_debito_pct: "1,5" }, meta_lucro_pct: "20" },
    "2026-10": { impostos_pct: "8", cartao: {}, meta_lucro_pct: "" },
  };
  const p = parametrosDoResultado(todos, "2026-10");
  assert.equal(p.mes, "2026-10");
  assert.equal(p.imposto_pct, 8);
  assert.equal(p.taxa_cartao_pct, null);
  assert.equal(p.margem_alvo_pct, null);
  const set = parametrosDoResultado(todos, "2026-09");
  // 50% × 3% + 30% × 1,5% = 1,95% do faturamento
  assert.equal(set.taxa_cartao_pct, 1.95);
  assert.equal(set.margem_alvo_pct, 20);
  const s = sobreporParametros({ imposto_pct: 5, taxa_cartao_pct: 3, margem_alvo_pct: 25, outro: 1 }, p);
  assert.deepEqual([s.imposto_pct, s.taxa_cartao_pct, s.margem_alvo_pct, s.outro], [8, 3, 25, 1]);
  assert.match(s.origem_parametros, /Resultado do mês/);
  assert.equal(parametrosDoResultado({}, "2026-10").mes, null);
});

test("marmitaria: config vazia usa o Resultado do mês; a própria prevalece", async () => {
  const { configComResultado } = await import("./resultado-mes.mjs");
  const res = { mes: "2026-10", imposto_pct: 8, margem_alvo_pct: 20 };
  const a = configComResultado({ tributos_pct: null, margem_alvo_pct: 30 }, res);
  assert.equal(a.tributos_pct, 8);
  assert.equal(a.margem_alvo_pct, 30);
  assert.deepEqual(a.doResultado, { tributos_pct: "2026-10" });
  const b = configComResultado({ tributos_pct: null, margem_alvo_pct: null }, { mes: null, imposto_pct: null, margem_alvo_pct: null });
  assert.equal(b.tributos_pct, null);
});
