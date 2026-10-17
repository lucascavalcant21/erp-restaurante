// Lista de reservas de mesa (Eventos → Reservas): período, busca e
// agrupamento por dia. Funções puras (testes em reservas-lista.test.mjs).
//
// O status das reservas chega em duas línguas: a tela grava "nova"/"pendente"
// e as ações do assistente (reservas-domain-action.js) gravam
// "confirmed"/"cancelled". Aqui os dois viram o mesmo rótulo.

const ROTULOS = {
  nova: "Nova", pendente: "Pendente", pending: "Pendente",
  confirmada: "Confirmada", confirmed: "Confirmada",
  cancelada: "Cancelada", cancelled: "Cancelada", canceled: "Cancelada",
  sentou: "Chegou", compareceu: "Chegou", seated: "Chegou",
  nao_compareceu: "Não veio", no_show: "Não veio",
};

export function rotuloStatusReserva(status) {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return "Nova";
  return ROTULOS[s] || s.charAt(0).toUpperCase() + s.slice(1);
}

export const reservaCancelada = (r) => /cancel/i.test(String(r?.status || ""));
export const reservaConfirmada = (r) => /^(confirmada|confirmed)$/i.test(String(r?.status || "").trim());

const dataDa = (r) => String(r?.data_reserva || "").slice(0, 10);
const horaDa = (r) => String(r?.horario || "").slice(0, 5);
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * periodo: "proximas" (hoje em diante, sem canceladas), "passadas" (antes de
 * hoje, mais recentes primeiro) ou "todas". termo procura no nome, telefone,
 * mesa e ocasião (sem acento, e o telefone também só pelos dígitos).
 */
export function filtrarReservas(reservas, { periodo = "proximas", termo = "", hojeIso } = {}) {
  const t = semAcento(termo).trim();
  const digitos = t.replace(/\D/g, "");
  let lista = (reservas || []).filter((r) => dataDa(r));
  if (periodo === "proximas") lista = lista.filter((r) => dataDa(r) >= hojeIso && !reservaCancelada(r));
  if (periodo === "passadas") lista = lista.filter((r) => dataDa(r) < hojeIso);
  if (t) {
    lista = lista.filter((r) => {
      const texto = semAcento([r.cliente_nome, r.telefone, r.mesa, r.ocasiao].filter(Boolean).join(" "));
      if (texto.includes(t)) return true;
      return digitos.length >= 3 && String(r.telefone || "").replace(/\D/g, "").includes(digitos);
    });
  }
  const chave = (r) => `${dataDa(r)} ${horaDa(r)}`;
  lista.sort((a, b) => (periodo === "passadas" ? chave(b).localeCompare(chave(a)) : chave(a).localeCompare(chave(b))));
  return lista;
}

/** [[dataIso, reservas[]], ...] na ordem em que a lista já está. */
export function agruparPorDia(reservas) {
  const m = new Map();
  for (const r of reservas || []) {
    const d = dataDa(r);
    if (!m.has(d)) m.set(d, []);
    m.get(d).push(r);
  }
  return [...m.entries()];
}

/** Total de pessoas sem contar as canceladas. */
export const pessoasDasReservas = (reservas) =>
  (reservas || []).filter((r) => !reservaCancelada(r)).reduce((t, r) => t + (Number(r.qtd_pessoas) || 0), 0);
