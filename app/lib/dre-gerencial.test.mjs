// Testes do DRE gerencial. O DRE antigo somava o extrato de teste como receita,
// todas as contas de todos os meses e zerava o CMV; aqui cada linha é
// conferida com um mês montado à mão, inclusive os percentuais.
import { janelaDoMes, faturamentoDoMes, montarDre, contasDaCompetencia, nomeDaCategoria } from "./dre-gerencial.mjs";

let falhas = 0;
function conferir(nome, recebido, esperado) {
  const ok = JSON.stringify(recebido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (recebido ${JSON.stringify(recebido)}, esperado ${JSON.stringify(esperado)})`}`);
}
const linha = (dre, id) => dre.linhas.find((l) => l.id === id);

// ─── Período ─────────────────────────────────────────────────────────────────
conferir("setembro fechado", janelaDoMes("2026-09", "2026-10-02"), { de: "2026-09-01", fimMes: "2026-09-30", ate: "2026-09-30", futuro: false, emAndamento: false });
conferir("outubro em andamento", janelaDoMes("2026-10", "2026-10-02").ate, "2026-10-02");
conferir("novembro futuro", janelaDoMes("2026-11", "2026-10-02").futuro, true);
conferir("fevereiro bissexto", janelaDoMes("2028-02", "2028-03-10").fimMes, "2028-02-29");

// ─── Faturamento ─────────────────────────────────────────────────────────────
const dia = (d, vb = 1100, ca = 50, de = 50) => ({ data: d, valor: vb - ca - de, detalhe: { vendas_brutas: vb, cancelamentos: ca, descontos: de } });
const diasDe = (mes, n) => Array.from({ length: n }, (_, i) => dia(`${mes}-${String(i + 1).padStart(2, "0")}`));
const fonte = { disponivel: true, nome: "faturamento diário informado", dias: diasDe("2026-09", 30) };
const set = janelaDoMes("2026-09", "2026-10-02");
const fat = faturamentoDoMes(fonte, set);
conferir("faturamento do mês", [fat.vendasBrutas, fat.cancelamentos, fat.descontos, fat.valor], [33000, 1500, 1500, 30000]);

const semTabela = faturamentoDoMes({ disponivel: false, motivo: "Não há fonte de faturamento no Héfisto." }, set);
conferir("sem fonte: sem dado com motivo", [semTabela.valor, semTabela.motivo], [null, "Não há fonte de faturamento no Héfisto."]);

const furado = faturamentoDoMes({ ...fonte, dias: fonte.dias.filter((d) => d.data !== "2026-09-07" && d.data !== "2026-09-21") }, set);
conferir("faltou dia: sem dado, nunca zero", [furado.valor, furado.diasFaltando], [null, ["2026-09-07", "2026-09-21"]]);
conferir("motivo lista os dias", furado.motivo, "Faltam 2 dia(s) de faturamento no mês: 07/09, 21/09.");

const out = janelaDoMes("2026-10", "2026-10-03");
const fOut = faturamentoDoMes({ ...fonte, dias: [dia("2026-10-01"), dia("2026-10-02")] }, out);
conferir("mês em andamento: hoje sem lançamento não é falta", [fOut.valor, fOut.ate], [2000, "2026-10-02"]);

// ─── DRE completo ────────────────────────────────────────────────────────────
const categorias = [
  { codigo: "imp_sobre_vendas", nome: "Impostos sobre vendas (Simples/DAS etc.)" },
  { codigo: "com_taxa_cartao", nome: "Taxas de cartão" },
  { codigo: "ocupacao_aluguel", nome: "Aluguel" },
  { codigo: "utilidades_energia", nome: "Energia elétrica" },
  { codigo: "pessoal_encargos", nome: "Encargos (INSS, FGTS)" },
  { codigo: "fin_tarifas_bancarias", nome: "Tarifas bancárias" },
  { codigo: "mercadoria_insumos", nome: "Mercadoria / insumos para estoque" },
  { codigo: "retirada_socios", nome: "Retirada de sócios" },
];
const c = (categoria_codigo, natureza, valor_original, extra = {}) => ({ categoria_codigo, natureza, valor_original, competencia_efetiva: "2026-09-01", situacao: "pendente", ...extra });
const contas = [
  c("imp_sobre_vendas", "deducao_receita", 1800),
  c("com_taxa_cartao", "custo_variavel", 600),
  c("legado_custo_variavel", "custo_variavel", 500, { categoria_texto_antigo: "custo_variavel", exige_revisao: true }),
  c("pessoal_salarios", "pessoal", 9000),
  c("pessoal_encargos", "pessoal", 1200),
  c("ocupacao_aluguel", "despesa_fixa", 4000, { situacao: "pago" }),
  c("utilidades_energia", "despesa_fixa", 1500, { competencia_inferida: true }),
  c("fin_tarifas_bancarias", "financeiro", 150),
  c("mercadoria_insumos", "mercadoria", 7000),
  c("retirada_socios", "distribuicao", 3000),
  c("ocupacao_aluguel", "despesa_fixa", 999, { situacao: "cancelado" }),
  c("utilidades_energia", "despesa_fixa", 777, { competencia_efetiva: "2026-08-01" }),
];
const params = { imposto_pct: 6, taxa_cartao_pct: 3, marketplace_pct: 2, pro_labore: [{ socio: "Lucas", valor_mensal: 2000 }] };
const cmv = { valor: 9000, estoqueInicial: 5000, compras: 7000, estoqueFinal: 3000, motivos: [] };
const dre = montarDre({ mes: "2026-09", janela: set, fat, contas, categorias, cmv, cmo: { folha: 8000, extras: 700 }, params });

conferir("contas da competência (sem cancelada, sem outro mês)", contasDaCompetencia(contas, "2026-09").length, 10);
conferir("faturamento 100%", [linha(dre, "faturamento").valor, linha(dre, "faturamento").pct], [30000, 100]);
conferir("vendas brutas 110%", linha(dre, "vendas_brutas").pct, 110);
conferir("impostos reais vencem o % configurado", [linha(dre, "impostos").valor, linha(dre, "impostos").pct, linha(dre, "impostos").natureza], [1800, 6, "real"]);
conferir("receita líquida", linha(dre, "receita_liquida").valor, 28200);
conferir("CMV real 30%", [linha(dre, "cmv").valor, linha(dre, "cmv").pct], [9000, 30]);
conferir("nota do CMV", linha(dre, "cmv").nota, "estoque inicial R$ 5.000,00 + compras R$ 7.000,00 − estoque final R$ 3.000,00");
conferir("lucro bruto", linha(dre, "lucro_bruto").valor, 19200);
const vari = linha(dre, "variaveis");
conferir("variáveis: cartão lançado + antigo + marketplace estimado", [vari.valor, vari.pct, vari.natureza], [1700, 5.67, "estimado"]);
conferir("cartão lançado dispensa o % da maquininha", vari.filhos.map((f) => f.rotulo), ["Taxas de cartão", "Custo variável (lançamento antigo)", "Comissão de marketplace (iFood etc.) — 2% configurado"]);
conferir("margem de contribuição", linha(dre, "contribuicao").valor, 17500);
const pes = linha(dre, "pessoal");
conferir("pessoal: RH + encargos, sem contar salário duas vezes", [pes.valor, pes.pct], [9900, 33]);
conferir("pessoal detalhado", pes.filhos.map((f) => [f.rotulo, f.valor]), [["Salários e vale-alimentação (cadastro do RH)", 8000], ["Extras e diárias (recibos do RH)", 700], ["Encargos (INSS, FGTS)", 1200]]);
conferir("nota da exclusão", pes.nota, "R$ 9.000,00 em contas de salário do mês não somados: o salário vem do RH.");
const fix = linha(dre, "fixas");
conferir("fixas por categoria com nome", fix.filhos.map((f) => [f.rotulo, f.valor, f.pct]), [["Aluguel", 4000, 13.33], ["Energia elétrica", 1500, 5]]);
conferir("pró-labore configurado", [linha(dre, "pro_labore").valor, linha(dre, "pro_labore").natureza], [2000, "configurado"]);
conferir("resultado operacional", linha(dre, "operacional").valor, 100);
conferir("financeiro", linha(dre, "financeiro").valor, 150);
conferir("resultado do mês", [dre.resultado.valor, dre.resultado.pct], [-50, -0.17]);
conferir("fora do resultado", dre.fora.map((f) => [f.rotulo, f.valor]), [["Compras de mercadoria e insumos", 7000], ["Retirada de sócios", 3000]]);
conferir("alertas: competência inferida e categoria antiga", dre.alertas, [
  "1 conta(s) sem competência informada entraram pelo mês do vencimento.",
  "1 conta(s) numa categoria antiga que precisa de revisão — reclassifique em Contas a Pagar para cair na linha certa.",
]);
conferir("ordem das linhas", dre.linhas.map((l) => l.id), [
  "vendas_brutas", "cancelamentos", "descontos", "faturamento", "impostos", "receita_liquida", "cmv", "lucro_bruto",
  "variaveis", "contribuicao", "pessoal", "fixas", "pro_labore", "operacional", "financeiro", "resultado",
]);

// Sem salário no RH: a conta de salário entra (não pode sumir o custo).
const semRH = montarDre({ mes: "2026-09", janela: set, fat, contas, categorias, cmv, cmo: { folha: 0, extras: 0 }, params });
conferir("sem RH, salário vem das contas", linha(semRH, "pessoal").filhos.map((f) => [f.rotulo, f.valor]), [["Salários (contas a pagar)", 9000], ["Encargos (INSS, FGTS)", 1200]]);

// Sem imposto lançado: usa o % configurado, marcado como estimado.
const semImp = montarDre({ mes: "2026-09", janela: set, fat, contas: contas.filter((x) => x.natureza !== "deducao_receita"), categorias, cmv, cmo: { folha: 8000 }, params });
conferir("imposto estimado pelo %", [linha(semImp, "impostos").valor, linha(semImp, "impostos").natureza], [1800, "estimado"]);

// Nem lançado nem configurado: zero marcado e alerta (não esconde).
const nada = montarDre({ mes: "2026-09", janela: set, fat, contas: [], categorias, cmv, cmo: { folha: 8000 }, params: {} });
conferir("imposto sem lançamento vira alerta", [linha(nada, "impostos").natureza, nada.alertas.some((a) => a.startsWith("Impostos sobre vendas não entraram"))], ["sem_lancamento", true]);
conferir("cartão sem lançamento vira alerta", nada.alertas.some((a) => a.startsWith("Taxas de cartão não entraram")), true);

// CMV sem inventário: lucro bruto para baixo fica sem dado, com o motivo.
const semCmv = montarDre({ mes: "2026-09", janela: set, fat, contas, categorias, cmv: { valor: null, motivos: ["Não há inventário fechado no início do período (01/09/2026)."] }, cmo: { folha: 8000 }, params });
conferir("CMV sem dado propaga", [linha(semCmv, "cmv").valor, linha(semCmv, "cmv").natureza, linha(semCmv, "lucro_bruto").valor, semCmv.resultado.valor], [null, "sem_dado", null, null]);
conferir("motivo do CMV", linha(semCmv, "cmv").nota, "Não há inventário fechado no início do período (01/09/2026).");

// Sem faturamento: tudo que depende dele sem dado; simulação só quando digitada.
const semFat = montarDre({ mes: "2026-09", janela: set, fat: semTabela, contas, categorias, cmv, cmo: { folha: 8000 }, params });
conferir("sem faturamento: resultado sem dado", [linha(semFat, "faturamento").valor, semFat.resultado.valor, linha(semFat, "fixas").valor, linha(semFat, "fixas").pct], [null, null, 5500, null]);
const sim = montarDre({ mes: "2026-09", janela: set, fat: semTabela, contas, categorias, cmv: { valor: null, motivos: [] }, cmo: { folha: 8000, extras: 700 }, params, simulacao: { faturamento: 30000, cmvPct: 30 } });
conferir("simulação marca a natureza", [sim.simulando, linha(sim, "faturamento").natureza, linha(sim, "cmv").natureza, linha(sim, "cmv").valor], [true, "simulacao", "simulacao", 9000]);
conferir("simulação chega no mesmo resultado", sim.resultado.valor, -50);

const comBeneficio = montarDre({ mes: "2026-09", janela: set, fat, contas: [...contas, c("pessoal_beneficios", "pessoal", 400)], categorias, cmv, cmo: { folha: 8000 }, params });
conferir("benefício em conta + VA no RH vira alerta", comBeneficio.alertas.some((a) => a.includes("vale-alimentação")), true);

conferir("categoria antiga sem nome no plano", nomeDaCategoria({ categoria_texto_antigo: "custo_fixo" }), "Custo fixo (lançamento antigo)");
conferir("código desconhecido fica legível", nomeDaCategoria({ categoria_codigo: "utilidades_gas" }), "Utilidades gas");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
