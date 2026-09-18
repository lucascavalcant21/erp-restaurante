// ═══════════════════════════════════════════════════════════════
// FASE 2C — DOMAIN ACTIONS: GESTÃO DE RESERVAS (CRIAR, ALTERAR, CANCELAR)
// app/lib/reservas-domain-action.js
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase.js";
import { canAccessRoute, hasPermission } from "./permissions-catalog.mjs";

// Capacidade padrão máxima de pessoas por horário/turno no salão (editável no ERP)
const CAPACIDADE_MAXIMA_TURNO = 60;

// Armazenamento fallback em memória com isolamento por unidade (para ambientes sem Supabase ou testes local)
const memoryReservasStore = new Map();

function getMemoryReservas(unitId) {
  if (!memoryReservasStore.has(unitId)) {
    memoryReservasStore.set(unitId, [
      {
        id: "res-101",
        unidade_id: unitId,
        cliente_nome: "Mariana Silva",
        cliente_telefone: "(11) 98765-4321",
        data: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // amanhã
        horario: "20:00",
        pessoas: 4,
        mesa: "Mesa 05",
        status: "confirmed",
        created_at: new Date().toISOString()
      },
      {
        id: "res-102",
        unidade_id: unitId,
        cliente_nome: "Carlos Eduardo",
        cliente_telefone: "(11) 91234-5678",
        data: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        horario: "20:00",
        pessoas: 2,
        mesa: "Mesa 02",
        status: "confirmed",
        created_at: new Date().toISOString()
      }
    ]);
  }
  return memoryReservasStore.get(unitId);
}

/**
 * Consulta a disponibilidade real de mesas/vagas no horário.
 */
export async function consultarDisponibilidadeReservas(unitId, data, horario, pessoas, mesaRequisitada = null, ignoreReservaId = null) {
  let reservasAtivas = [];

  if (isSupabaseReady()) {
    try {
      const { data: resData, error } = await supabase
        .from("reservas")
        .select("*")
        .eq("unidade_id", unitId)
        .eq("data", data)
        .neq("status", "cancelled");
      if (!error && resData) reservasAtivas = resData;
      else reservasAtivas = getMemoryReservas(unitId).filter(r => r.data === data && r.status !== "cancelled");
    } catch (e) {
      reservasAtivas = getMemoryReservas(unitId).filter(r => r.data === data && r.status !== "cancelled");
    }
  } else {
    reservasAtivas = getMemoryReservas(unitId).filter(
      r => r.data === data && r.status !== "cancelled"
    );
  }

  // Filtrar reservation sendo alterada se ignoreReservaId fornecido
  if (ignoreReservaId) {
    reservasAtivas = reservasAtivas.filter(r => String(r.id) !== String(ignoreReservaId));
  }

  // Soma de pessoas no horário solicitado
  const pessoasNoHorario = reservasAtivas
    .filter(r => r.horario === horario)
    .reduce((acc, r) => acc + Number(r.pessoas || 0), 0);

  const capacidadeDisponivel = CAPACIDADE_MAXIMA_TURNO - pessoasNoHorario;
  const vagasSuficientes = capacidadeDisponivel >= Number(pessoas);

  // Verifica se a mesa específica está ocupada por outra reserva
  let mesaOcupada = false;
  if (mesaRequisitada && mesaRequisitada !== "Mesa a definir") {
    mesaOcupada = reservasAtivas.some(
      r => r.horario === horario && (r.mesa || "").toLowerCase() === mesaRequisitada.toLowerCase()
    );
  }

  return {
    disponivel: vagasSuficientes && !mesaOcupada,
    capacidadeDisponivel,
    pessoasNoHorario,
    mesaOcupada,
    conflitoMotivo: !vagasSuficientes
      ? `Capacidade do horário (${horario}) excedida. Vagas disponíveis: ${capacidadeDisponivel}, Solicitadas: ${pessoas}.`
      : mesaOcupada
      ? `A mesa "${mesaRequisitada}" já está reservada por outro cliente para as ${horario}.`
      : null
  };
}

/**
 * Domain Action: Criar Reserva
 */
export async function criarReservaDomainAction(ctx, input) {
  const { session, unitId } = ctx || {};

  if (session?.gerenciado && !hasPermission(session, "salao.tables.view") && !canAccessRoute(session, "/dashboard/salao/mesas")) {
    throw new Error("Permissão negada: Usuário não tem permissão para gerenciar reservas de salão.");
  }

  if (!unitId) throw new Error("Unidade não informada.");

  const clienteNome = (input.clienteNome || input.nome || "").trim();
  if (!clienteNome) throw new Error("Nome do cliente é obrigatório para a reserva.");

  const data = input.data || new Date().toISOString().slice(0, 10);
  const horario = input.horario || "19:30";
  const pessoas = Number(input.pessoas || 2);
  if (isNaN(pessoas) || pessoas <= 0) throw new Error("Quantidade de pessoas inválida.");

  // Re-validação de Concorrência e Disponibilidade
  const disp = await consultarDisponibilidadeReservas(unitId, data, horario, pessoas, input.mesa);
  if (!disp.disponivel) {
    const err = new Error(`DISPONIBILIDADE_ALTERADA: ${disp.conflitoMotivo}`);
    err.code = "DISPONIBILIDADE_ALTERADA";
    throw err;
  }

  const novaReserva = {
    id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    unidade_id: unitId,
    cliente_nome: clienteNome,
    cliente_telefone: input.clienteTelefone || input.telefone || "",
    data,
    horario,
    pessoas,
    mesa: input.mesa || "Mesa a definir",
    observacoes: input.observacoes || "Reserva criada via Héfisto Agent WRITE",
    status: "confirmed",
    created_at: new Date().toISOString()
  };

  let savedInDb = false;
  if (isSupabaseReady()) {
    try {
      const { data: dbData, error } = await supabase
        .from("reservas")
        .insert([novaReserva])
        .select()
        .single();
      if (!error && dbData) savedInDb = true;
    } catch (e) {
      savedInDb = false;
    }
  }

  if (!savedInDb) {
    getMemoryReservas(unitId).push(novaReserva);
  }

  return {
    success: true,
    reservaId: novaReserva.id,
    clienteNome: novaReserva.cliente_nome,
    clienteTelefone: novaReserva.cliente_telefone,
    data: novaReserva.data,
    horario: novaReserva.horario,
    pessoas: novaReserva.pessoas,
    mesa: novaReserva.mesa,
    status: novaReserva.status,
    executedAt: new Date().toISOString()
  };
}

/**
 * Domain Action: Alterar Reserva
 */
export async function alterarReservaDomainAction(ctx, input) {
  const { session, unitId } = ctx || {};
  if (!unitId) throw new Error("Unidade não informada.");

  const reservaId = input.reservaId || input.id;
  if (!reservaId) throw new Error("ID da reserva não informado para alteração.");

  let reservaExistente = null;
  const reservasMemory = getMemoryReservas(unitId);

  if (isSupabaseReady()) {
    try {
      const { data: dbRes, error } = await supabase.from("reservas").select("*").eq("id", reservaId).single();
      if (!error && dbRes) reservaExistente = dbRes;
    } catch (e) {}
  }

  if (!reservaExistente) {
    reservaExistente = reservasMemory.find(r => r.id === reservaId);
  }

  if (!reservaExistente) {
    throw new Error(`Reserva não encontrada: ${reservaId}`);
  }

  const novaData = input.data || reservaExistente.data;
  const novoHorario = input.horario || reservaExistente.horario;
  const novasPessoas = Number(input.pessoas || reservaExistente.pessoas);
  const novaMesa = input.mesa || reservaExistente.mesa;

  // Re-validar disponibilidade ignorando a própria reserva sendo alterada
  if (novaData !== reservaExistente.data || novoHorario !== reservaExistente.horario || novasPessoas > reservaExistente.pessoas) {
    const disp = await consultarDisponibilidadeReservas(unitId, novaData, novoHorario, novasPessoas, novaMesa, reservaId);
    if (!disp.disponivel) {
      const err = new Error(`DISPONIBILIDADE_ALTERADA: ${disp.conflitoMotivo}`);
      err.code = "DISPONIBILIDADE_ALTERADA";
      throw err;
    }
  }

  const patch = {
    cliente_nome: input.clienteNome || reservaExistente.cliente_nome,
    cliente_telefone: input.clienteTelefone || reservaExistente.cliente_telefone,
    data: novaData,
    horario: novoHorario,
    pessoas: novasPessoas,
    mesa: novaMesa,
    observacoes: input.observacoes || reservaExistente.observacoes,
    updated_at: new Date().toISOString()
  };

  let savedInDb = false;
  if (isSupabaseReady()) {
    try {
      const { error } = await supabase.from("reservas").update(patch).eq("id", reservaId);
      if (!error) savedInDb = true;
    } catch (e) {}
  }

  if (!savedInDb) {
    Object.assign(reservaExistente, patch);
  }

  return {
    success: true,
    reservaId,
    dadosAnteriores: {
      data: reservaExistente.data,
      horario: reservaExistente.horario,
      pessoas: reservaExistente.pessoas,
      mesa: reservaExistente.mesa
    },
    dadosNovos: {
      data: patch.data,
      horario: patch.horario,
      pessoas: patch.pessoas,
      mesa: patch.mesa
    },
    executedAt: new Date().toISOString()
  };
}

/**
 * Domain Action: Cancelar Reserva (RISK LEVEL HIGH)
 */
export async function cancelarReservaDomainAction(ctx, input) {
  const { session, unitId } = ctx || {};
  if (!unitId) throw new Error("Unidade não informada.");

  const reservaId = input.reservaId || input.id;
  if (!reservaId) throw new Error("ID da reserva não informado para cancelamento.");

  let reservaExistente = null;
  const reservasMemory = getMemoryReservas(unitId);

  if (isSupabaseReady()) {
    try {
      const { data: dbRes, error } = await supabase.from("reservas").select("*").eq("id", reservaId).single();
      if (!error && dbRes) reservaExistente = dbRes;
    } catch (e) {}
  }

  if (!reservaExistente) {
    reservaExistente = reservasMemory.find(r => r.id === reservaId);
  }

  if (!reservaExistente) {
    throw new Error(`Reserva não encontrada para cancelamento: ${reservaId}`);
  }

  if (reservaExistente.status === "cancelled") {
    throw new Error(`Reserva ${reservaId} já se encontra cancelada.`);
  }

  const patch = {
    status: "cancelled",
    motivo_cancelamento: input.motivo || "Cancelado via Héfisto Agent WRITE",
    cancelled_at: new Date().toISOString()
  };

  let savedInDb = false;
  if (isSupabaseReady()) {
    try {
      const { error } = await supabase.from("reservas").update(patch).eq("id", reservaId);
      if (!error) savedInDb = true;
    } catch (e) {}
  }

  if (!savedInDb) {
    Object.assign(reservaExistente, patch);
  }

  return {
    success: true,
    reservaId,
    clienteNome: reservaExistente.cliente_nome,
    data: reservaExistente.data,
    horario: reservaExistente.horario,
    pessoas: reservaExistente.pessoas,
    status: "CANCELLED",
    motivo: patch.motivo_cancelamento,
    executedAt: new Date().toISOString()
  };
}
