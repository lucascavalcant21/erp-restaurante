// Testes do custo por dia e do simulador. Rode com: node app/lib/custo-diario.test.mjs

import { contasPorDia, equipePorDia, simularMes, unidadesParaSobrar, equilibrioDoCardapio } from "./custo-diario.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}
const r2 = (n) => Math.round(n * 100) / 100;

// ── Contas da casa por dia ────────────────────────────────────────────────
const PARAMS = {
  dias_operacao_mes: 26,
  custo_aluguel_mes: 6000, custo_luz_mes: 1300, custo_gas_mes: 700,
  custo_agua_mes: 400, custo_limpeza_mes: 200, custo_outros_mes: 0,
};
const contas = contasPorDia(PARAMS);
conferir("total do mes", contas.totalMes, 8600);
conferir("aluguel por dia", r2(contas.itens.find(i => i.chave === "custo_aluguel_mes").dia), 230.77);
conferir("luz por dia", r2(contas.itens.find(i => i.chave === "custo_luz_mes").dia), 50);
conferir("agua por dia", r2(contas.itens.find(i => i.chave === "custo_agua_mes").dia), 15.38);
conferir("total por dia", r2(contas.totalDia), 330.77);
// Conta zerada nao vira linha vazia na tela.
conferir("conta zerada fica de fora", contas.itens.some(i => i.mes === 0), "false");
// Sem dias de operacao nao da para dividir: marca, nao inventa.
conferir("sem dias nao rateia", contasPorDia({ ...PARAMS, dias_operacao_mes: 0 }).rateavel, "false");
conferir("sem dias o valor do dia fica zero", contasPorDia({ ...PARAMS, dias_operacao_mes: 0 }).totalDia, 0);

// ── Equipe por dia ────────────────────────────────────────────────────────
const EQUIPE = [
  { id: "1", nome: "Ana", salario: 1560, vale_alimentacao: 300 },     // 1860/26 = 71,54
  { id: "2", nome: "Bia", salario: 2600 },                             // 2600/26 = 100
  { id: "3", nome: "Caio", salario: 130, tipo_contrato: "Freelancer" },
  { id: "4", nome: "Dina", salario: 5000, status: "inativo" },
];
const eq = equipePorDia(EQUIPE, 26);
conferir("dois fixos", eq.fixos.length, 2);
conferir("um extra", eq.extras.length, 1);
conferir("inativo fica de fora", eq.fixos.concat(eq.extras).some(p => p.nome === "Dina"), "false");
conferir("fixo divide o mes pelos dias", r2(eq.fixos.find(p => p.nome === "Ana").dia), 71.54);
// A diaria do extra JA e de um dia: dividir de novo diria que ele custa R$ 5.
conferir("extra custa a diaria cheia no dia que vem", eq.extras[0].dia, 130);
conferir("extra nao tem custo mensal fixo", eq.extras[0].mes, 0);
conferir("mais caro primeiro", eq.fixos[0].nome, "Bia");
conferir("total dos fixos por dia", r2(eq.totalFixosDia), 171.54);
conferir("sem dias nao rateia a equipe", equipePorDia(EQUIPE, 0).rateavel, "false");

// ── Simulacao ─────────────────────────────────────────────────────────────
// Prato de R$ 45, CMV R$ 11,24, imposto 4% e maquininha 2,5%.
// variavel = 45 * 6,5% = 2,925 ; contribuicao = 45 - 11,24 - 2,925 = 30,835
const sim = simularMes({
  preco: 45, custoCmvUnit: 11.24, impostoPct: 4, taxaMaquininhaPct: 2.5,
  custoFixoMes: 8600, cmoMes: 17697.44, unidadesMes: 1000,
});
// O valor exato e 30,835. Arredondar para centavos aqui da 30,83, nao 30,84:
// 30.835*100 vira 3083.4999... em ponto flutuante. Por isso a conferencia do
// total (30.835 x 1000 = 30835, abaixo) e a que prova o valor de verdade.
conferir("contribuicao por unidade", r2(sim.contribuicaoUnit), 30.83);
conferir("contribuicao exata sem arredondar", sim.contribuicaoUnit.toFixed(3), "30.835");
conferir("margem de contribuicao em %", r2(sim.contribuicaoPct), 68.52);
conferir("fixo total do mes", r2(sim.fixoTotal), 26297.44);
conferir("receita de 1000 pratos", sim.receita, 45000);
conferir("contribuicao total", r2(sim.contribuicaoTotal), 30835);
// 30.835 - 26.297,44 = 4.537,56
conferir("quanto sobra no fim do mes", r2(sim.sobra), 4537.56);
// 26.297,44 / 30,835 = 852,8 -> 853 pratos
conferir("quantos pratos para empatar", sim.unidadesParaEmpatar, 853);
conferir("quanto faturar para empatar", sim.receitaParaEmpatar, 38385);

// Vender MENOS que o equilibrio da sobra negativa, e a conta precisa dizer isso.
const pouco = simularMes({
  preco: 45, custoCmvUnit: 11.24, impostoPct: 4, taxaMaquininhaPct: 2.5,
  custoFixoMes: 8600, cmoMes: 17697.44, unidadesMes: 500,
});
conferir("vender pouco da prejuizo", pouco.sobra < 0, "true");

// Prato que nao cobre nem o proprio custo: nao existe quantidade que empate.
const ruim = simularMes({ preco: 10, custoCmvUnit: 12, impostoPct: 4, taxaMaquininhaPct: 2.5, custoFixoMes: 1000, cmoMes: 0, unidadesMes: 100 });
conferir("contribuicao negativa", ruim.contribuicaoUnit < 0, "true");
conferir("sem quantidade que empate", ruim.unidadesParaEmpatar, null);
conferir("nem receita que empate", ruim.receitaParaEmpatar, null);

// Preco zero nao vira divisao por zero.
conferir("preco zero nao quebra a margem", simularMes({ preco: 0 }).contribuicaoPct, 0);

// ── Caminho inverso: quanto vender para SOBRAR um alvo ────────────────────
// (26.297,44 + 10.000) / 30,835 = 1177,1 -> 1178
conferir("quantos pratos para sobrar 10 mil",
  unidadesParaSobrar({ alvo: 10000, contribuicaoUnit: 30.835, fixoTotal: 26297.44 }), 1178);
conferir("sem contribuicao nao existe alvo alcancavel",
  unidadesParaSobrar({ alvo: 10000, contribuicaoUnit: -1, fixoTotal: 1000 }), null);

// ── Equilibrio do cardapio inteiro ────────────────────────────────────────
// Fixo 8.600 + CMO 17.697,44 = 26.297,44 no mes; /26 = 1.011,44 por dia.
// Variavel = 30 (meta cmv) + 4 (imposto) + 2,5 (cartao) + 3 (embalagem) = 39,5
// Margem = 60,5%  ->  1.011,44 / 0,605 = 1.671,80 por dia.
const eqC = equilibrioDoCardapio({
  params: { ...PARAMS, meta_cmv: 30, imposto_pct: 4, taxa_cartao_pct: 2.5, embalagem_pct: 3 },
  cmoMes: 17697.44,
});
conferir("fixo do mes inclui o cmo", r2(eqC.fixoMes), 26297.44);
conferir("fixo por dia", r2(eqC.fixoDia), 1011.44);
conferir("percentual variavel", eqC.variavelPct, 39.5);
conferir("margem sobre a venda", eqC.margemPct, 60.5);
conferir("faturamento por dia para empatar", r2(eqC.faturamentoDia), 1671.8);
conferir("faturamento do mes para empatar", r2(eqC.faturamentoMes), 43466.84);

// Margem zero ou negativa: nenhum faturamento empata, e a conta precisa dizer
// isso em vez de devolver Infinity ou um numero gigante.
const semMargem = equilibrioDoCardapio({ params: { ...PARAMS, meta_cmv: 90, imposto_pct: 8, taxa_cartao_pct: 5 }, cmoMes: 1000 });
conferir("margem negativa nao tem equilibrio", semMargem.faturamentoDia, null);
conferir("e a margem aparece negativa", semMargem.margemPct < 0, "true");

// Sem dias de operacao nao da para dividir.
conferir("sem dias nao calcula equilibrio",
  equilibrioDoCardapio({ params: { meta_cmv: 30, dias_operacao_mes: 0 }, cmoMes: 0 }).faturamentoDia, null);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
