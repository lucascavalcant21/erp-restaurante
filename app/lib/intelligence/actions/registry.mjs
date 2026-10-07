// ACTION REGISTRY — o que a inteligência pode FAZER (mudar estado), e com
// que proteção. Pergunta nunca chega aqui.
//
// Risco:
//   LOW       executa direto quando autorizado (ex.: abrir tela — no cliente)
//   MEDIUM    prévia + confirmação
//   HIGH      prévia + confirmação explícita + auditoria obrigatória
//   CRITICAL  bloqueada pela conversa
// Ação sem executor (disponivel:false) é recusada com explicação: nada de
// ação perigosa sem proteção, nem "quase pronta".

import { registrarPerda } from "./registrar-perda.mjs";

export const RISCO = Object.freeze({ LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL" });

const indisponivel = (id, nome, modulo, risco, motivo) => Object.freeze({ id, nome, modulo, risco, disponivel: false, precisaConfirmacao: true, motivoIndisponivel: motivo });

export const ACOES = Object.freeze({
  "stock.registerLoss": registrarPerda,
  "stock.transfer": indisponivel("stock.transfer", "Transferir entre estoques", "estoque", RISCO.MEDIUM, "Transferência pela conversa ainda não foi liberada. Use a tela de Estoque."),
  "stock.adjust": indisponivel("stock.adjust", "Ajustar estoque", "estoque", RISCO.HIGH, "Ajuste de estoque exige PIN do administrador na tela de Estoque."),
  "stock.adjustRetroactive": indisponivel("stock.adjustRetroactive", "Alterar estoque retroativamente", "estoque", RISCO.CRITICAL, "Alteração retroativa de estoque não é permitida pela conversa."),
  "purchase.create": indisponivel("purchase.create", "Criar compra", "compras", RISCO.MEDIUM, "Criar compra pela conversa ainda não está disponível. Abra Compras para lançar."),
  "finance.createPayable": indisponivel("finance.createPayable", "Criar conta a pagar", "financeiro", RISCO.HIGH, "Movimentação financeira pela conversa ainda não está disponível."),
  "finance.payBill": indisponivel("finance.payBill", "Pagar conta", "financeiro", RISCO.CRITICAL, "Pagamento não é permitido pela conversa."),
  "reservation.create": indisponivel("reservation.create", "Criar reserva", "eventos", RISCO.MEDIUM, "Reserva pela conversa ainda não está disponível."),
  "reservation.update": indisponivel("reservation.update", "Alterar reserva", "eventos", RISCO.MEDIUM, "Alteração de reserva pela conversa ainda não está disponível."),
  "employee.createWarning": indisponivel("employee.createWarning", "Registrar advertência", "rh", RISCO.HIGH, "Operações de RH sensíveis não estão disponíveis pela conversa."),
  "employee.changeSalary": indisponivel("employee.changeSalary", "Alterar salário", "rh", RISCO.CRITICAL, "Alteração de salário não é permitida pela conversa."),
  "record.delete": indisponivel("record.delete", "Excluir registro", "geral", RISCO.CRITICAL, "Exclusão de registros não é permitida pela conversa."),
});

/**
 * Política: a ação pode seguir pela conversa?
 * @returns {{ permitido: boolean, motivo?: string, precisaConfirmacao: boolean, confirmacaoExplicita: boolean }}
 */
export function politicaDaAcao(def) {
  if (!def) return { permitido: false, motivo: "Ação desconhecida.", precisaConfirmacao: true, confirmacaoExplicita: true };
  if (def.risco === RISCO.CRITICAL) return { permitido: false, motivo: def.motivoIndisponivel || "Ação crítica: não é permitida pela conversa.", precisaConfirmacao: true, confirmacaoExplicita: true };
  if (!def.disponivel || typeof def.executar !== "function") return { permitido: false, motivo: def.motivoIndisponivel || "Ação não disponível.", precisaConfirmacao: true, confirmacaoExplicita: true };
  return {
    permitido: true,
    precisaConfirmacao: def.risco !== RISCO.LOW || def.precisaConfirmacao === true,
    confirmacaoExplicita: def.risco === RISCO.HIGH,
  };
}

export const acaoPorId = (id) => ACOES[id] || null;
