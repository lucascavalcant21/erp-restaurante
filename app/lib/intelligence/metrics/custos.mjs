// CMV e CMO — nenhuma conta nova: os motores que as telas já usam.
//
// CMV real (cmv-real.mjs / cmv-dados.mjs, tela Operacional → CMV Real):
//   estoque inicial + compras − estoque final, entre inventários FECHADOS da
//   unidade inteira; % sobre o faturamento diário do mesmo período. Sem as
//   contagens → DADOS INSUFICIENTES com o motivo do próprio motor.
// CMO (cmo.mjs / dre-gerencial.mjs, como o DRE): salários + vale-alimentação
//   do cadastro do RH + diárias de extras pagas; % sobre o faturamento do mês
//   (faturamentoDoMes: faltou um dia → sem %).

import { metrica, insuficiente, CONFIANCA, NATUREZA } from "../core/contratos.mjs";
import { ddmm, somarDias } from "../core/periodos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { carregarDadosCmv } from "../../cmv-dados.mjs";
import { periodosEntreContagens, apurarPeriodo, mediasHistoricas, comparacaoPeriodos, alertas as alertasCmv } from "../../cmv-real.mjs";
import { calcularCMO, pesoDoCMO } from "../../cmo.mjs";
import { janelaDoMes, faturamentoDoMes } from "../../dre-gerencial.mjs";
import { medir, r2, fonte } from "./base.mjs";

/** Carrega os dados do CMV pelo banco escopado e apura todos os períodos entre contagens. */
export async function apuracoesCmv(amb) {
  const r = await carregarDadosCmv(amb.dbe, amb.escopo.unidadeId);
  if (r.error) {
    const e = new Error(r.error);
    e.fonteCmv = true;
    throw e;
  }
  const dados = r.data;
  const periodos = periodosEntreContagens(dados.contagens, amb.hoje);
  const apurados = periodos.map((p) => apurarPeriodo(p, dados));
  return { dados, apurados };
}

const FONTES_CMV = [
  fonte("estoque_contagens", "Inventários fechados (unidade inteira)"),
  fonte("estoque_contagens_itens", "Valor contado, custo congelado"),
  fonte("vw_compras", "Compras confirmadas"),
  fonte("fin_faturamento_diario", "Faturamento diário informado"),
];

export function cmv(amb) {
  return medir(amb, { id: "cmv", capacidade: "cmv" }, async (consultas) => {
    let res;
    try {
      res = await apuracoesCmv(amb);
    } catch (e) {
      if (e.fonteCmv) {
        return insuficiente({ metrica: "cmv", escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes: FONTES_CMV, consultas: consultas(),
          motivo: `Não foi possível ler os dados do CMV real: ${e.message}`, faltando: ["inventários e compras"] });
      }
      throw e;
    }
    const { dados, apurados } = res;
    const ok = apurados.filter((a) => a.status === "apurado");
    if (!ok.length) {
      const ult = apurados[apurados.length - 1];
      const motivos = ult ? ult.motivos : ["Nenhum inventário fechado da unidade inteira."];
      return insuficiente({
        metrica: "cmv", escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes: FONTES_CMV, consultas: consultas(),
        periodo: ult ? { de: ult.periodo.de, ate: ult.periodo.ate } : null,
        motivo: `CMV real não apurado: ${motivos.join(" ")} O CMV real precisa de um inventário fechado no início e outro no fim do período.`,
        faltando: ["inventário inicial fechado", "inventário final fechado"],
      });
    }
    const atual = ok[ok.length - 1];
    const anteriores = ok.slice(0, -1);
    const medias = mediasHistoricas(anteriores);
    const comparacoes = comparacaoPeriodos(ok);
    const vs = comparacoes[comparacoes.length - 1]?.vsAnterior || null;
    const periodo = { de: atual.periodo.de, ate: atual.periodo.ate, rotulo: `${ddmm(atual.periodo.de)} a ${ddmm(atual.periodo.ate)} (entre inventários)` };
    const observacoes = [];
    const emAndamento = apurados[apurados.length - 1]?.status === "em_andamento";
    if (emAndamento) observacoes.push("Este é o último período fechado entre inventários; o período atual só será apurado na próxima contagem.");

    const detalhes = {
      cmvReais: atual.cmv.valor, mercadoria: atual.cmv.mercadoria, embalagem: atual.cmv.embalagem,
      estoqueInicial: atual.ei.valor, compras: atual.compras.valor, estoqueFinal: atual.ef.valor,
      faturamento: atual.faturamento.valor, motivoPct: atual.motivoPct,
      mediaHistorica: medias.suficiente && medias.cmvPct ? { valor: medias.cmvPct.valor, periodos: medias.cmvPct.periodos } : null,
      historicoSuficiente: medias.suficiente === true, periodosApurados: ok.length,
      // decomposição do que mudou contra o período anterior (para o "por quê?")
      contribuicoes: vs ? { compras: vs.compras, estoqueFinal: vs.estoqueFinal, faturamento: vs.faturamento, cmv: vs.cmv } : null,
      alertas: alertasCmv({ apurados, variacoes: [], insumoPorId: dados.insumoPorId }).filter((a) => a.tipo !== "preco").slice(0, 8),
    };

    if (atual.cmvPct == null) {
      observacoes.push(`CMV % indisponível: ${atual.motivoPct}`);
      return metrica({
        metrica: "cmv", valor: atual.cmv.valor, unidade: "BRL", periodo, fontes: FONTES_CMV, consultas: consultas(), escopo: amb.escopo,
        completude: 1, confianca: CONFIANCA.ALTA, apuradoEm: amb.apuradoEm, observacoes, detalhes,
      });
    }
    let comparacao = null;
    if (vs?.cmvPctPontos != null) {
      const ant = anteriores[anteriores.length - 1];
      comparacao = { periodo: { de: ant.periodo.de, ate: ant.periodo.ate, rotulo: `${ddmm(ant.periodo.de)} a ${ddmm(ant.periodo.ate)}` }, valor: ant.cmvPct, diferenca: vs.cmvPctPontos, diferencaPct: null, unidadeDiferenca: "p.p." };
    } else {
      observacoes.push("Sem período anterior apurado com faturamento para comparar.");
    }
    return metrica({
      metrica: "cmv", valor: atual.cmvPct, unidade: "%", periodo, comparacao, fontes: FONTES_CMV, consultas: consultas(), escopo: amb.escopo,
      completude: 1, confianca: CONFIANCA.ALTA, apuradoEm: amb.apuradoEm, observacoes, detalhes,
    });
  });
}

const FONTES_CMO = [
  fonte("colaboradores", "Salário e vale-alimentação do cadastro do RH"),
  fonte("rh_recibos_prestacao", "Diárias de extras com recibo pago"),
];

/** CMO do mês (padrão: mês atual). */
export function cmo(amb, { mes = null } = {}) {
  const m = mes || amb.hoje.slice(0, 7);
  const janela = janelaDoMes(m, amb.hoje);
  const periodo = { de: janela.de, ate: janela.ate || janela.fimMes, rotulo: `mês ${m.slice(5, 7)}/${m.slice(0, 4)}${janela.emAndamento ? " (em andamento)" : ""}` };
  return medir(amb, { id: "cmo", capacidade: "cmo", periodo }, async (consultas) => {
    const [colaboradores, recibos] = await Promise.all([
      ler(amb.dbe.from("colaboradores").select("id, salario, vale_alimentacao, tipo_contrato, status, ativo"), "colaboradores"),
      ler(amb.dbe.from("rh_recibos_prestacao").select("valor_total, data_pagamento, data_trabalho, pagamento_realizado").gte("data_trabalho", somarDias(janela.de, -31)), "rh_recibos_prestacao").catch((e) => { if (e.ausente) return []; throw e; }),
    ]);
    const [a, mm] = m.split("-").map(Number);
    const c = calcularCMO({ colaboradores: colaboradores || [], recibos: recibos || [], referencia: new Date(a, mm - 1, 15), modo: "mes" });
    if (!(c.total > 0)) {
      return insuficiente({ metrica: "cmo", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes: FONTES_CMO, consultas: consultas(),
        motivo: "Nenhum salário cadastrado no RH nem diária de extra paga no mês: não há como calcular o CMO.", faltando: ["salários no cadastro do RH"] });
    }
    // % sobre o faturamento do mês (mesma regra do DRE)
    let faturamentoMes = null;
    let motivoPct = null;
    try {
      const linhas = await ler(amb.dbe.from("fin_faturamento_diario").select("data, receita, vendas_brutas, cancelamentos, descontos").gte("data", janela.de).lte("data", periodo.ate), "fin_faturamento_diario");
      const fat = faturamentoDoMes({ disponivel: true, nome: "faturamento diário", dias: (linhas || []).map((d) => ({ data: String(d.data).slice(0, 10), valor: Number(d.receita), detalhe: d })) }, janela);
      faturamentoMes = fat.valor; motivoPct = fat.motivo;
    } catch (e) {
      if (!e.ausente) throw e;
      motivoPct = "Não há fonte de faturamento no Héfisto.";
    }
    const peso = faturamentoMes != null ? pesoDoCMO(c.total, faturamentoMes) : null;
    const observacoes = ["Salários vêm do cadastro do RH (não é a folha paga) e encargos não estão incluídos — mesma regra do DRE gerencial."];
    if (peso == null) observacoes.push(`CMO % indisponível: ${motivoPct || "faturamento do mês incompleto."}`);
    if (c.extrasEmAberto > 0) observacoes.push(`R$ ${r2(c.extrasEmAberto).toLocaleString("pt-BR")} em diárias de extras ainda não pagas não entraram.`);
    return metrica({
      metrica: "cmo", valor: r2(c.total), unidade: "BRL", periodo, fontes: [...FONTES_CMO, fonte("fin_faturamento_diario", "Faturamento do mês (para o %)")],
      consultas: consultas(), escopo: amb.escopo, completude: 1, confianca: CONFIANCA.MEDIA, apuradoEm: amb.apuradoEm, observacoes,
      detalhes: {
        folha: r2(c.folha), extras: r2(c.extras), recibosPagos: c.recibos,
        percentual: peso != null ? { valor: r2(peso), natureza: NATUREZA.REAL, faturamento: faturamentoMes } : null,
      },
    });
  });
}
