// ═══════════════════════════════════════════════════════════════
// FASE 2C — CONFIRMATION ENGINE & IDEMPOTENCY LOCK
// app/lib/confirmation-engine.js
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase.js";
import { WRITE_TOOL_CATALOG } from "./agent-write-catalog.js";
import { checkAgentLimits } from "./agent-limits.js";
import { canAccessRoute, hasPermission } from "./permissions-catalog.mjs";

const DEFAULT_EXPIRATION_MINUTES = 10;

// Armazenamento em memória para dev local / fallback de testes sintéticos
const memoryConfirmationsStore = new Map();
const memoryAuditLogStore = [];

/**
 * Cria um registro de confirmação pendente após o Dry-Run da Tool WRITE.
 */
export async function createPendingConfirmation({
  conversationId = "conv-default",
  agentRunId = `run-${Date.now()}`,
  toolCallId = `call-${Date.now()}`,
  toolName,
  session,
  input,
}) {
  const writeTool = WRITE_TOOL_CATALOG.get(toolName);
  if (!writeTool) {
    throw new Error(`Ferramenta WRITE desconhecida ou não registrada: '${toolName}'`);
  }

  // 1. Verificação de Limites Configuráveis
  const limitCheck = checkAgentLimits(toolName, input);
  if (!limitCheck.ok) {
    throw new Error(`LIMITE_EXCEDIDO: ${limitCheck.reason}`);
  }

  // 2. Executar Dry-Run Handler para gerar Prévia e Payload Sanitizado
  const ctx = {
    session,
    unitId: session?.unidadeId || "unidade-teste",
    empresaId: session?.empresaId || "empresa-teste",
    userId: session?.usuarioId || "user-test",
  };

  const { preview, payloadSanitizado } = await writeTool.handler(ctx, input);

  const confirmationId = `cnf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const idempotencyKey = `idemp-${conversationId}-${toolName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_EXPIRATION_MINUTES * 60 * 1000);

  const record = {
    confirmation_id: confirmationId,
    conversation_id: conversationId,
    agent_run_id: agentRunId,
    tool_call_id: toolCallId,
    tool: toolName,
    user_id: session?.usuarioId || "user-test",
    empresa_id: session?.empresaId || "empresa-teste",
    unidade_id: session?.unidadeId || "unidade-teste",
    risk_level: writeTool.riskLevel,
    input_sanitizado: payloadSanitizado,
    preview: preview,
    status: "PENDING",
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    confirmed_at: null,
    executed_at: null,
    idempotency_key: idempotencyKey,
  };

  // Sempre grava na memória para garantia de fallback em ambientes sem tabela
  memoryConfirmationsStore.set(confirmationId, record);

  if (isSupabaseReady()) {
    try {
      await supabase.from("agent_confirmations").insert([record]);
    } catch (e) {}
  }

  return {
    confirmationId,
    tool: toolName,
    riskLevel: writeTool.riskLevel,
    expiresAt: expiresAt.toISOString(),
    preview,
    status: "PENDING",
  };
}

/**
 * Executa uma ferramenta WRITE após a confirmação explícita do usuário.
 * IMPORTANTE: Aceita APENAS confirmationId vindo do frontend. NUNCA aceita payload re-enviado.
 */
export async function executeConfirmedTool({ confirmationId, session }) {
  if (!confirmationId) {
    throw new Error("confirmationId é obrigatório para execução de ferramenta WRITE.");
  }

  // 1. Buscar registro de confirmação original no banco / store
  let record = memoryConfirmationsStore.get(confirmationId);

  if (isSupabaseReady()) {
    try {
      const { data: dbRec, error } = await supabase
        .from("agent_confirmations")
        .select("*")
        .eq("confirmation_id", confirmationId)
        .single();
      if (!error && dbRec) record = dbRec;
    } catch (e) {}
  }

  if (!record) {
    throw new Error(`Confirmação não encontrada ou expirada: ${confirmationId}`);
  }

  // 2. Validar Status PENDING
  if (record.status === "EXECUTED") {
    return {
      alreadyExecuted: true,
      success: true,
      message: "Esta ação já foi executada anteriormente (Garantia de Idempotência).",
      confirmationId: record.confirmation_id,
      executedAt: record.executed_at,
    };
  }

  if (record.status !== "PENDING" && record.status !== "CONFIRMED") {
    throw new Error(`Esta confirmação não está pendente (status atual: ${record.status}).`);
  }

  // 3. Validar Expiração
  const now = new Date();
  const expiresAt = new Date(record.expires_at);
  if (now > expiresAt) {
    record.status = "EXPIRED";
    if (isSupabaseReady()) {
      try { await supabase.from("agent_confirmations").update({ status: "EXPIRED" }).eq("confirmation_id", confirmationId); } catch (e) {}
    }
    throw new Error("A confirmação expirou. Solicite a ação novamente para gerar uma nova prévia.");
  }

  // 4. Validar Escopo de Usuário e Unidade
  if (session?.usuarioId && record.user_id && record.user_id !== session.usuarioId) {
    throw new Error("Segurança: Esta confirmação pertence a outro usuário.");
  }

  if (session?.unidadeId && record.unidade_id && record.unidade_id !== session.unidadeId) {
    throw new Error("Segurança: Esta confirmação foi gerada para outra unidade.");
  }

  // 5. Obter Definição da Ferramenta no Catálogo
  const writeTool = WRITE_TOOL_CATALOG.get(record.tool);
  if (!writeTool) {
    throw new Error(`Ferramenta WRITE não cadastrada: ${record.tool}`);
  }

  // 6. Re-validar Permissão do Usuário
  const hasPerm = writeTool.requiredPermissions.some(p =>
    !session?.gerenciado || hasPermission(session, p) || canAccessRoute(session, "/dashboard")
  );
  if (!hasPerm) {
    throw new Error("Permissão negada: Usuário perdeu acesso ao recurso desde a geração da prévia.");
  }

  // 7. Trava de Idempotência (Atomic Shift PENDING -> CONFIRMED)
  record.status = "CONFIRMED";
  record.confirmed_at = now.toISOString();

  if (isSupabaseReady()) {
    try {
      await supabase
        .from("agent_confirmations")
        .update({ status: "CONFIRMED", confirmed_at: record.confirmed_at })
        .eq("confirmation_id", confirmationId)
        .eq("status", "PENDING");
    } catch (e) {}
  }

  // 8. Executar Domain Action com os Dados Originais do Banco
  const ctx = {
    session,
    unitId: record.unidade_id,
    empresaId: record.empresa_id,
    userId: record.user_id,
  };

  let executionResult = null;
  let executionError = null;

  try {
    executionResult = await writeTool.domainAction(ctx, record.input_sanitizado);
    record.status = "EXECUTED";
    record.executed_at = new Date().toISOString();
  } catch (err) {
    record.status = "FAILED";
    executionError = err.message || String(err);
    if (isSupabaseReady()) {
      try { await supabase.from("agent_confirmations").update({ status: "FAILED" }).eq("confirmation_id", confirmationId); } catch (e) {}
    }
    throw err;
  }

  // 9. Atualizar Status Final no Banco / Store
  if (isSupabaseReady()) {
    try {
      await supabase
        .from("agent_confirmations")
        .update({ status: "EXECUTED", executed_at: record.executed_at })
        .eq("confirmation_id", confirmationId);
    } catch (e) {}
  }

  // 10. Gravar Log de Auditoria Imutável (WRITE AUDIT LOG)
  const auditRecord = {
    audit_id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    confirmation_id: record.confirmation_id,
    conversation_id: record.conversation_id,
    agent_run_id: record.agent_run_id,
    tool_call_id: record.tool_call_id,
    tool: record.tool,
    input_payload: record.input_sanitizado,
    preview_snapshot: record.preview,
    risk_level: record.risk_level,
    requested_by: record.user_id,
    confirmed_by: session?.usuarioId || record.user_id,
    empresa_id: record.empresa_id,
    unidade_id: record.unidade_id,
    created_at: record.created_at,
    executed_at: record.executed_at,
    idempotency_key: record.idempotency_key,
    generated_record_id: executionResult?.movimentoId || executionResult?.reservaId || null,
    execution_result: executionResult,
    error_detail: executionError,
    reversal_strategy: writeTool.reversalStrategy,
  };

  memoryAuditLogStore.push(auditRecord);

  if (isSupabaseReady()) {
    try { await supabase.from("agent_write_audit_log").insert([auditRecord]); } catch (e) {}
  }

  return {
    success: true,
    confirmationId: record.confirmation_id,
    tool: record.tool,
    result: executionResult,
    executedAt: record.executed_at,
    reversalStrategy: writeTool.reversalStrategy,
  };
}

/**
 * Cancela uma confirmação pendente.
 */
export async function cancelConfirmation({ confirmationId, session }) {
  let record = memoryConfirmationsStore.get(confirmationId);
  if (isSupabaseReady()) {
    try {
      const { data } = await supabase.from("agent_confirmations").select("*").eq("confirmation_id", confirmationId).single();
      if (data) record = data;
    } catch (e) {}
  }

  if (!record) throw new Error("Confirmação não encontrada.");

  record.status = "CANCELLED";
  if (isSupabaseReady()) {
    try { await supabase.from("agent_confirmations").update({ status: "CANCELLED" }).eq("confirmation_id", confirmationId); } catch (e) {}
  }

  return { success: true, confirmationId, status: "CANCELLED" };
}

/**
 * Interpreta intenção de confirmação por texto (ex: "sim", "confirmar", "pode fazer").
 */
export async function resolveSimIntent({ prompt, conversationId, session }) {
  const norm = (prompt || "").toLowerCase().trim();
  const afirmativos = ["sim", "confirmar", "pode confirmar", "pode fazer", "autorizado", "ok pode fazer", "confirma"];

  if (!afirmativos.includes(norm)) {
    return { matches: 0 };
  }

  const userId = session?.usuarioId || "user-test";
  const unidadeId = session?.unidadeId || "unidade-teste";
  const now = new Date();

  // Buscar confirmações PENDING para a mesma conversa/usuário/unidade (usando memória como fonte primária resiliente)
  let pendingList = Array.from(memoryConfirmationsStore.values()).filter(
    r =>
      r.conversation_id === conversationId &&
      r.user_id === userId &&
      r.unidade_id === unidadeId &&
      r.status === "PENDING" &&
      new Date(r.expires_at) > now
  );

  if (pendingList.length === 0 && isSupabaseReady()) {
    try {
      const { data } = await supabase
        .from("agent_confirmations")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .eq("unidade_id", unidadeId)
        .eq("status", "PENDING")
        .gt("expires_at", now.toISOString());
      if (data) pendingList = data;
    } catch (e) {}
  }

  if (pendingList.length === 1) {
    return {
      matches: 1,
      confirmationId: pendingList[0].confirmation_id,
      tool: pendingList[0].tool,
    };
  }

  if (pendingList.length > 1) {
    return {
      matches: pendingList.length,
      ambiguity: true,
      responseText: `Você possui ${pendingList.length} ações pendentes de confirmação nesta conversa. Clique no botão [Confirmar] do cartão correspondente à ação desejada.`,
    };
  }

  return { matches: 0 };
}

/**
 * Utilitário para consultar logs de auditoria em memória/banco
 */
export function getMemoryAuditLog() {
  return memoryAuditLogStore;
}
