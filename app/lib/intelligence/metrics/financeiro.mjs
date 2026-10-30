// CONTAS A PAGAR — fonte: vw_fin_contas_pagar (a mesma da tela Contas a
// Pagar). Conta aberta = pendente, parcial ou vencida; valor = SALDO em aberto.

import { metrica, insuficiente, CONFIANCA, NATUREZA } from "../core/contratos.mjs";
import { mesHerdado, cmvDoMes, equipeDoMes, calcularResultado, ticketMedio } from "../../resultado-mes.mjs";
import { calcularCMO } from "../../cmo.mjs";
import { apuracoesCmv } from "./custos.mjs";
import { somarDias, ddmm } from "../core/periodos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { medir, r2, soma, fonte } from "./base.mjs";

const ABERTAS = ["pendente", "parcial", "vencido"];

export function contasAPagar(amb, { dias = 7 } = {}) {
  const limite = somarDias(amb.hoje, dias);
  const periodo = { de: amb.hoje, ate: limite, rotulo: `vencidas e a vencer até ${ddmm(limite)}` };
  return medir(amb, { id: "contas_pagar", capacidade: "contas_pagar", periodo }, async (consultas) => {
    const contas = await ler(amb.dbe.from("vw_fin_contas_pagar")
      .select("id, descricao, fornecedor_id, saldo, valor_original, data_vencimento, situacao, vencida, categoria_codigo")
      .in("situacao", ABERTAS).lte("data_vencimento", limite).order("data_vencimento"), "vw_fin_contas_pagar") || [];
    const ids = [...new Set(contas.map((c) => c.fornecedor_id).filter(Boolean))];
    const fornecedores = ids.length ? new Map(((await ler(amb.dbe.from("fornecedores").select("id, nome").in("id", ids), "fornecedores")) || []).map((f) => [f.id, f.nome])) : new Map();
    const linha = (c) => ({
      id: c.id, descricao: c.descricao || "(sem descrição)", fornecedor: fornecedores.get(c.fornecedor_id) || null,
      vencimento: String(c.data_vencimento).slice(0, 10), saldo: r2(Number(c.saldo) || 0), situacao: c.situacao,
    });
    const vencidas = contas.filter((c) => c.vencida || c.situacao === "vencido").map(linha);
    const hoje = contas.filter((c) => !(c.vencida || c.situacao === "vencido") && String(c.data_vencimento).slice(0, 10) === amb.hoje).map(linha);
    const proximas = contas.filter((c) => !(c.vencida || c.situacao === "vencido") && String(c.data_vencimento).slice(0, 10) > amb.hoje).map(linha);
    const total = r2(soma([...vencidas, ...hoje, ...proximas], (c) => c.saldo));
    return metrica({
      metrica: "contas_pagar", valor: total, unidade: "BRL", periodo,
      fontes: [fonte("vw_fin_contas_pagar", "Contas a pagar em aberto (saldo)")], consultas: consultas(), escopo: amb.escopo,
      completude: 1, confianca: CONFIANCA.ALTA, apuradoEm: amb.apuradoEm,
      observacoes: contas.length ? [] : ["Nenhuma conta em aberto vencida ou a vencer no período. Conta não lançada no Héfisto não aparece aqui."],
      detalhes: {
        vencidas: { qtd: vencidas.length, valor: r2(soma(vencidas, (c) => c.saldo)), lista: vencidas.slice(0, 10) },
        hoje: { qtd: hoje.length, valor: r2(soma(hoje, (c) => c.saldo)), lista: hoje.slice(0, 10) },
        proximas: { qtd: proximas.length, valor: r2(soma(proximas, (c) => c.saldo)), lista: proximas.slice(0, 10) },
      },
    });
  });
}

// RESULTADO DO MÊS — lucro líquido e ticket médio, com as MESMAS funções da
// tela Financeiro → Resultado do mês (app/lib/resultado-mes.mjs): o número do
// Héfisto é o da tela. Faturamento, custos e pedidos são os informados pelo
// dono (config_sistema.params.resultado_mensal); CMV das contagens; CMO do RH.

const FONTES_RESULTADO = [
  fonte("config_sistema", "Resultado do mês: faturamento, custos, impostos e taxas informados"),
  fonte("estoque_contagens", "CMV pelas contagens de estoque"),
  fonte("colaboradores", "Equipe do RH (CMO)"),
  fonte("rh_recibos_prestacao", "Diárias de extras pagas"),
];

export async function dadosDoResultado(amb, mes) {
  const [cfg, colaboradores, recibos, cmvRes] = await Promise.all([
    ler(amb.dbe.from("config_sistema").select("params").limit(1), "config_sistema"),
    ler(amb.dbe.from("colaboradores").select("*"), "colaboradores"),
    ler(amb.dbe.from("rh_recibos_prestacao").select("valor_total, data_pagamento, data_trabalho, pagamento_realizado").gte("data_trabalho", somarDias(`${mes}-01`, -31)), "rh_recibos_prestacao").catch((e) => { if (e.ausente) return []; throw e; }),
    apuracoesCmv(amb).catch(() => ({ apurados: [] })),
  ]);
  const todos = cfg?.[0]?.params?.resultado_mensal || {};
  const { modelo, herdadoDe } = mesHerdado(todos, mes);
  const [a, m] = mes.split("-").map(Number);
  const extras = calcularCMO({ colaboradores: [], recibos: recibos || [], referencia: new Date(a, m - 1, 15), modo: "mes" }).extras;
  const cmo = (colaboradores || []).length || (recibos || []).length
    ? equipeDoMes(colaboradores || [], { bonus: modelo.bonus_funcionario, encargos_pct: modelo.encargos_pct, dias: Math.round(Number(modelo.dias_abertos) || 0), extrasPagos: extras, extrasInformados: modelo.extras_informados, taxas: modelo.taxas_servico || {} })
    : null;
  const cmv = cmvDoMes(cmvRes.apurados || [], mes);
  return { modelo, herdadoDe, salvo: Object.keys(todos).length > 0, r: calcularResultado(modelo, { cmv, cmo }) };
}

const rotuloMes = (mes) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;

/** Lucro líquido do mês (padrão: mês atual). */
export function lucroDoMes(amb, { mes = null } = {}) {
  const m = mes || amb.hoje.slice(0, 7);
  const periodo = { de: `${m}-01`, ate: amb.hoje.slice(0, 7) === m ? amb.hoje : `${m}-28`, rotulo: `mês ${rotuloMes(m)}` };
  return medir(amb, { id: "lucro", capacidade: "resultado", periodo }, async (consultas) => {
    const { r, herdadoDe, salvo } = await dadosDoResultado(amb, m);
    if (!salvo || r.lucroLiquido == null) {
      const faltando = salvo ? r.faltam : ["Resultado do mês preenchido (Financeiro → Resultado do mês)"];
      return insuficiente({ metrica: "lucro", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes: FONTES_RESULTADO, consultas: consultas(),
        motivo: `Para calcular o lucro líquido falta: ${faltando.join(", ")}.`, faltando });
    }
    const linha = (id) => r.linhas.find((l) => l.id === id);
    const observacoes = ["Faturamento, custos, impostos e taxas são os informados no Resultado do mês."];
    if (herdadoDe) observacoes.push(`Este mês ainda não foi salvo: valores copiados de ${rotuloMes(herdadoDe)}.`);
    if (r.natureza === "ESTIMATIVA") observacoes.push("O CMV é estimado pela média das contagens (não cobrem o mês inteiro).");
    return metrica({
      metrica: "lucro", valor: r.lucroLiquido, unidade: "BRL", periodo, fontes: FONTES_RESULTADO, consultas: consultas(), escopo: amb.escopo,
      natureza: r.natureza === "ESTIMATIVA" ? NATUREZA.ESTIMATIVA : NATUREZA.REAL,
      completude: 1, confianca: r.natureza === "ESTIMATIVA" ? CONFIANCA.MEDIA : CONFIANCA.ALTA, apuradoEm: amb.apuradoEm, observacoes,
      detalhes: {
        faturamento: r.faturamento, lucroPct: r.lucroPct, prejuizo: r.prejuizo, equilibrio: r.equilibrio,
        linhas: ["faturamento", "impostos", "cartao", "cmv", "cmo", "variaveis", "fixos", "outros", "depreciacao", "lucro_liquido"]
          .map(linha).filter(Boolean).map((l) => ({ id: l.id, rotulo: l.rotulo, valor: l.valor, pct: l.pct })),
      },
    });
  });
}

/** Ticket médio do mês: faturamento ÷ pedidos informados no Resultado do mês. */
export function ticketMedioDoMes(amb, { mes = null } = {}) {
  const m = mes || amb.hoje.slice(0, 7);
  const periodo = { de: `${m}-01`, ate: amb.hoje.slice(0, 7) === m ? amb.hoje : `${m}-28`, rotulo: `mês ${rotuloMes(m)}` };
  return medir(amb, { id: "ticket_medio", capacidade: "resultado", periodo }, async (consultas) => {
    const cfg = await ler(amb.dbe.from("config_sistema").select("params").limit(1), "config_sistema");
    const { modelo } = mesHerdado(cfg?.[0]?.params?.resultado_mensal || {}, m);
    const t = ticketMedio(modelo.faturamento, modelo.pedidos, Math.round(Number(modelo.dias_abertos) || 0));
    if (t.valor == null) {
      return insuficiente({ metrica: "ticket_medio", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes: [FONTES_RESULTADO[0]], consultas: consultas(),
        motivo: t.motivo, faltando: ["faturamento e quantidade de pedidos no Resultado do mês"] });
    }
    return metrica({
      metrica: "ticket_medio", valor: t.valor, unidade: "BRL", periodo, fontes: [FONTES_RESULTADO[0]], consultas: consultas(), escopo: amb.escopo,
      completude: 1, confianca: CONFIANCA.ALTA, apuradoEm: amb.apuradoEm, observacoes: [`${t.motivo} Valores informados pelo dono.`],
      detalhes: { pedidos: Math.round(Number(modelo.pedidos) || 0), pedidosPorDia: t.pedidosPorDia, faturamento: Number(modelo.faturamento) || 0 },
    });
  });
}
