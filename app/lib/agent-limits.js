// ═══════════════════════════════════════════════════════════════
// FASE 2C — AGENT LIMITS CONFIGURATION
// app/lib/agent-limits.js
// ═══════════════════════════════════════════════════════════════

export const AGENT_LIMITS = {
  AGENT_ESTOQUE_MAX_QUANTIDADE: 500, // 500 kg / unidades
  AGENT_ESTOQUE_MAX_VALOR: 5000.0,  // R$ 5.000,00 total por operação
  AGENT_RESERVA_MAX_PESSOAS: 20,    // 20 pessoas por reserva
};

/**
 * Valida limites operacionais configurados para ferramentas WRITE do Agente.
 * Se ultrapassado, impede execução automática e direciona para fluxo manual/administrativo.
 * 
 * @param {string} tool - Nome da ferramenta (ex: 'estoque.registrar_entrada')
 * @param {object} input - Payload de parâmetros da ação
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkAgentLimits(tool, input = {}) {
  if (tool === "estoque.registrar_entrada") {
    const qtd = Number(input.quantidade || 0);
    const custo = Number(input.custo_unitario || input.custoUnitario || 0);
    const total = qtd * custo;

    if (qtd > AGENT_LIMITS.AGENT_ESTOQUE_MAX_QUANTIDADE) {
      return {
        ok: false,
        reason: `A quantidade informada (${qtd}) excede o limite máximo permitido para automação de estoque (${AGENT_LIMITS.AGENT_ESTOQUE_MAX_QUANTIDADE}). Solicite autorização administrativa ou registre manualmente.`,
      };
    }

    if (total > AGENT_LIMITS.AGENT_ESTOQUE_MAX_VALOR) {
      return {
        ok: false,
        reason: `O valor total da movimentação (R$ ${total.toFixed(2)}) excede o limite máximo permitido (${AGENT_LIMITS.AGENT_ESTOQUE_MAX_VALOR.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}). Operação direcionada para aprovação gerencial.`,
      };
    }
  }

  if (tool === "reservas.criar" || tool === "reservas.alterar") {
    const pessoas = Number(input.pessoas || input.quantidade_pessoas || 0);
    if (pessoas > AGENT_LIMITS.AGENT_RESERVA_MAX_PESSOAS) {
      return {
        ok: false,
        reason: `A quantidade de pessoas (${pessoas}) excede o limite de reservas automáticas (${AGENT_LIMITS.AGENT_RESERVA_MAX_PESSOAS} pessoas). Para grupos grandes/eventos, utilize o módulo Orçamento de Eventos.`,
      };
    }
  }

  return { ok: true };
}
