/**
 * MÓDULO DE TELEMETRIA E RASTREABILIDADE OPERACIONAL (ERP HÉFISTO)
 * Gera identificadores de correlação (operation_id) em operações reais e envia métricas técnicas.
 */

import { supabase } from './supabase.js';

/**
 * Gera um Operation ID / Correlation ID único para operações reais
 */
export function gerarOperationId(prefixo = 'op') {
  const timestamp = Date.now().toString(36);
  const aleatorio = Math.random().toString(36).substring(2, 7);
  return `${prefixo}_${timestamp}_${aleatorio}`;
}

/**
 * Registra silenciosamente a latência e métrica técnica de uma operação
 */
export async function registrarTelemetriaOperacional({
  empresaId,
  unidadeId,
  rpcNome,
  latenciaMs,
  statusCode = 200,
  operationId = null,
  isSynthetic = false
}) {
  if (!supabase || !rpcNome) return;
  try {
    await supabase.rpc('registrar_telemetria_saas', {
      p_empresa_id: empresaId,
      p_unidade_id: unidadeId,
      p_rpc_nome: rpcNome,
      p_latencia_ms: latenciaMs,
      p_status_code: statusCode,
      p_operation_id: operationId,
      p_is_synthetic: isSynthetic
    });
  } catch (err) {
    // Fail-safe silencioso
  }
}

/**
 * Registra log técnico de erro sanitizado associado a um operation_id
 */
export async function registrarLogSuporteOperacional({
  operationId,
  empresaId,
  unidadeId,
  userId,
  endpoint,
  errorCode,
  sanitizedStack,
  isSynthetic = false
}) {
  if (!supabase || !operationId) return;
  try {
    await supabase.rpc('registrar_log_suporte_saas', {
      p_operation_id: operationId,
      p_empresa_id: empresaId,
      p_unidade_id: unidadeId,
      p_user_id: userId,
      p_endpoint: endpoint,
      p_error_code: errorCode,
      p_sanitized_stack: sanitizedStack,
      p_is_synthetic: isSynthetic
    });
  } catch (err) {
    // Fail-safe silencioso
  }
}
