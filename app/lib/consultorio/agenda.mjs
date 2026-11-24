// AGENDA DO CONSULTÓRIO (dono, 21/11/2026). Funções puras: status e o que a
// secretária pode fazer em cada um, fim pela duração do tipo, valor pelo
// particular ou pelo convênio, horários livres, conflitos, fila do médico,
// resumo do dia e retornos esquecidos. Datas em ISO; hora local do aparelho.

export const UNIDADE_CONSULTORIO = "consultorio";

export const STATUS = {
  agendada: { rotulo: "Agendada", tom: "neutro" },
  confirmada: { rotulo: "Confirmada", tom: "ok" },
  chegou: { rotulo: "Chegou", tom: "destaque" },
  em_atendimento: { rotulo: "Em atendimento", tom: "destaque" },
  atendida: { rotulo: "Atendida", tom: "ok" },
  faltou: { rotulo: "Faltou", tom: "alerta" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};

/** Próximos passos de cada status (o que aparece como botão). */
export const ACOES = {
  agendada: ["confirmada", "chegou", "faltou", "cancelada"],
  confirmada: ["chegou", "faltou", "cancelada"],
  chegou: ["em_atendimento", "cancelada"],
  em_atendimento: ["atendida"],
  atendida: [],
  faltou: ["agendada"],
  cancelada: ["agendada"],
};
export const podeMudar = (de, para) => (ACOES[de] || []).includes(para);

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Fim da consulta pela duração do tipo (minutos). */
export function fimDaConsulta(inicioIso, minutos) {
  const d = new Date(inicioIso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + (Number(minutos) > 0 ? Number(minutos) : 30) * 60000).toISOString();
}

/** Valor da consulta: do convênio para o tipo, senão o particular do tipo. */
export function valorDaConsulta(tipo, convenio = null) {
  if (!tipo) return null;
  if (convenio) {
    const v = num(convenio.valores?.[tipo.id]);
    return v !== null && v >= 0 ? r2(v) : null;
  }
  const v = num(tipo.valor_particular);
  return v !== null && v >= 0 ? r2(v) : null;
}

const ativa = (c) => c.status !== "cancelada" && c.status !== "faltou";

/** Consultas que se sobrepõem a [inicio, fim) (encaixe é permitido; a tela só avisa). */
export function conflitos(lista = [], inicioIso, fimIso, ignorarId = null) {
  const a = new Date(inicioIso).getTime(), b = new Date(fimIso).getTime();
  return lista.filter((c) => c.id !== ignorarId && ativa(c) && new Date(c.inicio).getTime() < b && new Date(c.fim).getTime() > a);
}

/**
 * Horários livres de um dia, de `passo` em `passo` minutos, dentro do
 * expediente ("08:00"–"18:00"), sem bater em consulta ativa.
 */
export function horariosLivres({ dia, consultas = [], expediente = { inicio: "08:00", fim: "18:00" }, minutos = 30, passo = 30, agoraIso = null }) {
  const [hi, mi] = String(expediente.inicio || "08:00").split(":").map(Number);
  const [hf, mf] = String(expediente.fim || "18:00").split(":").map(Number);
  const [a, m, d] = String(dia).split("-").map(Number);
  const ini = new Date(a, m - 1, d, hi, mi).getTime();
  const fim = new Date(a, m - 1, d, hf, mf).getTime();
  const agora = agoraIso ? new Date(agoraIso).getTime() : null;
  const livres = [];
  for (let t = ini; t + minutos * 60000 <= fim; t += passo * 60000) {
    if (agora !== null && t < agora) continue;
    const s = new Date(t).toISOString(), e = new Date(t + minutos * 60000).toISOString();
    if (!conflitos(consultas, s, e).length) livres.push(s);
  }
  return livres;
}

/** Fila do médico: quem chegou, por ordem de chegada; quem está em atendimento primeiro. */
export function filaDoMedico(consultas = []) {
  const em = consultas.filter((c) => c.status === "em_atendimento");
  const chegaram = consultas.filter((c) => c.status === "chegou")
    .sort((x, y) => String(x.chegada_em || x.inicio).localeCompare(String(y.chegada_em || y.inicio)));
  return [...em, ...chegaram];
}

/** Resumo do dia: contagens e dinheiro (recebido = com pago_em). */
export function resumoDoDia(consultas = []) {
  const validas = consultas.filter((c) => c.status !== "cancelada");
  const atendidas = validas.filter((c) => c.status === "atendida");
  const valor = (c) => num(c.valor) || 0;
  return {
    total: validas.length,
    atendidas: atendidas.length,
    faltas: validas.filter((c) => c.status === "faltou").length,
    aguardando: validas.filter((c) => c.status === "chegou" || c.status === "em_atendimento").length,
    previsto: r2(validas.filter((c) => c.status !== "faltou").reduce((t, c) => t + valor(c), 0)),
    recebido: r2(validas.filter((c) => c.pago_em).reduce((t, c) => t + valor(c), 0)),
    aReceber: r2(atendidas.filter((c) => !c.pago_em).reduce((t, c) => t + valor(c), 0)),
  };
}

/**
 * Retornos esquecidos: a ficha pediu retorno em X dias, a data passou e o
 * paciente não tem consulta marcada depois dela.
 */
export function retornosEsquecidos({ fichas = [], consultas = [], pacientes = new Map(), hojeIso }) {
  const ultimaPorPaciente = new Map();
  for (const f of fichas) {
    if (!(Number(f.retorno_dias) > 0)) continue;
    const atual = ultimaPorPaciente.get(f.paciente_id);
    if (!atual || String(f.criado_em) > String(atual.criado_em)) ultimaPorPaciente.set(f.paciente_id, f);
  }
  const hoje = String(hojeIso).slice(0, 10);
  const lista = [];
  for (const [pid, f] of ultimaPorPaciente) {
    const base = new Date(f.criado_em);
    const venc = new Date(base.getTime() + Number(f.retorno_dias) * 86400000).toISOString().slice(0, 10);
    const marcada = consultas.some((c) => c.paciente_id === pid && ativa(c) && String(c.inicio) > String(f.criado_em));
    if (marcada) continue;
    const atraso = Math.round((new Date(`${hoje}T12:00:00Z`) - new Date(`${venc}T12:00:00Z`)) / 86400000);
    lista.push({ paciente_id: pid, paciente: pacientes.get(pid) || null, retornoEm: venc, diasAtraso: atraso, vencido: atraso > 0 });
  }
  return lista.sort((a, b) => a.retornoEm.localeCompare(b.retornoEm));
}

/** Mensagem de confirmação para o WhatsApp (o envio é pelo link, com o aparelho da secretária). */
export function textoDeConfirmacao({ paciente, inicio, nomeConsultorio = "consultório" }) {
  const d = new Date(inicio);
  const data = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const nome = String(paciente?.nome || "").trim().split(/\s+/)[0] || "";
  return `Olá${nome ? `, ${nome}` : ""}! Confirmando sua consulta no ${nomeConsultorio}: ${data}, às ${hora}. Responda SIM para confirmar ou nos avise se precisar remarcar.`;
}

export const soDigitos = (v) => String(v || "").replace(/\D/g, "");
export function cpfValido(v) {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
export function idade(nascimentoIso, hojeIso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(nascimentoIso || ""))) return null;
  const [a, m, d] = nascimentoIso.slice(0, 10).split("-").map(Number);
  const [ha, hm, hd] = String(hojeIso).slice(0, 10).split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

/** Aniversariantes de um mês (MM), ordenados pelo dia. */
export function aniversariantes(pacientes = [], mes) {
  const mm = String(mes).padStart(2, "0");
  return pacientes.filter((p) => /^\d{4}-\d{2}-\d{2}/.test(String(p.nascimento || "")) && String(p.nascimento).slice(5, 7) === mm)
    .sort((a, b) => String(a.nascimento).slice(8, 10).localeCompare(String(b.nascimento).slice(8, 10)));
}

export function textoDeAniversario(paciente, consultorio = "consultório") {
  const nome = String(paciente?.nome || "").trim().split(/\s+/)[0] || "";
  return `Feliz aniversário${nome ? `, ${nome}` : ""}! Toda a equipe do ${consultorio} deseja muita saúde. Conte com a gente.`;
}

/** Pesquisa de satisfação depois da consulta (resposta de 0 a 10 pelo WhatsApp). */
export function textoDeSatisfacao(paciente, consultorio = "consultório") {
  const nome = String(paciente?.nome || "").trim().split(/\s+/)[0] || "";
  return `Olá${nome ? `, ${nome}` : ""}! Obrigado pela consulta no ${consultorio}. De 0 a 10, quanto você recomendaria o nosso atendimento a um amigo? Se quiser, conte o que podemos melhorar.`;
}
