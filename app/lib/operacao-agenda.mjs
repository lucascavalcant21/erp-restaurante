// MOTOR DE RECORRÊNCIA da Operação Inteligente.
// Função pura: dada uma agenda e uma data, diz SE a rotina acontece naquele dia
// e A QUE HORAS. Não toca em banco — assim dá para testar sem infraestrutura.
//
// Idempotência: quem grava usa (agenda_id, data_referencia, previsto_para) como
// chave única. Rodar a geração dez vezes no mesmo dia cria uma execução só.

const p2 = (n) => String(n).padStart(2, "0");

// "2026-08-15" -> Date local ao meio-dia (evita virar o dia por fuso).
export function dataLocal(iso) {
  return new Date(`${String(iso).slice(0, 10)}T12:00:00`);
}

export function isoData(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

// Junta data + "HH:MM[:SS]" num Date local.
export function combinarDataHora(iso, hora) {
  const [h, m] = String(hora || "00:00").split(":");
  const d = dataLocal(iso);
  d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
  return d;
}

// A rotina acontece nesta data?
export function aconteceEm(agenda, iso) {
  if (!agenda || agenda.ativo === false) return false;
  const d = dataLocal(iso);
  const diaSemana = d.getDay();          // 0=domingo
  const diaMes = d.getDate();

  switch (agenda.frequencia) {
    case "diaria":
      return true;
    case "dias_semana":
      return (agenda.dias_semana || []).includes(diaSemana);
    case "semanal": {
      // Semanal sem dia definido cai no dia da semana da primeira data.
      const dias = agenda.dias_semana || [];
      return dias.length ? dias.includes(diaSemana) : true;
    }
    case "quinzenal": {
      // Quinzenal precisa de uma âncora: usa a criação da agenda.
      const base = agenda.created_at ? dataLocal(agenda.created_at) : d;
      const dias = Math.round((d - base) / 86400000);
      const noDiaCerto = (agenda.dias_semana || []).length
        ? (agenda.dias_semana || []).includes(diaSemana)
        : true;
      return noDiaCerto && dias >= 0 && Math.floor(dias / 7) % 2 === 0;
    }
    case "mensal":
      return Number(agenda.dia_mes || 1) === diaMes;
    case "datas":
      return (agenda.datas || []).map(x => String(x).slice(0, 10)).includes(String(iso).slice(0, 10));
    default:
      return false;
  }
}

// Execuções previstas para uma data, a partir de várias agendas.
// Devolve o registro pronto para gravar (sem id).
export function execucoesPrevistas(agendas, iso, { processos = [] } = {}) {
  const saida = [];
  for (const agenda of agendas || []) {
    if (!aconteceEm(agenda, iso)) continue;
    const previsto = combinarDataHora(iso, agenda.hora_inicio);
    const prazo = new Date(previsto.getTime() + (Number(agenda.minutos_prazo) || 120) * 60000);
    const processo = processos.find(p => p.id === agenda.processo_id);
    saida.push({
      unidade_id: agenda.unidade_id,
      processo_id: agenda.processo_id,
      agenda_id: agenda.id,
      processo_versao: processo?.versao || 1,
      data_referencia: String(iso).slice(0, 10),
      previsto_para: previsto.toISOString(),
      prazo_ate: prazo.toISOString(),
      responsavel_id: agenda.responsavel_id || null,
      status: "AGENDADA",
    });
  }
  return saida;
}

// Status calculado no servidor — o frontend nunca decide sozinho se atrasou.
export function statusDaExecucao(execucao, agora = new Date()) {
  if (!execucao) return "AGENDADA";
  if (["CONCLUIDA", "CONCLUIDA_COM_ATRASO", "CANCELADA"].includes(execucao.status)) return execucao.status;

  const previsto = new Date(execucao.previsto_para);
  const prazo = execucao.prazo_ate ? new Date(execucao.prazo_ate) : null;
  const emAndamento = execucao.status === "EM_ANDAMENTO";

  if (prazo && agora > prazo) return emAndamento ? "EM_ANDAMENTO" : "ATRASADA";
  if (agora >= previsto) return emAndamento ? "EM_ANDAMENTO" : "DISPONIVEL";
  return "AGENDADA";
}

// Concluir agora seria dentro do prazo?
export function concluiuNoPrazo(execucao, agora = new Date()) {
  if (!execucao?.prazo_ate) return true;
  return agora <= new Date(execucao.prazo_ate);
}

// Um item numérico está dentro do padrão definido pelo administrador?
export function dentroDoLimite(item, valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  const min = item?.valor_min == null ? null : Number(item.valor_min);
  const max = item?.valor_max == null ? null : Number(item.valor_max);
  if (min != null && n < min) return false;
  if (max != null && n > max) return false;
  return true;
}

// A resposta conta como conforme? Decide por tipo de item.
export function respostaConforme(item, resposta) {
  if (!item) return null;
  if (resposta?.nao_aplica) return null;               // N/A não pontua

  const tipo = String(item.tipo || "").toUpperCase();
  const valor = resposta?.valor;

  if (["NUMERO", "DECIMAL", "TEMPERATURA", "QUANTIDADE", "PERCENTUAL", "MOEDA"].includes(tipo)) {
    return dentroDoLimite(item, resposta?.valor_numero ?? valor);
  }
  if (["BOOLEAN", "FEITO_NAO_FEITO", "CONFORME_NAO_CONFORME", "SIM_NAO"].includes(tipo)) {
    const positivos = ["sim", "feito", "conforme", "true", "ok"];
    return positivos.includes(String(valor || "").toLowerCase());
  }
  if (["SELECAO_UNICA", "MULTIPLA_ESCOLHA"].includes(tipo) && item.resposta_esperada) {
    return String(valor || "").toLowerCase() === String(item.resposta_esperada).toLowerCase();
  }
  // Texto, foto, assinatura e datas: responder já é cumprir.
  return valor != null && String(valor).trim() !== "";
}

// Item condicional: só aparece quando o item do qual depende teve certa resposta.
export function itemVisivel(item, respostasPorItem) {
  if (!item?.depende_item_id) return true;
  const r = respostasPorItem?.[item.depende_item_id];
  if (!r) return false;
  return String(r.valor || "").toLowerCase() === String(item.depende_valor || "").toLowerCase();
}

// Score operacional 0–100. Pesos configuráveis; itens críticos pesam mais.
export function calcularScore({ execucoes = [], pesos = { pontualidade: 35, execucao: 25, qualidade: 40 } }) {
  const feitas = execucoes.filter(e => ["CONCLUIDA", "CONCLUIDA_COM_ATRASO"].includes(e.status));
  const total = execucoes.filter(e => e.status !== "CANCELADA").length;
  if (!total) return { score: null, pontualidade: null, execucao: null, qualidade: null, total: 0 };

  const noPrazo = feitas.filter(e => e.status === "CONCLUIDA").length;
  const pontualidade = feitas.length ? (noPrazo / feitas.length) * 100 : 0;
  const execucao = (feitas.length / total) * 100;

  const somaItens = feitas.reduce((s, e) => s + (Number(e.itens_conformes) || 0) + (Number(e.itens_nao_conformes) || 0), 0);
  const conformes = feitas.reduce((s, e) => s + (Number(e.itens_conformes) || 0), 0);
  const qualidade = somaItens ? (conformes / somaItens) * 100 : 100;

  const soma = (pesos.pontualidade + pesos.execucao + pesos.qualidade) || 100;
  const score = (pontualidade * pesos.pontualidade + execucao * pesos.execucao + qualidade * pesos.qualidade) / soma;

  const r = (n) => Math.round(n * 10) / 10;
  return { score: r(score), pontualidade: r(pontualidade), execucao: r(execucao), qualidade: r(qualidade), total };
}
