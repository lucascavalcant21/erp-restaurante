// ═══════════════════════════════════════════════════════════════
// FASE 2C — AGENT WRITE TOOL CATALOG & STRICT VALIDATOR
// app/lib/agent-write-catalog.js
// ═══════════════════════════════════════════════════════════════

import { registrarEntradaEstoqueDomainAction } from "./estoque-domain-action.js";
import {
  criarReservaDomainAction,
  alterarReservaDomainAction,
  cancelarReservaDomainAction,
  consultarDisponibilidadeReservas
} from "./reservas-domain-action.js";
import { fetchEstoque } from "./estoque.js";

const REQUIRED_WRITE_TOOL_FIELDS = [
  "readOnly",
  "riskLevel",
  "requiresConfirmation",
  "idempotencyRequired",
  "supportsDryRun",
  "requiredPermissions",
  "inputSchema",
  "outputSchema",
  "handler",
  "reversalStrategy",
];

/**
 * Catálogo Declarativo de Ferramentas WRITE do Héfisto Agent Core (Fase 2C)
 */
export const RAW_WRITE_TOOLS = [
  {
    name: "estoque.registrar_entrada",
    description: "Registra uma entrada física de produto/insumo no estoque da unidade",
    readOnly: false,
    riskLevel: "MEDIUM",
    requiresConfirmation: true,
    idempotencyRequired: true,
    supportsDryRun: true,
    requiredPermissions: ["estoque.overview.adjust_stock"],
    inputSchema: {
      type: "object",
      required: ["produtoNome", "quantidade", "custoUnitario"],
      properties: {
        produtoNome: { type: "string", description: "Nome do produto ou insumo" },
        quantidade: { type: "number", description: "Quantidade a ser adicionada" },
        custoUnitario: { type: "number", description: "Custo unitário em Reais (R$)" },
        unidadeMedida: { type: "string", description: "kg, g, L, un, etc." },
        observacao: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        estoqueAnterior: { type: "number" },
        estoqueNovo: { type: "number" },
      },
    },
    reversalStrategy: "movimentacao_compensatoria_saida",
    domainAction: registrarEntradaEstoqueDomainAction,
    handler: async (ctx, input) => {
      // Dry Run & Preview Generator
      const estoqueRes = await fetchEstoque(ctx.unitId);
      const insumos = estoqueRes.data || [];
      const normName = (input.produtoNome || "").toLowerCase().trim();
      const prod = insumos.find(p => (p.nome || "").toLowerCase().includes(normName)) || {
        id: "new-prod",
        nome: input.produtoNome,
        quantidade: 0,
        unidade_medida: input.unidadeMedida || "kg",
      };

      const qtd = Number(input.quantidade || 0);
      const custo = Number(input.custoUnitario || input.custo_unitario || 0);
      const estAtual = Number(prod.quantidade || 0);
      const estPrevisto = estAtual + qtd;
      const custoTotal = qtd * custo;

      return {
        preview: {
          title: "REGISTRAR ENTRADA DE ESTOQUE",
          actionName: "Entrada de Estoque",
          riskLevel: "MEDIUM",
          fields: [
            { label: "Produto", value: prod.nome },
            { label: "Quantidade", value: `${qtd} ${input.unidadeMedida || prod.unidade_medida || "kg"}` },
            { label: "Custo unitário", value: `R$ ${custo.toFixed(2)}` },
            { label: "Custo total", value: `R$ ${custoTotal.toFixed(2)}` },
            { label: "Estoque atual", value: `${estAtual} ${prod.unidade_medida || "kg"}` },
            { label: "Estoque previsto", value: `${estPrevisto} ${prod.unidade_medida || "kg"}` },
          ],
          summary: `Adicionar ${qtd} ${prod.unidade_medida || "kg"} de ${prod.nome} (Total: R$ ${custoTotal.toFixed(2)}). Novo saldo: ${estPrevisto} ${prod.unidade_medida || "kg"}.`,
        },
        payloadSanitizado: {
          produtoId: prod.id !== "new-prod" ? prod.id : null,
          produtoNome: prod.nome,
          quantidade: qtd,
          custoUnitario: custo,
          unidadeMedida: input.unidadeMedida || prod.unidade_medida || "kg",
          observacao: input.observacao || "Entrada de estoque via Héfisto Agent WRITE",
        },
      };
    },
  },
  {
    name: "reservas.criar",
    description: "Cria uma nova reserva de mesa no salão para a data/horário especificado",
    readOnly: false,
    riskLevel: "MEDIUM",
    requiresConfirmation: true,
    idempotencyRequired: true,
    supportsDryRun: true,
    requiredPermissions: ["salao.tables.view"],
    inputSchema: {
      type: "object",
      required: ["clienteNome", "data", "horario", "pessoas"],
      properties: {
        clienteNome: { type: "string" },
        clienteTelefone: { type: "string" },
        data: { type: "string", description: "YYYY-MM-DD" },
        horario: { type: "string", description: "HH:MM" },
        pessoas: { type: "number" },
        mesa: { type: "string" },
        observacoes: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        reservaId: { type: "string" },
      },
    },
    reversalStrategy: "cancelar_reserva_e_liberar_mesa",
    domainAction: criarReservaDomainAction,
    handler: async (ctx, input) => {
      const disp = await consultarDisponibilidadeReservas(
        ctx.unitId,
        input.data,
        input.horario,
        input.pessoas,
        input.mesa
      );

      if (!disp.disponivel) {
        throw new Error(`Sem disponibilidade: ${disp.conflitoMotivo}`);
      }

      return {
        preview: {
          title: "CRIAR NOVA RESERVA DE MESA",
          actionName: "Criar Reserva",
          riskLevel: "MEDIUM",
          fields: [
            { label: "Cliente", value: input.clienteNome },
            { label: "Telefone", value: input.clienteTelefone || "Não informado" },
            { label: "Data", value: input.data },
            { label: "Horário", value: input.horario },
            { label: "Pessoas", value: `${input.pessoas} pessoas` },
            { label: "Mesa", value: input.mesa || "Definição automática" },
          ],
          summary: `Reserva para ${input.clienteNome} (${input.pessoas} pessoas) em ${input.data} às ${input.horario}.`,
        },
        payloadSanitizado: {
          clienteNome: input.clienteNome,
          clienteTelefone: input.clienteTelefone || "",
          data: input.data,
          horario: input.horario,
          pessoas: Number(input.pessoas),
          mesa: input.mesa || "Mesa a definir",
          observacoes: input.observacoes || "",
        },
      };
    },
  },
  {
    name: "reservas.alterar",
    description: "Altera horário, data ou número de pessoas de uma reserva existente",
    readOnly: false,
    riskLevel: "MEDIUM",
    requiresConfirmation: true,
    idempotencyRequired: true,
    supportsDryRun: true,
    requiredPermissions: ["salao.tables.view"],
    inputSchema: {
      type: "object",
      required: ["reservaId"],
      properties: {
        reservaId: { type: "string" },
        data: { type: "string" },
        horario: { type: "string" },
        pessoas: { type: "number" },
        mesa: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
    reversalStrategy: "restaurar_dados_reserva_anteriores",
    domainAction: alterarReservaDomainAction,
    handler: async (ctx, input) => {
      return {
        preview: {
          title: "ALTERAR RESERVA DE MESA",
          actionName: "Alterar Reserva",
          riskLevel: "MEDIUM",
          fields: [
            { label: "ID Reserva", value: input.reservaId },
            { label: "Nova Data", value: input.data || "Manter atual" },
            { label: "Novo Horário", value: input.horario || "Manter atual" },
            { label: "Novas Pessoas", value: input.pessoas ? `${input.pessoas} pessoas` : "Manter atual" },
          ],
          summary: `Alterar reserva ${input.reservaId} para ${input.data || "mesma data"} às ${input.horario || "mesmo horário"}.`,
        },
        payloadSanitizado: {
          reservaId: input.reservaId,
          data: input.data,
          horario: input.horario,
          pessoas: input.pessoas ? Number(input.pessoas) : undefined,
          mesa: input.mesa,
        },
      };
    },
  },
  {
    name: "reservas.cancelar",
    description: "Cancela uma reserva de mesa existente no sistema",
    readOnly: false,
    riskLevel: "HIGH",
    requiresConfirmation: true,
    idempotencyRequired: true,
    supportsDryRun: true,
    requiredPermissions: ["salao.tables.view"],
    inputSchema: {
      type: "object",
      required: ["reservaId"],
      properties: {
        reservaId: { type: "string" },
        motivo: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        status: { type: "string" },
      },
    },
    reversalStrategy: "reativar_reserva_cancelada",
    domainAction: cancelarReservaDomainAction,
    handler: async (ctx, input) => {
      return {
        preview: {
          title: "CANCELAR RESERVA (AÇÃO DE ALTO RISCO)",
          actionName: "Cancelar Reserva",
          riskLevel: "HIGH",
          fields: [
            { label: "ID Reserva", value: input.reservaId },
            { label: "Consequência", value: "A reserva será cancelada e a mesa/vaga será imediatamente liberada para outros clientes." },
            { label: "Motivo", value: input.motivo || "Cancelamento via solicitação do usuário" },
          ],
          summary: `ATENÇÃO: Cancelar reserva ${input.reservaId} e liberar mesa no salão.`,
        },
        payloadSanitizado: {
          reservaId: input.reservaId,
          motivo: input.motivo || "Cancelado via Héfisto Agent WRITE",
        },
      };
    },
  },
];

/**
 * Validador estrito de ferramentas WRITE. Rejeita o catálogo na carga caso falte qualquer propriedade obrigatória.
 */
export function validateAndRegisterWriteTools(rawTools) {
  const validatedMap = new Map();

  for (const tool of rawTools) {
    for (const field of REQUIRED_WRITE_TOOL_FIELDS) {
      if (tool[field] === undefined || tool[field] === null) {
        throw new Error(`CRITICAL WRITE TOOL REJECTION: Tool '${tool.name}' is missing mandatory property '${field}'.`);
      }
    }

    if (tool.readOnly !== false) {
      throw new Error(`CRITICAL WRITE TOOL REJECTION: Tool '${tool.name}' must explicitly declare 'readOnly: false'.`);
    }

    if (tool.requiresConfirmation !== true) {
      throw new Error(`CRITICAL WRITE TOOL REJECTION: Tool '${tool.name}' must explicitly declare 'requiresConfirmation: true'.`);
    }

    validatedMap.set(tool.name, tool);
  }

  return validatedMap;
}

export const WRITE_TOOL_CATALOG = validateAndRegisterWriteTools(RAW_WRITE_TOOLS);
