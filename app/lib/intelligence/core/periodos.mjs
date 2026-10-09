// Períodos da inteligência, sempre no fuso da empresa (padrão São Paulo).
// "Hoje" do servidor (UTC) não é o "hoje" do restaurante: às 22h em São Paulo
// já é amanhã em UTC. Toda data aqui é ISO (AAAA-MM-DD) no fuso informado.

export const FUSO_PADRAO = "America/Sao_Paulo";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const p2 = (n) => String(n).padStart(2, "0");
const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function fusoValido(tz) {
  if (!tz || typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Data ISO de `agora` no fuso. */
export function hojeNoFuso(agora = new Date(), tz = FUSO_PADRAO) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: fusoValido(tz) ? tz : FUSO_PADRAO, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(agora);
  const v = (t) => partes.find((x) => x.type === t)?.value;
  return `${v("year")}-${v("month")}-${v("day")}`;
}

/** Hora (0–23) de `agora` no fuso. */
export function horaNoFuso(agora = new Date(), tz = FUSO_PADRAO) {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: fusoValido(tz) ? tz : FUSO_PADRAO, hour: "numeric", hourCycle: "h23" }).format(agora);
  return Number(h) % 24;
}

export function somarDias(iso, dias) {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return `${dt.getUTCFullYear()}-${p2(dt.getUTCMonth() + 1)}-${p2(dt.getUTCDate())}`;
}

export function diasEntre(de, ate) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export const nomeDiaSemana = (iso) => DIAS_SEMANA[diaDaSemana(iso)];
export const ddmm = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;
export const ddmmaaaa = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}`;

/** Lista de datas ISO do período (inclusivo nas duas pontas). */
export function diasDoPeriodo({ de, ate }) {
  const out = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) out.push(d);
  return out;
}

export function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export const TIPOS_PERIODO = Object.freeze([
  "hoje", "ontem", "semana", "semana_passada", "ultimos_7_dias", "mes", "mes_passado", "ultimos_30_dias", "proximos_dias",
]);

/**
 * Período concreto a partir do tipo pedido.
 *   semana = segunda-feira desta semana até hoje (semana em andamento)
 *   mes    = dia 1 até hoje (mês em andamento)
 *   proximos_dias = hoje até hoje + n (para vencimentos)
 */
export function resolverPeriodo(tipo, { agora = new Date(), fuso = FUSO_PADRAO, dias = 7 } = {}) {
  const hoje = hojeNoFuso(agora, fuso);
  const n = Math.max(1, Math.min(90, Math.round(Number(dias) || 7)));
  const base = { tipo, fuso: fusoValido(fuso) ? fuso : FUSO_PADRAO, hoje };
  switch (tipo) {
    case "hoje":
      return fechar({ ...base, de: hoje, ate: hoje, rotulo: `hoje (${ddmm(hoje)})`, emAndamento: true });
    case "ontem": {
      const d = somarDias(hoje, -1);
      return fechar({ ...base, de: d, ate: d, rotulo: `ontem (${ddmm(d)})`, emAndamento: false });
    }
    case "semana": {
      const dow = diaDaSemana(hoje);
      const de = somarDias(hoje, -((dow + 6) % 7));
      return fechar({ ...base, de, ate: hoje, rotulo: `esta semana (${ddmm(de)} a ${ddmm(hoje)})`, emAndamento: true });
    }
    case "semana_passada": {
      const dow = diaDaSemana(hoje);
      const seg = somarDias(hoje, -((dow + 6) % 7) - 7);
      const dom = somarDias(seg, 6);
      return fechar({ ...base, de: seg, ate: dom, rotulo: `semana passada (${ddmm(seg)} a ${ddmm(dom)})`, emAndamento: false });
    }
    case "ultimos_7_dias": {
      const de = somarDias(hoje, -6);
      return fechar({ ...base, de, ate: hoje, rotulo: `últimos 7 dias (${ddmm(de)} a ${ddmm(hoje)})`, emAndamento: true });
    }
    case "ultimos_30_dias": {
      const de = somarDias(hoje, -29);
      return fechar({ ...base, de, ate: hoje, rotulo: `últimos 30 dias (${ddmm(de)} a ${ddmm(hoje)})`, emAndamento: true });
    }
    case "mes": {
      const de = `${hoje.slice(0, 7)}-01`;
      const [a, m] = hoje.split("-").map(Number);
      return fechar({ ...base, de, ate: hoje, rotulo: `${MESES[m - 1]} de ${a} (até ${ddmm(hoje)})`, emAndamento: true });
    }
    case "mes_passado": {
      const [a, m] = hoje.split("-").map(Number);
      const am = m === 1 ? a - 1 : a;
      const mm = m === 1 ? 12 : m - 1;
      const de = `${am}-${p2(mm)}-01`;
      const ate = `${am}-${p2(mm)}-${p2(ultimoDiaDoMes(am, mm))}`;
      return fechar({ ...base, de, ate, rotulo: `${MESES[mm - 1]} de ${am}`, emAndamento: false });
    }
    case "proximos_dias": {
      const ate = somarDias(hoje, n);
      return fechar({ ...base, de: hoje, ate, rotulo: `próximos ${n} dias (até ${ddmm(ate)})`, emAndamento: true });
    }
    default:
      throw new Error(`Tipo de período desconhecido: ${tipo}`);
  }
}

function fechar(p) {
  return Object.freeze({ ...p, dias: diasEntre(p.de, p.ate) + 1 });
}

/**
 * O período anterior COMPARÁVEL: mesma quantidade de dias, imediatamente antes.
 * Semana em andamento (seg→qua) compara com seg→qua da semana anterior; mês em
 * andamento (1→17) compara com 1→17 do mês anterior.
 */
export function periodoAnterior(periodo) {
  if (!ISO.test(periodo?.de) || !ISO.test(periodo?.ate)) throw new Error("Período inválido.");
  if (periodo.tipo === "mes") {
    const [a, m] = periodo.de.split("-").map(Number);
    const am = m === 1 ? a - 1 : a;
    const mm = m === 1 ? 12 : m - 1;
    const diaFim = Math.min(Number(periodo.ate.slice(8, 10)), ultimoDiaDoMes(am, mm));
    const de = `${am}-${p2(mm)}-01`;
    const ate = `${am}-${p2(mm)}-${p2(diaFim)}`;
    return Object.freeze({ tipo: "mes_anterior_equivalente", de, ate, rotulo: `${ddmm(de)} a ${ddmm(ate)}`, dias: diasEntre(de, ate) + 1, fuso: periodo.fuso });
  }
  if (periodo.tipo === "semana" || periodo.tipo === "semana_passada") {
    const de = somarDias(periodo.de, -7);
    const ate = somarDias(periodo.ate, -7);
    return Object.freeze({ tipo: "semana_anterior_equivalente", de, ate, rotulo: `${ddmm(de)} a ${ddmm(ate)}`, dias: diasEntre(de, ate) + 1, fuso: periodo.fuso });
  }
  // Um dia só ("hoje", "ontem"): o mesmo dia da semana anterior — quarta se
  // compara com quarta, não com a terça.
  if (periodo.de === periodo.ate) {
    const d = somarDias(periodo.de, -7);
    return Object.freeze({ tipo: "mesmo_dia_semana_anterior", de: d, ate: d, rotulo: `${nomeDiaSemana(d)} anterior (${ddmm(d)})`, dias: 1, fuso: periodo.fuso });
  }
  const n = diasEntre(periodo.de, periodo.ate) + 1;
  const ate = somarDias(periodo.de, -1);
  const de = somarDias(ate, -(n - 1));
  return Object.freeze({ tipo: "anterior_equivalente", de, ate, rotulo: `${ddmm(de)} a ${ddmm(ate)}`, dias: n, fuso: periodo.fuso });
}

function deslocamentoMin(instante, tz) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instante);
  const v = (t) => Number(partes.find((x) => x.type === t)?.value);
  return (Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second")) - instante.getTime()) / 60000;
}

/** Instante UTC (ISO) da meia-noite local de `iso` no fuso. */
export function inicioDoDiaUtc(iso, tz = FUSO_PADRAO) {
  const fuso = fusoValido(tz) ? tz : FUSO_PADRAO;
  const [a, m, d] = String(iso).split("-").map(Number);
  let t = Date.UTC(a, m - 1, d);
  for (let i = 0; i < 2; i++) t = Date.UTC(a, m - 1, d) - deslocamentoMin(new Date(t), fuso) * 60000;
  return new Date(t).toISOString();
}

/** [início, fim) em UTC para filtrar colunas timestamptz pelo período local. */
export function limitesUtc({ de, ate, fuso = FUSO_PADRAO }) {
  return { inicio: inicioDoDiaUtc(de, fuso), fim: inicioDoDiaUtc(somarDias(ate, 1), fuso) };
}

export function saudacaoNoFuso(agora = new Date(), fuso = FUSO_PADRAO) {
  const h = horaNoFuso(agora, fuso);
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}
