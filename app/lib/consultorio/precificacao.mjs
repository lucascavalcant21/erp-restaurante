// PREÇO E LUCRO DA CONSULTA (dono, 21/11/2026: "controle de gastos e lucro,
// para saber quanto vai cobrar na consulta para dar lucro"). A mesma conta da
// marmita, para a consulta:
//   fixos por consulta = (custos fixos do mês + pró-labore) ÷ consultas no mês
//   custo da consulta  = fixos por consulta + custos variáveis (material…)
//   % sobre o preço    = imposto + taxa do cartão
//   ponto de equilíbrio = custo da consulta ÷ (1 − %)          (lucro zero)
//   preço para a meta   = (custo da consulta + meta) ÷ (1 − %)
// Convênio: líquido = valor × (1 − glosa) × (1 − imposto) − variáveis.
// Sem dado, null com o motivo: nunca um número inventado.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const soma = (l) => r2((l || []).reduce((t, x) => t + (num(x?.valor) || 0), 0));
const arredondaCima = (v) => Math.ceil(v * 100 - 1e-6) / 100;

export const CONFIG_VAZIA = Object.freeze({
  custos_fixos: [], pro_labore: "", consultas_mes: "", custos_variaveis: [],
  imposto_pct: "", taxa_cartao_pct: "", meta_lucro: "", dias_atendimento_mes: "",
});

export const SUGESTOES_FIXOS = ["Aluguel da sala", "Secretária", "Condomínio", "Energia", "Internet e telefone", "Sistema e prontuário", "Contador", "Anuidade do conselho", "Limpeza", "Material de escritório"];
export const SUGESTOES_VARIAVEIS = ["Material descartável", "Lençol de papel", "Luvas", "Álcool e higienização"];

export function normalizarConfig(c = {}) {
  const lista = (l) => (Array.isArray(l) ? l : []).map((x) => ({ nome: String(x?.nome || "").trim(), valor: x?.valor ?? "" })).filter((x) => x.nome);
  return { ...CONFIG_VAZIA, ...c, custos_fixos: lista(c.custos_fixos), custos_variaveis: lista(c.custos_variaveis) };
}

/** Custo por consulta e preços, a partir da configuração do consultório. */
export function contaDaConsulta(cfg = {}) {
  const c = normalizarConfig(cfg);
  const fixosMes = soma(c.custos_fixos);
  const proLabore = num(c.pro_labore) || 0;
  const consultas = num(c.consultas_mes);
  const variaveis = soma(c.custos_variaveis);
  const impostoPct = num(c.imposto_pct) || 0;
  const taxaPct = num(c.taxa_cartao_pct) || 0;
  const pct = impostoPct + taxaPct;
  const meta = num(c.meta_lucro) || 0;
  const motivos = [];
  if (!(consultas > 0)) motivos.push("Informe quantas consultas você faz por mês.");
  if (!(fixosMes + proLabore + variaveis > 0)) motivos.push("Cadastre os custos do consultório (fixos, pró-labore ou material).");
  if (pct >= 100) motivos.push("Imposto e taxa somam 100% ou mais.");
  if (motivos.length) return { ok: false, motivos, fixosMes, proLabore, variaveis, pct };
  const fixosPorConsulta = r2((fixosMes + proLabore) / consultas);
  const proLaborePorConsulta = r2(proLabore / consultas);
  const custo = r2(fixosPorConsulta + variaveis);
  const sobra = 1 - pct / 100;
  return {
    ok: true, motivos: [],
    fixosMes, proLabore, consultas, variaveis, pct, impostoPct, taxaPct, meta,
    fixosPorConsulta, proLaborePorConsulta, custo,
    pontoEquilibrio: arredondaCima(custo / sobra),
    precoMeta: meta > 0 ? arredondaCima((custo + meta) / sobra) : null,
  };
}

/** Para onde vai cada real de um preço de consulta (cascata). */
export function cascataDaConsulta(preco, conta) {
  const p = num(preco);
  if (!(p > 0) || !conta?.ok) return null;
  const imposto = r2(p * (conta.pct / 100));
  const linhas = [
    { id: "preco", rotulo: "Preço da consulta", valor: r2(p) },
    { id: "imposto", rotulo: "Imposto e taxa do cartão", valor: -imposto },
    { id: "variaveis", rotulo: "Material da consulta", valor: -conta.variaveis },
    { id: "fixos", rotulo: "Custos fixos do consultório (por consulta)", valor: -r2(conta.fixosPorConsulta - conta.proLaborePorConsulta) },
    { id: "prolabore", rotulo: "Seu pró-labore (por consulta)", valor: -conta.proLaborePorConsulta },
  ].filter((l) => l.id === "preco" || l.valor !== 0);
  const lucro = r2(linhas.reduce((t, l) => t + l.valor, 0));
  linhas.push({ id: "lucro", rotulo: lucro >= 0 ? "Lucro da consulta" : "Prejuízo da consulta", valor: lucro });
  return { linhas, lucro, abaixoDoEquilibrio: p < conta.pontoEquilibrio - 0.004, atingeMeta: conta.meta > 0 ? lucro >= conta.meta - 0.004 : null };
}

/** Quantas consultas no mês pagam todos os custos, num preço. */
export function consultasParaEquilibrio(preco, conta) {
  const p = num(preco);
  if (!(p > 0) || !conta?.ok) return null;
  const margem = p * (1 - conta.pct / 100) - conta.variaveis;
  if (!(margem > 0)) return null;
  return Math.ceil((conta.fixosMes + conta.proLabore) / margem - 1e-9);
}

/** Convênio: quanto sobra por consulta depois de glosa, imposto e custos. */
export function analiseDoConvenio({ valor, glosaPct = 0, conta }) {
  const v = num(valor);
  if (!(v > 0) || !conta?.ok) return null;
  // convênio paga por transferência: só imposto, sem taxa de cartão
  const recebido = r2(v * (1 - (num(glosaPct) || 0) / 100));
  const liquido = r2(recebido * (1 - conta.impostoPct / 100) - conta.variaveis);
  const lucro = r2(liquido - conta.fixosPorConsulta);
  return { valor: r2(v), recebido, liquido, lucro, cobreCusto: lucro >= -0.004 };
}

/**
 * Resultado do mês pela agenda: consultas atendidas (receita), recebido,
 * custos do mês (fixos + pró-labore cadastrados = ESTIMATIVA) e lucro.
 * Com o mês em andamento, projeta no ritmo das atendidas até hoje.
 */
export function resultadoDoMes({ consultas = [], conta, mes, hojeIso }) {
  const doMes = consultas.filter((c) => String(c.inicio || "").slice(0, 7) === mes);
  const atendidas = doMes.filter((c) => c.status === "atendida");
  const receita = r2(atendidas.reduce((t, c) => t + (num(c.valor) || 0), 0));
  const recebido = r2(doMes.filter((c) => c.pago_em).reduce((t, c) => t + (num(c.valor) || 0), 0));
  const faltas = doMes.filter((c) => c.status === "faltou").length;
  if (!conta?.ok) return { ok: false, motivos: conta?.motivos || [], atendidas: atendidas.length, receita, recebido, faltas };
  const variaveis = r2(atendidas.length * conta.variaveis);
  const impostos = r2(receita * conta.pct / 100);
  const fixos = r2(conta.fixosMes + conta.proLabore);
  const lucro = r2(receita - impostos - variaveis - fixos);
  const [a, m] = String(mes).split("-").map(Number);
  const diasMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const emAndamento = String(hojeIso).slice(0, 7) === mes;
  const dia = emAndamento ? Number(String(hojeIso).slice(8, 10)) : diasMes;
  let projecao = null;
  if (emAndamento && atendidas.length > 0) {
    const f = diasMes / dia;
    const receitaP = r2(receita * f);
    const atendidasP = Math.round(atendidas.length * f);
    projecao = { atendidas: atendidasP, receita: receitaP, lucro: r2(receitaP - receitaP * conta.pct / 100 - atendidasP * conta.variaveis - fixos) };
  }
  return {
    ok: true, natureza: "ESTIMATIVA", atendidas: atendidas.length, faltas, receita, recebido, aReceber: r2(receita - recebido > 0 ? receita - recebido : 0),
    impostos, variaveis, fixos, lucro, ticketMedio: atendidas.length ? r2(receita / atendidas.length) : null,
    metaMes: conta.meta > 0 ? r2(conta.meta * conta.consultas) : null, projecao,
  };
}
