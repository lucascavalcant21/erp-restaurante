// DRE gerencial do mês, por competência — estrutura do PLANO-F2.1 §5.2, com a
// mesma régua da Pizza do Lucro (visaoGerencialDoPeriodo): cada linha em R$ e
// em % do faturamento, com a natureza do dado, e linha sem fonte sai "sem
// dado" com o motivo — nunca zero.
//
// O DRE anterior somava o extrato (lancamentos: 1 linha de teste, R$ 29,90)
// como receita, TODAS as contas a pagar de todos os meses, CMV sempre zero e o
// CMO só do mês atual; o seletor de período não fazia nada. Aqui:
//
//   Faturamento    fin_faturamento_diario (vendas − cancelamentos − descontos),
//                  o mesmo do CMV %. Faltou um dia → sem dado.
//   Impostos       contas de natureza deducao_receita com competência no mês;
//                  sem lançamento, o % configurado (estimado).
//   CMV real       inventário no 1º dia + compras − inventário do dia seguinte
//                  ao fim do mês (cmv-real.mjs). Sem as contagens → sem dado.
//   Variáveis      contas custo_variavel; o que não foi lançado entra pelo %
//                  configurado (estimado).
//   Pessoal (CMO)  salários e extras do RH (como a Pizza); contas de salário e
//                  extras do mês ficam de fora para não contar duas vezes;
//                  encargos, benefícios e taxa de serviço vêm das contas.
//   Fixas          despesa_fixa + outros, por categoria (nome do plano de contas).
//   Pró-labore     o configurado na Pizza do Lucro.
//   Financeiro     tarifas, juros e multas.
//   Fora           mercadoria (vai para o estoque e volta pelo CMV),
//                  investimento, retirada de sócios, perda antiga a revisar.

import { percentualDe, arred2, fmtReais } from "./valor-percentual.mjs";
import { somarDiasIso } from "./cmv-real.mjs";
import { proLaboreDoMes } from "./composicao-preco.mjs";

const pos = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const ddmm = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;
const soma = (xs) => arred2(xs.reduce((t, x) => t + (Number(x) || 0), 0));

// ─── Período ─────────────────────────────────────────────────────────────────

export function janelaDoMes(mes, hojeIso) {
  const [a, m] = String(mes).split("-").map(Number);
  const de = `${mes}-01`;
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const fimMes = `${mes}-${String(ultimo).padStart(2, "0")}`;
  const mesHoje = String(hojeIso).slice(0, 7);
  if (mes > mesHoje) return { de, fimMes, ate: null, futuro: true, emAndamento: false };
  const emAndamento = mes === mesHoje;
  return { de, fimMes, ate: emAndamento ? hojeIso : fimMes, futuro: false, emAndamento };
}

// ─── Faturamento ─────────────────────────────────────────────────────────────

/**
 * fonte: fonteFaturamento de carregarDadosCmv ({ disponivel, motivo, nome,
 * dias: [{ data, valor (receita), detalhe: { vendas_brutas, cancelamentos, descontos } }] }).
 * No mês em andamento, hoje ainda sem lançamento não conta como falta.
 */
export function faturamentoDoMes(fonte, janela) {
  const vazio = (motivo, extra = {}) => ({
    valor: null, vendasBrutas: null, cancelamentos: null, descontos: null,
    motivo, fonte: fonte?.nome || null, diasFaltando: [], ate: janela.ate, ...extra,
  });
  if (janela.futuro) return vazio("O mês ainda não começou.");
  if (!fonte || !fonte.disponivel) return vazio(fonte?.motivo || "Sem fonte de faturamento.");
  const porDia = new Map((fonte.dias || []).map((d) => [String(d.data).slice(0, 10), d]));
  let ate = janela.ate;
  if (janela.emAndamento && !porDia.has(ate)) ate = somarDiasIso(ate, -1);
  if (ate < janela.de) return vazio("Nenhum dia do mês com faturamento lançado ainda.", { ate });
  let vb = 0, ca = 0, de = 0, rec = 0;
  const faltando = [];
  for (let d = janela.de; d <= ate; d = somarDiasIso(d, 1)) {
    const x = porDia.get(d);
    if (!x) { faltando.push(d); continue; }
    const det = x.detalhe || {};
    vb += Number(det.vendas_brutas ?? x.valor) || 0;
    ca += Number(det.cancelamentos) || 0;
    de += Number(det.descontos) || 0;
    rec += Number(x.valor) || 0;
  }
  if (faltando.length) {
    const lista = faltando.slice(0, 6).map(ddmm).join(", ") + (faltando.length > 6 ? "…" : "");
    return vazio(`Faltam ${faltando.length} dia(s) de faturamento no mês: ${lista}.`, { diasFaltando: faltando, ate });
  }
  return {
    valor: arred2(rec), vendasBrutas: arred2(vb), cancelamentos: arred2(ca), descontos: arred2(de),
    motivo: null, fonte: fonte.nome, diasFaltando: [], ate,
  };
}

// ─── Contas do mês ───────────────────────────────────────────────────────────

const LEGADO = {
  custo_variavel: "Custo variável (lançamento antigo)", custo_fixo: "Custo fixo (lançamento antigo)",
  cmo: "Pessoal (lançamento antigo)", cmv: "Lançado como CMV (lançamento antigo)",
  impostos: "Impostos (lançamento antigo)", inventarios: "Inventários/quebras (lançamento antigo)",
};
const bonito = (t) => {
  const s = String(t || "").trim();
  if (!s) return "Sem categoria";
  if (LEGADO[s]) return LEGADO[s];
  const x = s.replace(/_/g, " ");
  return x.charAt(0).toUpperCase() + x.slice(1);
};

export function nomeDaCategoria(conta, nomes = new Map()) {
  return nomes.get(conta?.categoria_codigo) || bonito(conta?.categoria_texto_antigo || conta?.categoria_codigo);
}

export function contasDaCompetencia(contas, mes) {
  return (contas || []).filter((c) => c?.situacao !== "cancelado" && String(c?.competencia_efetiva || "").slice(0, 7) === mes);
}

function agrupar(contas, nomes) {
  const g = new Map();
  for (const c of contas) {
    const codigo = c.categoria_codigo || `texto:${c.categoria_texto_antigo || ""}`;
    const atual = g.get(codigo) || { codigo: c.categoria_codigo || null, rotulo: nomeDaCategoria(c, nomes), valor: 0, qtd: 0 };
    atual.valor += Number(c.valor_original) || 0;
    atual.qtd += 1;
    g.set(codigo, atual);
  }
  return [...g.values()].map((x) => ({ ...x, valor: arred2(x.valor), natureza: "real" })).sort((a, b) => b.valor - a.valor);
}

const SALARIOS = ["pessoal_salarios", "legado_cmo"];
const EXTRAS = ["pessoal_extras"];
const ENCARGOS = ["pessoal_encargos"];
// % configurados na Pizza do Lucro → categorias que, lançadas, tornam o % desnecessário.
const VARIAVEIS_CONFIGURADAS = [
  { param: "taxa_cartao_pct", codigos: ["com_taxa_cartao"], rotulo: "Taxas de cartão (maquininha)", essencial: true },
  { param: "comissao_pct", codigos: ["com_comissoes"], rotulo: "Comissões" },
  { param: "marketplace_pct", codigos: ["com_comissao_marketplace"], rotulo: "Comissão de marketplace (iFood etc.)" },
  { param: "outras_variaveis_pct", codigos: [], rotulo: "Outras despesas variáveis" },
];
const fmtPctTexto = (p) => `${Number(p).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

// ─── DRE ─────────────────────────────────────────────────────────────────────

/**
 * fat:        faturamentoDoMes(...)
 * cmv:        { valor|null, motivos[], estoqueInicial, compras, estoqueFinal }
 * cmo:        calcularCMO(...) do mês ({ folha, extras })
 * params:     parâmetros da unidade (Pizza do Lucro)
 * simulacao:  { faturamento, cmvPct } — só vale quando o faturamento real não existe
 */
export function montarDre({ mes, janela, fat, contas = [], categorias = [], cmv = null, cmo = null, params = {}, simulacao = null }) {
  const nomes = new Map((categorias || []).map((c) => [c.codigo, c.nome]));
  const doMes = contasDaCompetencia(contas, mes);
  const daNatureza = (...ns) => doMes.filter((c) => ns.includes(c.natureza || "outros"));
  const simulando = fat.valor === null && pos(simulacao?.faturamento) > 0;
  const base = simulando ? arred2(pos(simulacao.faturamento)) : fat.valor;
  const linhas = [];
  const alertas = [];
  const pct = (v) => (v === null || base === null ? null : percentualDe(v, base));
  const add = (id, rotulo, valor, { tipo = "linha", natureza = "real", nota = null, filhos = [] } = {}) => {
    const linha = {
      id, rotulo, valor, tipo, natureza: valor === null && natureza !== "simulacao" ? "sem_dado" : natureza, nota,
      pct: pct(valor), filhos: filhos.map((f) => ({ ...f, pct: pct(f.valor) })),
    };
    linhas.push(linha);
    return valor;
  };
  const menos = (a, ...bs) => (a === null || bs.some((b) => b === null) ? null : arred2(a - bs.reduce((t, b) => t + b, 0)));
  const totalDosFilhos = (fs) => (fs.some((f) => f.valor === null) ? null : soma(fs.map((f) => f.valor)));

  if (janela.emAndamento) {
    alertas.push(`Mês em andamento: faturamento até ${fat.ate ? ddmm(fat.ate) : "hoje"}; as despesas do mês podem ainda não estar todas lançadas.`);
  }

  // 1. Faturamento
  if (simulando) {
    add("faturamento", "(=) Faturamento", base, { tipo: "subtotal", natureza: "simulacao", nota: `Simulação com valor digitado — não apurado. ${fat.motivo || ""}`.trim() });
  } else {
    const semFat = fat.valor === null;
    add("vendas_brutas", "Vendas brutas", fat.vendasBrutas, { nota: semFat ? fat.motivo : fat.fonte });
    add("cancelamentos", "(−) Cancelamentos", fat.cancelamentos);
    add("descontos", "(−) Descontos", fat.descontos);
    add("faturamento", "(=) Faturamento", fat.valor, { tipo: "subtotal", nota: semFat ? null : "vendas − cancelamentos − descontos · base de todos os percentuais" });
  }

  // 2. Impostos sobre vendas
  const impReais = agrupar(daNatureza("deducao_receita"), nomes);
  let impostos;
  if (impReais.length) {
    impostos = add("impostos", "(−) Impostos sobre vendas", soma(impReais.map((x) => x.valor)), { filhos: impReais, nota: "lançados com competência no mês" });
  } else if (pos(params.imposto_pct) > 0) {
    const v = base === null ? null : arred2((base * pos(params.imposto_pct)) / 100);
    impostos = add("impostos", "(−) Impostos sobre vendas", v, { natureza: "estimado", nota: `${fmtPctTexto(params.imposto_pct)} configurado sobre o faturamento (nenhum imposto lançado com competência no mês)` });
  } else {
    impostos = add("impostos", "(−) Impostos sobre vendas", 0, { natureza: "sem_lancamento", nota: "Nenhum imposto lançado com competência no mês e nenhum % configurado." });
    alertas.push("Impostos sobre vendas não entraram: lance o DAS/Simples com competência no mês ou configure o % em Financeiro → Pizza do Lucro.");
  }

  // 3. Receita líquida
  const receitaLiquida = add("receita_liquida", "(=) Receita líquida", menos(base, impostos), { tipo: "subtotal" });

  // 4. CMV
  let cmvValor = cmv?.valor ?? null;
  if (cmvValor !== null) {
    add("cmv", "(−) CMV real", cmvValor, {
      nota: `estoque inicial ${fmtReais(cmv.estoqueInicial)} + compras ${fmtReais(cmv.compras)} − estoque final ${fmtReais(cmv.estoqueFinal)}`,
    });
  } else if (simulando && pos(simulacao?.cmvPct) > 0) {
    cmvValor = add("cmv", "(−) CMV", arred2((base * pos(simulacao.cmvPct)) / 100), { natureza: "simulacao", nota: `Simulação: ${fmtPctTexto(simulacao.cmvPct)} digitado.` });
  } else {
    add("cmv", "(−) CMV real", null, { nota: (cmv?.motivos || []).join(" ") || "CMV real não apurado." });
  }

  // 5. Lucro bruto
  const lucroBruto = add("lucro_bruto", "(=) Lucro bruto", menos(receitaLiquida, cmvValor), { tipo: "subtotal" });

  // 6. Custos variáveis
  const varReais = agrupar(daNatureza("custo_variavel"), nomes);
  const varFilhos = [...varReais];
  for (const v of VARIAVEIS_CONFIGURADAS) {
    const jaLancado = varReais.some((r) => v.codigos.includes(r.codigo));
    if (jaLancado) continue;
    if (pos(params[v.param]) > 0) {
      varFilhos.push({
        codigo: null, rotulo: `${v.rotulo} — ${fmtPctTexto(params[v.param])} configurado`,
        valor: base === null ? null : arred2((base * pos(params[v.param])) / 100), natureza: "estimado",
      });
    } else if (v.essencial) {
      alertas.push("Taxas de cartão não entraram: lance-as como conta (Taxas de cartão) ou configure o % da maquininha em Financeiro → Pizza do Lucro.");
    }
  }
  const variaveis = add("variaveis", "(−) Custos variáveis", varFilhos.length ? totalDosFilhos(varFilhos) : 0, {
    filhos: varFilhos, natureza: varFilhos.some((f) => f.natureza === "estimado") ? "estimado" : "real",
    nota: varFilhos.length ? null : "Nenhum custo variável lançado ou configurado.",
  });

  // 7. Margem de contribuição
  const contribuicao = add("contribuicao", "(=) Margem de contribuição", menos(lucroBruto, variaveis), { tipo: "subtotal" });

  // 8. Pessoal (CMO)
  const pessoalContas = daNatureza("pessoal");
  const salContas = soma(pessoalContas.filter((c) => SALARIOS.includes(c.categoria_codigo)).map((c) => c.valor_original));
  const extContas = soma(pessoalContas.filter((c) => EXTRAS.includes(c.categoria_codigo)).map((c) => c.valor_original));
  const folhaRH = pos(cmo?.folha);
  const extrasRH = pos(cmo?.extras);
  const pessoalFilhos = [];
  const notasPessoal = [];
  if (folhaRH > 0) {
    pessoalFilhos.push({ codigo: null, rotulo: "Salários e vale-alimentação (cadastro do RH)", valor: arred2(folhaRH), natureza: "real" });
    if (salContas > 0) notasPessoal.push(`${fmtReais(salContas)} em contas de salário do mês não somados: o salário vem do RH.`);
  } else if (salContas > 0) {
    pessoalFilhos.push({ codigo: null, rotulo: "Salários (contas a pagar)", valor: salContas, natureza: "real" });
  }
  if (extrasRH > 0) {
    pessoalFilhos.push({ codigo: null, rotulo: "Extras e diárias (recibos do RH)", valor: arred2(extrasRH), natureza: "real" });
    if (extContas > 0) notasPessoal.push(`${fmtReais(extContas)} em contas de extras não somados: as diárias vêm dos recibos.`);
  } else if (extContas > 0) {
    pessoalFilhos.push({ codigo: null, rotulo: "Extras e diárias (contas a pagar)", valor: extContas, natureza: "real" });
  }
  const outrasPessoal = agrupar(pessoalContas.filter((c) => !SALARIOS.includes(c.categoria_codigo) && !EXTRAS.includes(c.categoria_codigo)), nomes);
  pessoalFilhos.push(...outrasPessoal);
  if (folhaRH > 0 && outrasPessoal.some((x) => x.codigo === "pessoal_beneficios")) {
    alertas.push("Há conta de Benefícios no mês e o RH já soma o vale-alimentação no salário: confira se o VA não está nos dois lugares.");
  }
  if (!outrasPessoal.some((x) => ENCARGOS.includes(x.codigo)) && pos(params.cmo_encargos_mes) > 0) {
    pessoalFilhos.push({ codigo: null, rotulo: "Encargos e provisões (configurado)", valor: arred2(pos(params.cmo_encargos_mes)), natureza: "configurado" });
  }
  if (!pessoalFilhos.length) alertas.push("Nenhum custo de pessoal: o RH não tem salários cadastrados e não há contas de pessoal no mês.");
  const pessoal = add("pessoal", "(−) Pessoal (CMO)", soma(pessoalFilhos.map((f) => f.valor)), {
    filhos: pessoalFilhos, nota: notasPessoal.join(" ") || null,
    natureza: pessoalFilhos.some((f) => f.natureza === "configurado") ? "configurado" : "real",
  });

  // 9. Despesas fixas e administrativas
  const conhecidas = ["deducao_receita", "custo_variavel", "pessoal", "financeiro", "mercadoria", "investimento", "distribuicao", "perda_estoque"];
  const fixasFilhos = agrupar(doMes.filter((c) => !conhecidas.includes(c.natureza)), nomes);
  const fixas = add("fixas", "(−) Despesas fixas e administrativas", soma(fixasFilhos.map((f) => f.valor)), {
    filhos: fixasFilhos, nota: fixasFilhos.length ? null : "Nenhuma despesa fixa lançada com competência no mês.",
  });
  if (!fixasFilhos.length) alertas.push("Nenhuma despesa fixa (aluguel, energia, água...) lançada com competência no mês.");

  // 10. Pró-labore (configurado na Pizza do Lucro)
  const [a, m] = String(mes).split("-").map(Number);
  const pl = proLaboreDoMes(params.pro_labore, new Date(a, m - 1, 15));
  const proLabore = pl.total > 0
    ? add("pro_labore", "(−) Pró-labore", arred2(pl.total), { natureza: "configurado", filhos: pl.partes.map((p) => ({ ...p, natureza: "configurado" })), nota: "configurado em Financeiro → Pizza do Lucro" })
    : 0;

  // 11. Resultado operacional
  const operacional = add("operacional", "(=) Resultado operacional", menos(contribuicao, pessoal, fixas, proLabore), { tipo: "subtotal" });

  // 12. Financeiro
  const finFilhos = agrupar(daNatureza("financeiro"), nomes);
  const financeiro = finFilhos.length
    ? add("financeiro", "(−) Despesas financeiras", soma(finFilhos.map((f) => f.valor)), { filhos: finFilhos })
    : 0;

  // 13. Resultado do mês
  const resultado = add("resultado", "(=) Resultado do mês", menos(operacional, financeiro), { tipo: "resultado" });

  // Fora do resultado
  const fora = [
    ["mercadoria", "Compras de mercadoria e insumos", "vão para o estoque e entram no resultado pelo CMV"],
    ["investimento", "Investimentos", "equipamentos e obras: não são despesa do mês"],
    ["distribuicao", "Retirada de sócios", "distribuição, não custo da operação"],
    ["perda_estoque", "Perdas de estoque (lançamento antigo)", "revisar: perda já aparece no CMV pela contagem"],
  ].map(([nat, rotulo, nota]) => {
    const filhos = agrupar(daNatureza(nat), nomes);
    return { id: nat, rotulo, nota, valor: soma(filhos.map((f) => f.valor)), filhos };
  }).filter((x) => x.filhos.length);

  const inferidas = doMes.filter((c) => c.competencia_inferida).length;
  if (inferidas) alertas.push(`${inferidas} conta(s) sem competência informada entraram pelo mês do vencimento.`);
  const revisar = doMes.filter((c) => c.exige_revisao).length;
  if (revisar) alertas.push(`${revisar} conta(s) numa categoria antiga que precisa de revisão — reclassifique em Contas a Pagar para cair na linha certa.`);

  return {
    mes, base, simulando, linhas, alertas, fora,
    resultado: { valor: resultado, pct: pct(resultado) },
    indicadores: {
      faturamento: base,
      cmvPct: pct(cmvValor), pessoalPct: pct(pessoal),
      contribuicaoPct: pct(contribuicao), resultado, resultadoPct: pct(resultado),
    },
  };
}
