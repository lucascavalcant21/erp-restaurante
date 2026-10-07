// METRICS ENGINE — a camada determinística. A IA nunca faz conta importante
// "de cabeça": toda resposta quantitativa sai daqui, com contrato completo.
//
// Métricas sem base no Héfisto hoje respondem DADOS INSUFICIENTES com o
// motivo — não são omitidas nem estimadas.

import { insuficiente } from "../core/contratos.mjs";
import { resolverPeriodo } from "../core/periodos.mjs";
import { criarAmbiente, medir } from "./base.mjs";
import { faturamento, historicoDiario } from "./faturamento.mjs";
import { compras, variacoesDePreco } from "./compras.mjs";
import { saldoDoProduto, vencimentos, divergenciasEstoque, perdas, abaixoDoMinimo } from "./estoque.mjs";
import { contasAPagar } from "./financeiro.mjs";
import { cmv, cmo } from "./custos.mjs";

/** Métricas pedidas na especificação que os dados atuais NÃO suportam — e por quê. */
export const SEM_BASE = Object.freeze({
  ticket_medio: {
    capacidade: "faturamento",
    motivo: "O Héfisto não registra a quantidade de vendas ou de clientes: o faturamento diário informado guarda só valores, e as vendas estão no Saipos, sem integração.",
    faltando: ["quantidade de vendas/atendimentos por dia"],
  },
  hora_extra: {
    capacidade: "cmo",
    motivo: "Hora extra exige a jornada contratada × ponto apurado por colaborador; o banco de horas atual registra só intervalo não tirado. Esse cálculo ainda não está ligado à inteligência.",
    faltando: ["apuração de jornada por colaborador"],
  },
  margem_produto: {
    capacidade: "cmv",
    motivo: "Margem por prato exige venda por produto, que não existe no Héfisto (vendas no Saipos, sem integração).",
    faltando: ["vendas por produto"],
  },
  lucro: {
    capacidade: "faturamento",
    motivo: "O resultado do mês sai do DRE gerencial e depende de faturamento completo, CMV real apurado e despesas lançadas; ainda não está ligado à inteligência.",
    faltando: ["DRE gerencial na inteligência"],
  },
});

/**
 * @param {object} p  { dbe, escopo, verificador, agora, fuso }
 */
export function criarMotorDeMetricas(p) {
  const amb = criarAmbiente(p);
  const periodo = (tipo, op = {}) => resolverPeriodo(tipo, { agora: amb.agora, fuso: amb.fuso, ...op });
  return Object.freeze({
    ambiente: amb,
    periodo,
    getRevenue: (tipo = "hoje", op) => faturamento(amb, typeof tipo === "string" ? periodo(tipo) : tipo, op),
    // Linhas cruas para o baseline: mesma permissão do faturamento.
    getRevenueHistory: async (ate = amb.hoje, semanas = 8) => ((await amb.verificador.pode("faturamento")) ? historicoDiario(amb, ate, semanas) : null),
    getPurchasesTotal: (tipo = "semana", op) => compras(amb, typeof tipo === "string" ? periodo(tipo) : tipo, op),
    getPriceChanges: (op) => variacoesDePreco(amb, op),
    getProductStock: (op) => saldoDoProduto(amb, op),
    getExpiringProducts: (op) => vencimentos(amb, op),
    getStockVariance: (op) => divergenciasEstoque(amb, op),
    getLowStock: () => abaixoDoMinimo(amb),
    getWaste: (tipo = "semana") => perdas(amb, typeof tipo === "string" ? periodo(tipo) : tipo),
    getAccountsPayable: (op) => contasAPagar(amb, op),
    getCMV: () => cmv(amb),
    getCMO: (op) => cmo(amb, op),
    semBase(id) {
      const d = SEM_BASE[id];
      if (!d) throw new Error(`Métrica desconhecida: ${id}`);
      return medir(amb, { id, capacidade: d.capacidade }, async (consultas) =>
        insuficiente({ metrica: id, motivo: d.motivo, faltando: d.faltando, escopo: amb.escopo, apuradoEm: amb.apuradoEm, consultas: consultas() }));
    },
  });
}
