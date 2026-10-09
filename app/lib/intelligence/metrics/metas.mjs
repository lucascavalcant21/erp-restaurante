// META DE FATURAMENTO — alvo da unidade e quanto dele já foi atingido.
//
// Origem da meta, nesta ordem:
//   1. meta DIÁRIA configurada                      → natureza META
//   2. SUGESTÃO a partir da meta SEMANAL configurada → natureza SUGESTAO
//   3. SUGESTÃO a partir da meta MENSAL configurada  → natureza SUGESTAO
//   4. nenhuma meta → DADOS INSUFICIENTES (o sistema não inventa meta)
//
// A distribuição sugerida (mês → dia, semana → dia) usa o HISTÓRICO DA PRÓPRIA
// UNIDADE por dia da semana quando há amostras suficientes (sexta pesa mais que
// segunda, se for assim na casa); senão, divide igualmente pelos dias. Sempre
// com o selo SUGESTÃO e o método dito — nunca apresentada como realizado.
//
// Atingimento = faturamento REAL lançado ÷ meta. Sem faturamento do dia, o
// atingimento é DADOS INSUFICIENTES (não "0%").

import { metrica, insuficiente, temValor, NATUREZA, CONFIANCA } from "../core/contratos.mjs";
import { diaDaSemana, somarDias, ultimoDiaDoMes, nomeDiaSemana } from "../core/periodos.mjs";
import { LIMIARES_PADRAO } from "../anomalies/baseline.mjs";

const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;
const FONTE_META = { tabela: "intelligence_preferencias", descricao: "Metas digitadas em Inteligência > Configurações" };
const FONTE_FAT = { tabela: "fin_faturamento_diario", descricao: "Faturamento diário lançado" };

/** Pesos por dia da semana (0=dom..6=sáb) a partir do histórico; null se não houver amostras suficientes. */
export function pesosPorDiaDaSemana(historico, minAmostras = LIMIARES_PADRAO.minAmostras) {
  const porDia = Array.from({ length: 7 }, () => []);
  for (const l of historico || []) {
    const v = Number(l.receita);
    if (Number.isFinite(v) && v > 0) porDia[diaDaSemana(l.data)].push(v);
  }
  if (porDia.some((xs) => xs.length < minAmostras)) return null;
  return porDia.map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
}

function diasDoMes(hoje) {
  const [a, m] = hoje.split("-").map(Number);
  const n = ultimoDiaDoMes(a, m);
  return Array.from({ length: n }, (_, i) => `${hoje.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`);
}

function diasDaSemana(hoje) {
  const seg = somarDias(hoje, -((diaDaSemana(hoje) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => somarDias(seg, i));
}

/** Parte do total que cabe a `dia` dentro de `dias`, pelos pesos (ou igual). */
function parte(total, dia, dias, pesos) {
  const p = (d) => (pesos ? pesos[diaDaSemana(d)] : 1);
  const soma = dias.reduce((acc, d) => acc + p(d), 0);
  return soma > 0 ? total * (p(dia) / soma) : null;
}

/**
 * Distribuição sugerida da meta mensal (e semanal, se não houver uma
 * configurada). Função pura — usada pela Central e pela tela de configurações.
 */
export function sugerirDistribuicao({ metas, hoje, historico = null }) {
  const pesos = pesosPorDiaDaSemana(historico);
  const metodo = pesos ? "historico_dia_semana" : "igual";
  const mes = diasDoMes(hoje);
  const semana = diasDaSemana(hoje);
  const out = { metodo, porDiaDaSemana: null, hoje: null, semana: null };
  if (metas.mensal) {
    // valor de um dia típico de cada dia da semana neste mês
    out.porDiaDaSemana = Array.from({ length: 7 }, (_, dow) => {
      const exemplo = mes.find((d) => diaDaSemana(d) === dow);
      return exemplo ? { dia: nomeDiaSemana(exemplo), valor: r2(parte(metas.mensal, exemplo, mes, pesos)) } : null;
    }).filter(Boolean);
    out.hoje = { valor: r2(parte(metas.mensal, hoje, mes, pesos)), de: "mensal" };
    // semana sugerida: soma dos dias da semana corrente que caem no mês; os de
    // outro mês usam a mesma meta mensal (premissa: a meta vale todo mês)
    out.semana = { valor: r2(semana.reduce((acc, d) => acc + parte(metas.mensal, d, d.slice(0, 7) === hoje.slice(0, 7) ? mes : diasDoMes(d), pesos), 0)), de: "mensal" };
  }
  if (metas.semanal) {
    out.hoje = { valor: r2(parte(metas.semanal, hoje, semana, pesos)), de: "semanal" };
  }
  return out;
}

/**
 * Métrica "meta de hoje" com o atingimento junto.
 * @param {object} amb         ambiente do motor (escopo, hoje, apuradoEm)
 * @param {object} prefs       preferenciasDaLinha(...)
 * @param {object} p
 * @param {object} p.faturamentoHoje    métrica de faturamento de hoje (REAL) ou insuficiente
 * @param {object} [p.faturamentoMes]   métrica de faturamento do mês até hoje (REAL) ou insuficiente
 * @param {Array}  [p.historico]        linhas diárias das últimas semanas (pesos por dia da semana)
 */
export function metaDeHoje(amb, prefs, { faturamentoHoje, faturamentoMes = null, historico = null }) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: `hoje (${amb.hoje.slice(8, 10)}/${amb.hoje.slice(5, 7)})` };
  const metas = prefs?.metas || {};
  if (!metas.diaria && !metas.semanal && !metas.mensal) {
    return insuficiente({
      metrica: "meta_faturamento", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes: [FONTE_META],
      motivo: "Nenhuma meta de faturamento está configurada para esta unidade. Configure em Inteligência > Configurações.",
      faltando: ["meta de faturamento (mensal, semanal ou diária)"],
    });
  }
  const sug = sugerirDistribuicao({ metas, hoje: amb.hoje, historico });
  const configurada = metas.diaria != null;
  const valor = configurada ? metas.diaria : sug.hoje.valor;
  const metodoTexto = sug.metodo === "historico_dia_semana"
    ? "distribuída pelo histórico da unidade por dia da semana (últimas 8 semanas)"
    : "distribuída igualmente pelos dias (sem histórico suficiente por dia da semana)";
  const observacoes = configurada ? ["Meta diária digitada nas configurações."]
    : [`SUGESTÃO a partir da meta ${sug.hoje.de} de ${brl(sug.hoje.de === "mensal" ? metas.mensal : metas.semanal)}, ${metodoTexto}. Não é realizado.`];

  // atingimento: só com faturamento REAL completo do dia
  let atingimento;
  if (faturamentoHoje && temValor(faturamentoHoje) && faturamentoHoje.status === "ok") {
    atingimento = { status: "ok", pct: r1((faturamentoHoje.valor / valor) * 100), faturamento: faturamentoHoje.valor, naturezaFaturamento: NATUREZA.REAL };
  } else {
    atingimento = { status: "insuficiente", motivo: faturamentoHoje?.motivo || "Faturamento de hoje ainda não lançado." };
  }
  let mes = null;
  if (metas.mensal) {
    mes = faturamentoMes && temValor(faturamentoMes)
      ? { meta: metas.mensal, acumulado: faturamentoMes.valor, pct: r1((faturamentoMes.valor / metas.mensal) * 100), cobertura: faturamentoMes.cobertura }
      : { meta: metas.mensal, acumulado: null, pct: null, cobertura: "insuficientes" };
  }

  return metrica({
    metrica: "meta_faturamento",
    valor: r2(valor),
    unidade: "BRL",
    natureza: configurada ? NATUREZA.META : NATUREZA.SUGESTAO,
    periodo,
    fontes: sug.metodo === "historico_dia_semana" && !configurada ? [FONTE_META, FONTE_FAT] : [FONTE_META],
    consultas: [],
    escopo: amb.escopo,
    completude: 1,
    confianca: configurada ? CONFIANCA.ALTA : CONFIANCA.MEDIA,
    apuradoEm: amb.apuradoEm,
    observacoes,
    detalhes: {
      origem: configurada ? "configurada" : `sugestao_${sug.hoje.de}`,
      metodo: configurada ? null : sug.metodo,
      atingimento,
      mes,
      semana: metas.semanal ? { valor: metas.semanal, natureza: NATUREZA.META } : sug.semana ? { ...sug.semana, natureza: NATUREZA.SUGESTAO } : null,
    },
  });
}

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
