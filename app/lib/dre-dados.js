// Leitura do DRE gerencial — só LEITURA, uma vez por unidade. A troca de mês
// recalcula na tela (dre-gerencial.mjs), sem ir ao banco de novo.
//
// Mesmas fontes das telas de origem, para os números baterem:
//   faturamento, inventários, compras → carregarDadosCmv (tela de CMV real)
//   contas por competência e natureza  → vw_fin_contas_pagar (Contas a Pagar)
//   nomes das categorias               → fin_categorias
//   salários e diárias                 → RH (como a Pizza do Lucro)
//   % configurados e pró-labore        → parâmetros (Pizza do Lucro)

import { supabase } from "./supabase";
import { carregarDadosCmv } from "./cmv-dados.mjs";
import { periodoPorDatas, apurarPeriodo, somarDiasIso } from "./cmv-real.mjs";
import { fetchContasPagar } from "./financeiro";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "./rh";
import { fetchParams } from "./parametros";
import { calcularCMO } from "./cmo.mjs";

export async function carregarBaseDre(unidadeId) {
  const [cmv, contas, categorias, equipe, recibos, params] = await Promise.all([
    carregarDadosCmv(supabase, unidadeId),
    fetchContasPagar(unidadeId),
    supabase.from("fin_categorias").select("codigo, nome, natureza, grupo"),
    fetchColaboradores(unidadeId),
    fetchRecibosPrestacaoUnidade(unidadeId),
    fetchParams(unidadeId),
  ]);
  const erros = [
    cmv.error && `Faturamento/CMV: ${cmv.error}`,
    contas.error && `Contas a pagar: ${contas.error}`,
    categorias.error && `Categorias: ${categorias.error.message || categorias.error}`,
  ].filter(Boolean);
  return {
    cmvDados: cmv.data,
    contas: contas.data || [],
    categorias: categorias.data || [],
    colaboradores: equipe.data || [],
    recibos: recibos.data || [],
    params: params.data || {},
    erros,
  };
}

// CMV real do mês: precisa de inventário fechado no 1º dia do mês e no 1º do
// mês seguinte (fronteiras do cmv-real.mjs). Sem eles, sem dado com o motivo.
export function cmvDoMes(cmvDados, janela) {
  if (!cmvDados || janela.futuro) return { valor: null, motivos: ["CMV real indisponível para este mês."] };
  const ate = janela.emAndamento ? janela.fimMes : janela.ate;
  const ap = apurarPeriodo(periodoPorDatas(janela.de, ate, cmvDados.contagens), cmvDados);
  return {
    valor: ap.cmv?.valor ?? null,
    motivos: ap.motivos || [],
    estoqueInicial: ap.ei?.valor ?? null,
    compras: ap.compras?.valor ?? null,
    estoqueFinal: ap.ef?.valor ?? null,
    ateExclusivo: somarDiasIso(ate, 1),
  };
}

export function cmoDoMesRH(base, mes) {
  const [a, m] = String(mes).split("-").map(Number);
  return calcularCMO({ colaboradores: base.colaboradores, recibos: base.recibos, referencia: new Date(a, m - 1, 15), modo: "mes" });
}
