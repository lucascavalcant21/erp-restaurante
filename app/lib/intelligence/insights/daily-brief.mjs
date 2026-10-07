// generateDailyBrief — o resumo do dia da Central de Inteligência.
//
// Só dados reais disponíveis: cada indicador é uma métrica com contrato;
// cada alerta é uma anomalia detectada contra o histórico próprio; cada
// bloco sem base aparece como DADOS INSUFICIENTES com o motivo. O texto do
// resumo é montado por regra (sem modelo de IA), a partir desses números.

import { insuficiente, ROTULO_COBERTURA } from "../core/contratos.mjs";
import { saudacaoNoFuso } from "../core/periodos.mjs";
import { ErroDeIsolamento } from "../context/db-escopado.mjs";
import { detectarTudo } from "../anomalies/detectores.mjs";
import { montarInsight, ordenarInsights } from "./montar.mjs";
import { aprendizadoDe, suprimidos } from "../memory/feedback.mjs";
import { preferenciasDaLinha, limiaresDasPreferencias, alertaLigado } from "../memory/preferencias.mjs";
import { metaDeHoje } from "../metrics/metas.mjs";

/** Quantos alertas aparecem em destaque na Central (o resto fica em "ver todos"). */
export const DESTAQUES = 3;

const primeiroNome = (n) => { const x = String(n || "").trim().split(/\s+/)[0] || ""; return x ? x[0].toUpperCase() + x.slice(1) : ""; };

async function seguro(amb, id, fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErroDeIsolamento) throw e;
    return insuficiente({ metrica: id, motivo: "Não foi possível apurar agora (falha interna). Tente novamente.", escopo: amb.escopo, apuradoEm: amb.apuradoEm });
  }
}

/** Carrega o que o resumo precisa, em paralelo, já com permissão por métrica. */
export async function coletarDados(motor) {
  const amb = motor.ambiente;
  const [faturamentoHoje, faturamento7d, faturamentoMes, historico, compras, precos, vencimentos, divergencias, abaixoMinimo, perdas, contas, cmv, cmo, ticket] = await Promise.all([
    seguro(amb, "faturamento", () => motor.getRevenue("hoje")),
    seguro(amb, "faturamento", () => motor.getRevenue("ultimos_7_dias", { comparar: false })),
    seguro(amb, "faturamento", () => motor.getRevenue("mes", { comparar: false })),
    motor.getRevenueHistory().catch((e) => { if (e instanceof ErroDeIsolamento) throw e; return null; }),
    seguro(amb, "compras", () => motor.getPurchasesTotal("semana")),
    seguro(amb, "variacao_preco", () => motor.getPriceChanges()),
    seguro(amb, "vencimentos", () => motor.getExpiringProducts({ dias: 3 })),
    seguro(amb, "divergencias_estoque", () => motor.getStockVariance()),
    seguro(amb, "abaixo_minimo", () => motor.getLowStock()),
    seguro(amb, "perdas", () => motor.getWaste("semana")),
    seguro(amb, "contas_pagar", () => motor.getAccountsPayable({ dias: 7 })),
    seguro(amb, "cmv", () => motor.getCMV()),
    seguro(amb, "cmo", () => motor.getCMO()),
    seguro(amb, "ticket_medio", () => motor.semBase("ticket_medio")),
  ]);
  return { faturamentoHoje, faturamento7d, faturamentoMes, historico, compras, precos, vencimentos, divergencias, abaixoMinimo, perdas, contas, cmv, cmo, ticket };
}

function resumoDoBloco(m) {
  if (!m) return null;
  return { metrica: m.metrica, status: m.status, cobertura: m.cobertura, rotuloCobertura: m.cobertura ? ROTULO_COBERTURA[m.cobertura] : null, motivo: m.motivo || null };
}

/**
 * @param {object} p
 * @param {object} p.motor      criarMotorDeMetricas(...)
 * @param {object} [p.store]    store de feedback/preferências
 * @param {string} [p.nomeUsuario]
 */
export async function generateDailyBrief({ motor, store = null, nomeUsuario = "" }) {
  const amb = motor.ambiente;
  const dados = await coletarDados(motor);

  let registros = [];
  let linhaPrefs = null;
  if (store) {
    try {
      const desde = new Date(amb.agora.getTime() - 90 * 86400000).toISOString();
      [registros, linhaPrefs] = await Promise.all([store.listarFeedback({ unidadeId: amb.escopo.unidadeId, desde }), store.lerPreferencias(amb.escopo.unidadeId)]);
    } catch {
      registros = []; linhaPrefs = null;
    }
  }
  // sem configuração: todos os alertas, sensibilidade normal, sem meta
  const prefs = preferenciasDaLinha(linhaPrefs);
  const lim = limiaresDasPreferencias(prefs);
  const aprendizado = aprendizadoDe(registros);
  const ocultos = suprimidos(registros, amb.agora);

  const anomalias = detectarTudo({ ...dados, hoje: amb.hoje }, lim);
  const montados = anomalias
    .map((a) => montarInsight(a, { unidadeId: amb.escopo.unidadeId, aprendizado, apuradoEm: amb.apuradoEm }))
    .filter(Boolean)
    .filter((i) => !ocultos.has(i.id));
  const desligados = montados.filter((i) => !alertaLigado(prefs, i.modulo)).length;
  const insights = ordenarInsights(montados.filter((i) => alertaLigado(prefs, i.modulo)));

  const critical = insights.filter((i) => i.nivel === "critico");
  const warnings = insights.filter((i) => i.nivel === "importante");
  const opportunities = insights.filter((i) => i.nivel === "oportunidade");
  const information = insights.filter((i) => i.nivel === "informacao");
  const atencao = critical.length + warnings.length;

  // Meta: só com faturamento permitido (a meta sem o realizado não diz nada a quem não vê vendas)
  const meta = dados.faturamentoHoje?.status === "sem_permissao"
    ? dados.faturamentoHoje
    : await seguro(amb, "meta_faturamento", async () => metaDeHoje(amb, prefs, { faturamentoHoje: dados.faturamentoHoje, faturamentoMes: dados.faturamentoMes, historico: dados.historico }));
  const metrics = [
    { id: "faturamento_hoje", rotulo: "Faturamento hoje", metrica: dados.faturamentoHoje },
    { id: "meta", rotulo: "Meta de hoje", metrica: meta },
    { id: "cmv", rotulo: "CMV", metrica: dados.cmv },
    { id: "cmo", rotulo: "CMO", metrica: dados.cmo },
  ];

  const blocos = Object.entries(dados).filter(([k]) => !["historico", "faturamentoMes", "faturamento7d"].includes(k)).map(([, m]) => resumoDoBloco(m)).filter(Boolean);
  // PERGUNTAS DO HÉFISTO: inconsistências que só a equipe sabe explicar
  // ("O que ocorreu com 3,6 kg de camarão?"). A resposta vira feedback
  // estruturado (intelligence_feedback) e reordena as hipóteses da unidade.
  const perguntasAbertas = insights.filter((i) => i.pergunta).map((i) => ({
    id: i.id, insightId: i.id, insightTipo: i.tipo, titulo: i.titulo, nivel: i.nivel,
    situacao: i.situacao, evidencias: i.evidencias, entidade: i.entidade, ...i.pergunta,
  }));
  // conta os indicadores do resumo (os cartões que a pessoa vê)
  const insuficientes = metrics.filter((x) => x.metrica?.status === "insuficiente").length;
  const nome = primeiroNome(nomeUsuario);
  const saudacao = `${saudacaoNoFuso(amb.agora, amb.fuso)}${nome ? `, ${nome}` : ""}.`;
  const frase = atencao
    ? `Encontrei ${atencao} situaç${atencao === 1 ? "ão" : "ões"} que merece${atencao === 1 ? "" : "m"} sua atenção.`
    : "Não encontrei situações que exijam sua atenção nos dados disponíveis.";
  const cobertura = insuficientes ? ` ${insuficientes} indicador${insuficientes === 1 ? " do resumo está" : "es do resumo estão"} sem dados suficientes.` : "";

  return {
    geradoEm: amb.apuradoEm,
    hoje: amb.hoje,
    fuso: amb.fuso,
    escopo: { unidadeId: amb.escopo.unidadeId, empresaId: amb.escopo.empresaId },
    summary: `${saudacao} ${frase}${cobertura}`,
    critical, warnings, opportunities, information,
    metrics,
    questions: perguntasAbertas.slice(0, 3),
    perguntasAbertas,
    destaques: DESTAQUES,
    cobertura: blocos,
    limiares: lim,
    preferencias: { alertas: prefs.alertas, sensibilidade: prefs.sensibilidade, configuradas: !!linhaPrefs, alertasDesligadosOcultos: desligados },
    consultas: motor.ambiente.dbe.consultas.length,
  };
}
